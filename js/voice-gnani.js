// Real Gnani voice client: microphone -> gateway (which holds the API key) ->
// Prisma v3.0 STT, and answer text -> Timbre v3.0 TTS streamed back as PCM.
// The browser never sees the key, and no audio or transcript is stored.
import { MicCapture } from './audio-capture.js';
import { CONFIG } from './config.js';

const TTS_RATE = 16000;

export async function probeGateway(baseUrl, timeoutMs = 1200) {
  if (!baseUrl) return { ok: false, reason: 'No gateway URL configured' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, reason: `Gateway /health returned ${res.status}` };
    const json = await res.json();
    if (json.status !== 'ok') return { ok: false, reason: `Gateway unhealthy: ${json.status}` };
    if (json.stt === 'missing_key') return { ok: false, reason: 'Gateway has no GNANI_API_KEY' };
    return { ok: true, reason: 'Gnani gateway healthy', health: json };
  } catch (e) {
    return { ok: false, reason: e?.name === 'AbortError' ? 'Gateway /health timed out' : 'Gateway unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

const wsUrl = (base) => base.replace(/^http/, 'ws');

export class GatewayVoice {
  constructor({ baseUrl, lang = 'hi-IN', onPartial, onFinal, onError, onDetected, onFirstAudio, onSession } = {}) {
    Object.assign(this, { baseUrl, lang, onPartial, onFinal, onError, onDetected, onFirstAudio, onSession });
    this.ws = null;
    this.mic = null;
    this.active = false;
    this.ready = false;
    this.ttsCtx = null;
    this.playhead = 0;
    this.sources = new Set();
    this.ttsId = 0;
    this.audioReported = false;
  }

  async _socket() {
    if (this.ws && this.ws.readyState === 1) return this.ws;
    const res = await fetch(`${this.baseUrl}/session`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 429 ? 'rate_limited' : 'session_failed');
    const { token } = await res.json();
    const ws = new WebSocket(`${wsUrl(this.baseUrl)}/voice?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onmessage = (ev) => this._onMessage(ev);
    ws.onerror = () => this.onError?.('network');
    ws.onclose = () => { this.ready = false; };
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ws_timeout')), 4000);
      ws.addEventListener('open', () => { clearTimeout(t); resolve(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('ws_failed')); }, { once: true });
    });
    return ws;
  }

  _onMessage(ev) {
    if (typeof ev.data !== 'string') return;
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'connected') {
      this.ready = true;
      this.requested = msg.requested_language || msg.lang || this.lang;
      this.onSession?.(this.requested);
      return;
    }
    if (msg.type === 'processing') return;
    if (msg.type === 'transcript') {
      if (msg.detected_language_code) this.onDetected?.(msg.detected_language_code);
      this.onFinal?.(msg.text || '', {
        detected: msg.detected_language_code,
        requested: msg.requested_language || this.requested || this.lang,
        latencyMs: msg.latency_ms,
      });
      return;
    }
    if (msg.type === 'error') { this.onError?.(msg.where === 'tts' ? 'tts_unavailable' : (msg.message || 'voice_error')); return; }
    if (msg.type === 'stt_closed') { this.ready = false; return; }
    if (msg.type === 'tts_start') return;
    if (msg.type === 'tts_audio') { this._playChunk(msg.audio); return; }
  }

  async start() {
    this.stopMicOnly();
    this.active = true;
    try {
      const ws = await this._socket();
      ws.send(JSON.stringify({ type: 'start', lang: this.lang, format: CONFIG.sttFormat }));
      this.mic = new MicCapture({
        onFrame: (bytes) => {
          if (!this.active) return;
          const sock = this.ws;
          if (sock && sock.readyState === 1) sock.send(bytes.buffer);
        },
        onError: (code) => { this.active = false; this.onError?.(code); },
      });
      const ok = await this.mic.start();
      if (!ok) { this.active = false; return false; }
      return true;
    } catch (e) {
      this.active = false;
      this.onError?.(e.message === 'rate_limited' ? 'rate_limited' : 'network');
      return false;
    }
  }

  /** Release of the button/screen: hard end of speech. */
  stop() {
    this.active = false;
    this.stopMicOnly();
    const ws = this.ws;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'stop' })); } catch { /* closed */ }
    }
  }

  stopMicOnly() {
    try { this.mic?.stop(); } catch { /* ignore */ }
    this.mic = null;
  }

  // ---------------- TTS ----------------
  _ensureTtsCtx() {
    if (!this.ttsCtx || this.ttsCtx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ttsCtx = new Ctx();
      this.playhead = 0;
    }
    if (this.ttsCtx.state === 'suspended') this.ttsCtx.resume().catch(() => {});
    return this.ttsCtx;
  }

  /** Speak through Gnani Timbre v3.0; resolves on first scheduled audio chunk. */
  speak(text, lang = this.lang) {
    const ws = this.ws;
    if (!text || !ws || ws.readyState !== 1) return Promise.resolve(false);
    this.ttsId += 1;
    this.audioReported = false;
    return new Promise((resolve) => {
      let resolved = false;
      const done = (v) => { if (!resolved) { resolved = true; resolve(v); } };
      setTimeout(() => done(false), 4000);
      const onFirst = () => {
        if (!this.audioReported) {
          this.audioReported = true;
          this.onFirstAudio?.();
          done(true);
        }
      };
      this._onFirstAudio = onFirst;
      ws.send(JSON.stringify({ type: 'tts', id: this.ttsId, text, lang }));
    });
  }

  _playChunk(b64) {
    if (!b64) return;
    const ctx = this._ensureTtsCtx();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
    if (!samples.length) return;
    const buf = ctx.createBuffer(1, samples.length, TTS_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const at = Math.max(now + 0.02, this.playhead);
    src.start(at);
    this.playhead = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
    if (this._onFirstAudio) { this._onFirstAudio(); this._onFirstAudio = null; }
  }

  /** Barge-in: stop local playback and abort upstream synthesis. */
  stopSpeaking() {
    for (const s of this.sources) { try { s.stop(); } catch { /* ignore */ } }
    this.sources.clear();
    this.playhead = 0;
    const ws = this.ws;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'tts_cancel' })); } catch { /* closed */ }
    }
  }

  /** Timbre requests already run at 16 kHz; the browser resamples on playback. */
  get ttsRate() { return TTS_RATE; }
}
