// Gnani gateway adapter (Prisma v3.0 STT / Timbre v3.0 TTS).
// Speaks the same interface as js/voice.js:
//   new GnaniVoice({onPartial,onFinal,onError,lang}); start(); stop();
// It is only used when the gateway is configured AND GET /health answers.
// Protocol (gateway/server.js):
//   GET  /session           -> { token, expires }
//   WS   /voice?token=...   -> origin-checked, single-use token
//   send {type:'start', lang, mode}
//   send binary PCM16 @16k  (we stream mic audio when permitted)
//   send {type:'finish'}    -> server replies {type:'partial'|'final', text}
// TTS stays on the device (speechSynthesis); this class never logs transcripts.

export async function probeGateway(baseUrl, timeoutMs = 900) {
  if (!baseUrl) return { ok: false, reason: 'No gateway URL configured' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, reason: `Gateway /health returned ${res.status}` };
    const json = await res.json().catch(() => ({}));
    if (json && json.status && json.status !== 'ok') return { ok: false, reason: `Gateway not healthy: ${json.status}` };
    return { ok: true, reason: 'Gnani gateway healthy' };
  } catch (e) {
    return { ok: false, reason: e?.name === 'AbortError' ? 'Gateway /health timed out' : 'Gateway unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

const wsUrl = (base) => base.replace(/^http/, 'ws');

export class GnaniVoice {
  constructor({ onPartial, onFinal, onError, lang = 'hi-IN', baseUrl }) {
    Object.assign(this, { onPartial, onFinal, onError, lang, baseUrl, ws: null, ctx: null, stream: null, node: null, active: false });
  }

  async start() {
    this.active = true;
    try {
      const s = await fetch(`${this.baseUrl}/session`, { cache: 'no-store' });
      if (!s.ok) throw new Error('session');
      const { token } = await s.json();
      const ws = new WebSocket(`${wsUrl(this.baseUrl)}/voice?token=${encodeURIComponent(token)}`);
      this.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', lang: this.lang, mode: 'codemix' }));
        this._startMic();
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'partial') this.onPartial?.(msg.text || '');
        if (msg.type === 'final') { this.active = false; this.onFinal?.(msg.text || ''); this._close(); }
        if (msg.type === 'error') { this.onError?.(msg.error || 'gateway'); this._close(); }
      };
      ws.onerror = () => this.onError?.('network');
      ws.onclose = () => { if (this.active) this.onError?.('network'); };
    } catch {
      this.onError?.('network');
      this._close();
    }
  }

  async _startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ sampleRate: 16000 });
      const source = this.ctx.createMediaStreamSource(stream);
      this.node = this.ctx.createScriptProcessor(4096, 1, 1);
      this.node.onaudioprocess = (e) => {
        if (!this.active || !this.ws || this.ws.readyState !== 1) return;
        const data = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-1, Math.min(1, data[i])) * 0x7fff;
        this.ws.send(pcm.buffer);
      };
      source.connect(this.node);
      this.node.connect(this.ctx.destination);
    } catch {
      this.onError?.('not-allowed');
    }
  }

  /** Hard end of speech: stop capturing, tell the gateway to finalise. */
  stop() {
    this.active = false;
    try { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'finish' })); } catch { /* closed */ }
    this._stopMic();
  }

  _stopMic() {
    try { this.node?.disconnect(); } catch { /* ignore */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    this.node = null; this.stream = null;
    if (this.ctx) { try { this.ctx.close(); } catch { /* ignore */ } this.ctx = null; }
  }

  _close() {
    this._stopMic();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }
}
