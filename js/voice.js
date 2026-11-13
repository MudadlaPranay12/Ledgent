// DEV voice layer: the browser's built-in speech APIs. Used whenever the Gnani
// gateway is not configured/reachable. The UI shows a loud DEV badge in this mode.
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const voiceSupported = () => !!SR;

export const VOICE_ERRORS = {
  'not-allowed': 'Mic blocked',
  'service-not-allowed': 'Mic blocked',
  'audio-capture': 'Mic blocked',
  'no-speech': 'No speech heard',
  network: 'Voice network error',
  aborted: 'No speech heard',
  'language-not-supported': 'Voice not available in this browser',
  unsupported: 'Voice not available in this browser',
};

export const voiceErrorText = (code) => VOICE_ERRORS[code] || `Error: ${code || 'voice failed'}`;

export class DevVoice {
  constructor({ onPartial, onFinal, onError, lang = 'hi-IN' }) {
    Object.assign(this, { onPartial, onFinal, onError, lang, rec: null, got: false, active: false });
  }

  get supported() { return !!SR; }

  start() {
    if (!SR) { this.onError?.('unsupported'); return false; }
    this.stop();
    this.got = false;
    this.active = true;
    const rec = new SR();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let text = '';
      let final = false;
      for (const r of ev.results) {
        text += r[0].transcript;
        if (r.isFinal) final = true;
      }
      text = text.trim();
      if (final) {
        this.got = true;
        this.active = false;
        this.cleanup();
        this.onFinal?.(text);
      } else {
        this.onPartial?.(text);
      }
    };
    rec.onerror = (e) => {
      this.active = false;
      this.cleanup();
      this.onError?.(e.error || 'voice');
    };
    rec.onend = () => {
      this.active = false;
      if (!this.got) this.onError?.('no-speech');
    };

    this.rec = rec;
    try { rec.start(); } catch { this.onError?.('unsupported'); return false; }
    return true;
  }

  /** Hard end of speech: releasing the screen/button. */
  stop() {
    this.active = false;
    try { this.rec?.stop(); } catch { /* already stopped */ }
    this.cleanup();
  }

  cleanup() { this.rec = null; }
}

export function speak(text, lang = 'hi-IN', onStart = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.98;
    u.pitch = 1;
    if (onStart) {
      u.onstart = () => { try { onStart(); } catch { /* ignore */ } };
      // Some headless engines never fire onstart; still mark the request.
      setTimeout(() => { try { onStart(); } catch { /* ignore */ } }, 400);
    }
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export const stopSpeaking = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
};
