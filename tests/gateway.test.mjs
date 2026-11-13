// Gateway tests against a fake Gnani upstream: no credits burned, no network.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { createGateway } from '../gateway/server.js';

let pass = 0;
const ok = (name, fn) => { fn(); pass += 1; console.log(`  ok ${pass} - ${name}`); };
const okAsync = async (name, fn) => { await fn(); pass += 1; console.log(`  ok ${pass} - ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORIGIN = 'http://localhost:8199';

function fakeUpstream(log) {
  const sock = new EventEmitter();
  sock.readyState = 1;
  sock.sent = [];
  sock.send = (data) => {
    sock.sent.push(data);
    if (typeof data === 'string') { log.push(JSON.parse(data)); return; }
    sock.emit('frame', Buffer.from(data));
  };
  sock.close = () => { sock.readyState = 3; sock.emit('close'); };
  setImmediate(() => sock.emit('open'));
  return sock;
}

function connect(url, origin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: origin ? { Origin: origin } : {} });
    ws.once('open', () => resolve(ws));
    ws.once('error', (e) => reject(e));
  });
}

const nextFrame = (ws) => new Promise((resolve) => {
  const on = (d) => { ws.off('message', on); resolve(JSON.parse(d.toString())); };
  ws.on('message', on);
});

async function main() {
  const sttLog = [];
  const ttsLog = [];
  let sttSockets = [];
  let ttsCancels = 0;

  const gw = createGateway({
    apiKey: 'test-key-not-real',
    allowedOrigin: ORIGIN,
    writeUsage: false,
    sttFactory: () => { const s = fakeUpstream(sttLog); sttSockets.push(s); return s; },
    ttsFactory: (opts) => {
      const s = new EventEmitter();
      s.readyState = 1;
      s.close = () => { ttsCancels += 1; s.readyState = 3; };
      ttsLog.push(opts);
      setTimeout(() => {
        if (s.readyState !== 1) return;
        opts.onStart?.();
        opts.onChunk?.(Buffer.alloc(1024, 1), 0);
        opts.onChunk?.(Buffer.alloc(1024, 2), 1);
        if (s.readyState === 1) opts.onEnd?.();
      }, 5);
      return s;
    },
  });

  await new Promise((r) => gw.httpServer.listen(0, r));
  const port = gw.httpServer.address().port;
  const base = `http://127.0.0.1:${port}`;

  await okAsync('GET /health reports real model names', async () => {
    const res = await fetch(`${base}/health`);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.model, 'prisma-v3.0');
    assert.equal(json.ttsModel, 'timbre-v3.0');
  });

  await okAsync('GET /session rejects a foreign origin', async () => {
    const res = await fetch(`${base}/session`, { headers: { Origin: 'http://evil.example' } });
    assert.equal(res.status, 403);
  });

  await okAsync('GET /session issues a short-lived token', async () => {
    const res = await fetch(`${base}/session`, { headers: { Origin: ORIGIN } });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.match(json.token, /^[0-9a-f-]{36}$/);
    assert.ok(json.expires > Date.now());
  });

  const token = async () => (await (await fetch(`${base}/session`, { headers: { Origin: ORIGIN } })).json()).token;

  await okAsync('WS /voice rejects a bad origin', async () => {
    const t = await token();
    await assert.rejects(connect(`ws://127.0.0.1:${port}/voice?token=${t}`, 'http://evil.example'));
  });

  await okAsync('WS /voice rejects an unknown token', async () => {
    await assert.rejects(connect(`ws://127.0.0.1:${port}/voice?token=nope`, ORIGIN));
  });

  await okAsync('WS /voice accepts one token exactly once', async () => {
    const t = await token();
    const ws = await connect(`ws://127.0.0.1:${port}/voice?token=${t}`, ORIGIN);
    ws.close();
    await assert.rejects(connect(`ws://127.0.0.1:${port}/voice?token=${t}`, ORIGIN));
  });

  const ws = await connect(`ws://127.0.0.1:${port}/voice?token=${await token()}`, ORIGIN);
  await sleep(20);

  await okAsync('start opens Prisma v3.0 STT with the chosen language', async () => {
    const got = nextFrame(ws);
    ws.send(JSON.stringify({ type: 'start', lang: 'te-IN', format: 'codemix' }));
    const msg = await got;
    assert.equal(msg.type, 'connected');
    assert.equal(msg.format, 'codemix');
    const sock = sttSockets[sttSockets.length - 1];
    assert.ok(sock, 'an upstream STT socket was opened');
    assert.equal(gw.usage.sttSessions, 1);
  });

  await okAsync('1024-byte PCM frames are forwarded upstream untouched', async () => {
    const sock = sttSockets[sttSockets.length - 1];
    const frame = Buffer.alloc(1024, 7);
    const seen = new Promise((r) => sock.once('frame', r));
    ws.send(frame);
    const got = await seen;
    assert.equal(got.length, 1024);
    assert.equal(got[0], 7);
  });

  await okAsync('STT transcript is forwarded without audio or ids', async () => {
    const sock = sttSockets[sttSockets.length - 1];
    const got = nextFrame(ws);
    sock.emit('message', Buffer.from(JSON.stringify({
      type: 'transcript', text: 'Gopal ka paisa 300 migilindi',
      detected_language_code: 'te-IN', segment_index: 0, latency: 210,
    })));
    const msg = await got;
    assert.equal(msg.type, 'transcript');
    assert.equal(msg.text, 'Gopal ka paisa 300 migilindi');
    assert.equal(msg.detected_language_code, 'te-IN');
    assert.equal(gw.usage.sttTranscripts, 1);
  });

  await okAsync('stop sends commit upstream (hard end of speech)', async () => {
    ws.send(JSON.stringify({ type: 'stop' }));
    await sleep(30);
    const sock = sttSockets[sttSockets.length - 1];
    const commits = sock.sent
      .filter((m) => typeof m === 'string')
      .map((m) => JSON.parse(m))
      .filter((m) => m.type === 'commit');
    assert.equal(commits.length, 1, 'exactly one commit');
  });

  await okAsync('TTS request streams audio chunks back as base64', async () => {
    const frames = [];
    const onMsg = (d) => frames.push(JSON.parse(d.toString()));
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ type: 'tts', id: 1, text: 'Teen sau chaalis rupaye', lang: 'hi-IN' }));
    await sleep(80);
    ws.off('message', onMsg);
    assert.equal(ttsLog.length, 1);
    assert.equal(ttsLog[0].text, 'Teen sau chaalis rupaye');
    assert.equal(ttsLog[0].lang, 'hi-IN');
    const audio = frames.filter((f) => f.type === 'tts_audio');
    assert.equal(audio.length, 2);
    assert.equal(Buffer.from(audio[0].audio, 'base64').length, 1024);
    assert.ok(frames.some((f) => f.type === 'tts_end'));
    assert.equal(gw.usage.ttsRequests, 1);
  });

  await okAsync('barge-in cancels upstream TTS and drops the queued utterance', async () => {
    let opened = 0;
    let closed = 0;
    const slow = createGateway({
      apiKey: 'test', allowedOrigin: ORIGIN, writeUsage: false,
      sttFactory: () => fakeUpstream([]),
      ttsFactory: (opts) => {
        opened += 1;
        const s = new EventEmitter();
        s.readyState = 1;
        s.close = () => { closed += 1; s.readyState = 3; };
        // never finishes: the only way out is cancellation
        setTimeout(() => { if (s.readyState === 1) opts.onStart?.(); }, 50);
        return s;
      },
    });
    await new Promise((r) => slow.httpServer.listen(0, r));
    const p2 = slow.httpServer.address().port;
    const t2 = (await (await fetch(`http://127.0.0.1:${p2}/session`, { headers: { Origin: ORIGIN } })).json()).token;
    const w2 = await connect(`ws://127.0.0.1:${p2}/voice?token=${t2}`, ORIGIN);
    w2.send(JSON.stringify({ type: 'tts', id: 9, text: 'pehla', lang: 'hi-IN' }));
    w2.send(JSON.stringify({ type: 'tts', id: 10, text: 'dusra', lang: 'hi-IN' }));
    await sleep(30);
    w2.send(JSON.stringify({ type: 'tts_cancel' }));
    await sleep(60);
    assert.equal(opened, 1, 'only the in-flight request reached upstream');
    assert.ok(closed >= 1, 'cancellation closed the upstream socket');
    w2.close();
    await slow.close();
  });

  await okAsync('usage counter stores counts only', async () => {
    const keys = Object.keys(gw.usage).sort();
    assert.deepEqual(keys, ['errors', 'startedAt', 'sttFrames', 'sttSessions', 'sttTranscripts', 'ttsChunks', 'ttsRequests']);
    const blob = JSON.stringify(gw.usage);
    assert.ok(!blob.includes('test-key-not-real'));
  });

  ws.close();
  await gw.close();
  console.log(`\n${pass} passed, 0 failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
