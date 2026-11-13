// Ledgent voice gateway: holds the Gnani key, authenticates the browser, bridges
// realtime Prisma v3.0 STT and Timbre v3.0 TTS, and never writes audio or
// transcripts to disk. Native Node HTTP + `ws`; no Docker, no framework.
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadEnv } from './env.js';
import { openStt, synthesize, TTS_VOICE } from './gnani.adapter.js';

loadEnv();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = path.join(HERE, 'usage.json');
const TOKEN_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;

export function createGateway(options = {}) {
  const apiKey = options.apiKey ?? process.env.GNANI_API_KEY ?? '';
  const allowedOrigins = String(options.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const voice = options.voice || TTS_VOICE;
  const sttFactory = options.sttFactory || ((args) => openStt({ ...args, apiKey }));
  const ttsFactory = options.ttsFactory || ((args) => synthesize({ ...args, apiKey, voice }));
  const writeUsage = options.writeUsage !== false;

  const tokens = new Map();       // token -> { expires, ip, used }
  const rate = new Map();         // ip -> { count, since }
  const usage = {
    startedAt: new Date().toISOString(),
    sttSessions: 0,
    sttFrames: 0,
    sttTranscripts: 0,
    ttsRequests: 0,
    ttsChunks: 0,
    errors: 0,
  };

  const saveUsage = throttle(() => {
    if (!writeUsage) return;
    // counts and timings only: never keys, audio or transcripts
    try { fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2)); } catch { /* best effort */ }
  }, 2000);

  const cors = (res, origin) => {
    const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
  };

  const httpServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin || '';
    const ip = req.socket.remoteAddress || 'unknown';
    cors(res, origin);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        stt: apiKey ? 'configured' : 'missing_key',
        tts: apiKey ? 'configured' : 'missing_key',
        model: 'prisma-v3.0',
        ttsModel: 'timbre-v3.0',
        ttsVoice: voice,
        uptimeSec: Math.round(process.uptime()),
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/session') {
      if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'origin_not_allowed' }));
        return;
      }
      const now = Date.now();
      const r = rate.get(ip);
      if (r && now - r.since < RATE_WINDOW_MS) {
        if (r.count >= RATE_MAX) {
          res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' });
          res.end(JSON.stringify({ error: 'rate_limited' }));
          return;
        }
        r.count += 1;
      } else {
        rate.set(ip, { count: 1, since: now });
      }
      const token = crypto.randomUUID();
      tokens.set(token, { expires: now + TOKEN_TTL_MS, ip, used: false });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token, expires: now + TOKEN_TTL_MS }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin || '';
    const token = url.searchParams.get('token') || '';
    const entry = tokens.get(token);

    const reject = (code, reason) => {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };

    if (url.pathname !== '/voice') return reject(404, 'Not Found');
    if (allowedOrigins.length && !allowedOrigins.includes(origin)) return reject(403, 'Origin Not Allowed');
    if (!entry) return reject(401, 'Invalid Token');
    if (entry.used) return reject(401, 'Token Used');
    if (entry.expires < Date.now()) { tokens.delete(token); return reject(401, 'Token Expired'); }
    if (entry.ip !== (req.socket.remoteAddress || 'unknown')) return reject(401, 'Token IP Mismatch');

    entry.used = true;
    tokens.delete(token);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (client) => {
    let upstream = null;
    let stopping = false;
    let currentTts = null;
    const ttsQueue = [];
    let ttsBusy = false;
    const send = (obj) => { try { if (client.readyState === 1) client.send(JSON.stringify(obj)); } catch { /* closed */ } };

    const closeUpstream = (graceMs = 0) => {
      if (!upstream) return;
      const s = upstream;
      upstream = null;
      setTimeout(() => { try { s.close(); } catch { /* already closed */ } }, graceMs);
    };

    const runTtsQueue = () => {
      if (ttsBusy || !ttsQueue.length) return;
      const job = ttsQueue.shift();
      ttsBusy = true;
      usage.ttsRequests += 1;
      let cancelled = false;
      const ws = ttsFactory({
        text: job.text,
        lang: job.lang,
        onStart: () => { if (!cancelled) send({ type: 'tts_start', id: job.id }); },
        onChunk: (buf, seq) => {
          if (cancelled) return;
          usage.ttsChunks += 1;
          send({ type: 'tts_audio', id: job.id, seq, audio: buf.toString('base64') });
        },
        onEnd: () => {
          ttsBusy = false;
          currentTts = null;
          if (!cancelled) send({ type: 'tts_end', id: job.id });
          saveUsage();
          runTtsQueue();
        },
        onError: () => {
          usage.errors += 1;
          ttsBusy = false;
          currentTts = null;
          if (!cancelled) send({ type: 'error', where: 'tts', message: 'tts_unavailable' });
          runTtsQueue();
        },
      });
      currentTts = {
        id: job.id,
        cancel: () => {
          cancelled = true;
          try { ws.close(); } catch { /* closed */ }
          ttsBusy = false;
          currentTts = null;
          runTtsQueue();
        },
      };
    };

    client.on('message', (data, isBinary) => {
      if (isBinary) {
        usage.sttFrames += 1;
        if (upstream && upstream.readyState === 1) {
          try { upstream.send(data); } catch { /* dropped frame */ }
        }
        return;
      }

      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.type === 'start') {
        closeUpstream();
        if (!apiKey) { send({ type: 'error', where: 'stt', message: 'missing_api_key' }); return; }
        usage.sttSessions += 1;
        const ws = sttFactory({
          lang: msg.lang || 'hi-IN',
          auto: !!msg.auto,
          format: msg.format === 'codemix' ? 'codemix' : 'transcribe',
        });
        upstream = ws;
        ws.on('open', () => send({ type: 'connected', lang: msg.lang || 'hi-IN', format: msg.format || 'transcribe' }));
        ws.on('message', (raw) => {
          let frame;
          try { frame = JSON.parse(raw.toString()); } catch { return; }
          if (frame.type === 'transcript') {
            usage.sttTranscripts += 1;
            saveUsage();
            // forward only what the UI needs; no audio, no session ids
            send({
              type: 'transcript',
              text: frame.text || '',
              detected_language_code: frame.detected_language_code || null,
              segment_index: frame.segment_index ?? null,
              latency_ms: frame.latency ?? null,
              audio_duration_ms: frame.audio_duration_ms ?? null,
            });
          } else if (frame.type === 'processing') {
            send({ type: 'processing' });
          } else if (frame.type === 'connected') {
            send({ type: 'stt_ready' });
          } else if (frame.type === 'error') {
            usage.errors += 1;
            send({ type: 'error', where: 'stt', message: frame.message || 'stt_error' });
          }
        });
        ws.on('error', () => { usage.errors += 1; send({ type: 'error', where: 'stt', message: 'stt_unreachable' }); });
        ws.on('close', () => { if (!stopping) send({ type: 'stt_closed' }); });
        return;
      }

      if (msg.type === 'commit') {
        try { upstream?.send(JSON.stringify({ type: 'commit' })); } catch { /* closed */ }
        return;
      }

      if (msg.type === 'stop') {
        stopping = true;
        try { upstream?.send(JSON.stringify({ type: 'commit' })); } catch { /* closed */ }
        closeUpstream(800);
        return;
      }

      if (msg.type === 'tts') {
        if (!apiKey) { send({ type: 'error', where: 'tts', message: 'missing_api_key' }); return; }
        ttsQueue.push({ id: msg.id ?? 0, text: String(msg.text || '').slice(0, 400), lang: msg.lang || 'hi-IN' });
        runTtsQueue();
        return;
      }

      if (msg.type === 'tts_cancel') {
        ttsQueue.length = 0;
        if (currentTts) currentTts.cancel();
        return;
      }

      if (msg.type === 'ping') send({ type: 'pong' });
    });

    client.on('close', () => {
      stopping = true;
      closeUpstream();
      ttsQueue.length = 0;
      if (currentTts) currentTts.cancel();
      saveUsage();
    });
  });

  const close = () => new Promise((res) => {
    for (const c of wss.clients) { try { c.terminate(); } catch { /* ignore */ } }
    wss.close(() => httpServer.close(() => res()));
  });

  return { httpServer, wss, usage, close, allowedOrigins, hasKey: !!apiKey, voice };
}

function throttle(fn, ms) {
  let last = 0;
  return () => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    fn();
  };
}

// ---- start when run directly ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.GATEWAY_PORT || process.env.PORT || 8787);
  const gw = createGateway();
  gw.httpServer.listen(port, () => {
    console.log(`Ledgent gateway on http://localhost:${port}`);
    console.log(`  key: ${gw.hasKey ? 'present' : 'MISSING (set GNANI_API_KEY in gateway/.env)'}`);
    console.log(`  origin allowlist: ${gw.allowedOrigins.length ? gw.allowedOrigins.join(', ') : '(any)'}`);
    console.log(`  endpoints: /health, /session, ws /voice`);
  });
  const bye = async () => { await gw.close(); process.exit(0); };
  process.on('SIGTERM', bye);
  process.on('SIGINT', bye);
}
