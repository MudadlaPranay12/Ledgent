// Gnani adapter: relays Prisma v3.0 (STT) and Timbre v3.0 (TTS) over WebSocket.
// TODO(GNANI): exact endpoint URLs and message formats will be provided.
// Authenticates the PWA with a session token.
// Holds GNANI_API_KEY from .env.
// Stores NOTHING on disk, and logs no transcripts.

// Configuration (from .env)
const GNANI_API_KEY = import.meta.env.GNANI_API_KEY || ''; // TODO(GNANI): read from .env
const GNANI_ENDPOINT = import.meta.env.GNANI_ENDPOINT || 'wss://api.gnani.ai'; // TODO(GNANI)

// WebSocket connections
let sttWs = null; // Prisma STT WebSocket
let ttsWs = null; // Timbre TTS WebSocket

// Gnani Voice class implementing the same interface as js/voice.js
export class GnaniVoice {
  constructor({ onPartial, onFinal, onError }) {
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onError = onError;
    this.rec = null;
    this.got = false;
    this.streaming = false;
    this.pendingChunks = [];
    this.speaking = false;
    this.speakStream = null;
  }

  // Authenticate and start STT stream over WebSocket
  startStream() {
    // TODO(GNANI): implement actual WebSocket connection to Gnini Prisma STT
    // Message format on startup: { type: 'start', api_key: GNANI_API_KEY, mode: 'codemix' | 'transcribe' }
    // Mode is exposed as a config value VOICE_MODE=transcribe|codemix
    // this.sttWs = new WebSocket(`${GNANI_ENDPOINT}/stt`);
    // this.sttWs.onmessage = (ev) => {
    //   const msg = JSON.parse(ev.data);
    //   if (msg.type === 'partial') this.onPartial(msg.text);
    //   if (msg.type === 'final') { this.got = true; this.onFinal(msg.text); }
    // };
    // this.sttWs.onerror = (e) => this.onError(e.error);

    // Mock: start mock stream for development
    // In production, this would be the real Gnani WebSocket
    // For now, fall back to mock if no real endpoint configured
    if (!GNANI_API_KEY) {
      // TODO(GNANI): show error or fall back to dev mode
      this.onError('No GNANI_API_KEY configured');
    }
  }

  // Send PCM audio data to Gnani STT
  sendPcm(chunk) {
    // TODO(GNANI): send chunk over STT WebSocket
    // Expected format: 16 kHz mono PCM Int16Array or Buffer
    // Message format: { type: 'pcm', data: chunk }
    this.pendingChunks.push(chunk);
  }

  // End the STT stream (screen is the hard endpoint)
  endStream() {
    // TODO(GNANI): send finish signal to Gnini WebSocket
    // Message format: { type: 'finish' }
    // this.sttWs?.send(JSON.stringify({ type: 'finish' }));
    this.sttWs = null;
    this.streaming = false;
    // After endStream, the Gnani service sends a final transcript
    // which arrives via onFinal callback
  }
}

// TTS over WebSocket to Timbre v3.0
export function speak(text, lang = 'hi-IN') {
  // TODO(GNANI): send TTS request over Gnani TTS WebSocket
  // Message format: { type: 'speak', text, lang }
  // The Timbre v3.0 engine streams audio starting at first chunk
  // For now, fall back to browser speechSynthesis
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
}

// Stop TTS playback (barge-in: pressing screen cancels immediately)
export const stopSpeaking = () => {
  // TODO(GNANI): send cancel signal to Gnani TTS WebSocket
  // Message format: { type: 'cancel' }
  // this.ttsWs?.send(JSON.stringify({ type: 'cancel' }));
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};