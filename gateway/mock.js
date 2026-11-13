// Mock Gnani gateway for offline development and testing.
// Implements the same interface as js/voice.js so the full UI works
// end-to-end without connecting to Gnani services.
// Set VOICE=mock in .env to use this mode.

export class GnaniVoice {
  constructor({ onPartial, onFinal, onError }) {
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onError = onError;
    this.rec = null;
    this.got = false;
    this.buffer = []; // accumulated PCM chunks
    this.streaming = false;
    // Simulate first response after a short delay
    this.simulationTimeout = null;
  }

  // Start a simulated STT stream
  // In mock mode, immediately simulate a final transcript after a short delay
  startStream() {
    this.buffer = [];
    this.streaming = true;
    // Simulate receiving some data and then a final transcript
    this.simulationTimeout = setTimeout(() => {
      const simulatedText = 'Ramesh ka 340 udhaar';
      this.got = true;
      this.onFinal(simulatedText);
    }, 500);
  }

  // Send PCM audio chunk (mock: just stores it)
  sendPcm(chunk) {
    if (chunk && chunk.length) {
      this.buffer.push(chunk);
    }
  }

  // End the stream (hard endpoint: screen release)
  endStream() {
    if (this.simulationTimeout) {
      clearTimeout(this.simulationTimeout);
      this.simulationTimeout = null;
    }
    this.streaming = false;
    this.buffer = [];
    // In mock mode, immediately trigger a final transcript
    this.got = true;
    this.onFinal('Suresh ka 340 udhaar'); // default demo phrase
  }
}

// Mock TTS using browser speechSynthesis
// Streams Timbre audio, starts playing at first chunk
export function speak(text, lang = 'hi-IN') {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
}

// Stop speaking (barge-in: pressing the screen cancels playback immediately)
export const stopSpeaking = () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};