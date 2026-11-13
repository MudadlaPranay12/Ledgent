// Microphone capture with the constraints the hackathon requires, converted to
// 16 kHz PCM16 by js/pcm-worklet.js. Release (stop) is the hard endpoint.
export class MicCapture {
  constructor({ onFrame, onError } = {}) {
    this.onFrame = onFrame;
    this.onError = onError;
    this.stream = null;
    this.ctx = null;
    this.node = null;
    this.source = null;
    this.sink = null;
    this.active = false;
  }

  async start() {
    if (this.active) return true;
    if (!navigator.mediaDevices?.getUserMedia) { this.onError?.('unsupported'); return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      this.onError?.(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'not-allowed' : 'audio-capture');
      return false;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      await this.ctx.audioWorklet.addModule('js/pcm-worklet.js');
      this.node = new AudioWorkletNode(this.ctx, 'pcm16k');
      this.node.port.onmessage = (e) => {
        if (!this.active) return;
        this.onFrame?.(new Uint8Array(e.data));
      };
      this.source = this.ctx.createMediaStreamSource(this.stream);
      // A zero-gain sink keeps the graph pulling audio without echoing the mic.
      this.sink = this.ctx.createGain();
      this.sink.gain.value = 0;
      this.source.connect(this.node);
      this.node.connect(this.sink);
      this.sink.connect(this.ctx.destination);
      this.active = true;
      return true;
    } catch (e) {
      this.onError?.('audio-capture');
      this.stop();
      return false;
    }
  }

  stop() {
    this.active = false;
    try { this.node?.port && (this.node.port.onmessage = null); } catch { /* ignore */ }
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { this.node?.disconnect(); } catch { /* ignore */ }
    try { this.sink?.disconnect(); } catch { /* ignore */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { if (this.ctx && this.ctx.state !== 'closed') this.ctx.close(); } catch { /* ignore */ }
    this.stream = null; this.ctx = null; this.node = null; this.source = null; this.sink = null;
  }
}
