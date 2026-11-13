// AudioWorklet: downsample the microphone to 16 kHz mono and emit exactly
// 512 Int16 samples (1024 bytes) per message — the frame size Gnani Prisma
// requires. Runs on the audio thread; no DOM, no allocations per sample.
class Pcm16kProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = 16000 / sampleRate;   // output samples per input sample
    this.phase = 0;
    this.prev = 0;
    this.out = new Int16Array(512);
    this.n = 0;
  }

  emit(sample) {
    const s = Math.max(-1, Math.min(1, sample));
    this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.n === 512) {
      const copy = this.out.slice(0).buffer;
      this.port.postMessage(copy, [copy]);
      this.n = 0;
    }
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || !ch.length) return true;
    for (let i = 0; i < ch.length; i++) {
      const cur = ch[i];
      this.phase += this.step;
      while (this.phase >= 1) {
        this.phase -= 1;
        // linear interpolation between the previous and current input sample
        this.emit(this.prev + (cur - this.prev) * this.phase);
      }
      this.prev = cur;
    }
    return true;
  }
}

registerProcessor('pcm16k', Pcm16kProcessor);
