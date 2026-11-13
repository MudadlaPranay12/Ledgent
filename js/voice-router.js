// Picks the voice engine and hides the differences from app.js.
// Order: explicit ?voice=mock -> Gnani gateway (configured + /health ok) ->
// DEV browser speech, with a visible reason why Gnani was not used.
import { CONFIG, VOICE } from './config.js';
import { DevVoice, speak, stopSpeaking, voiceSupported, voiceErrorText } from './voice.js';
import { GnaniVoice, probeGateway } from './voice-gnani.js';

export const LOG = { mode: 'dev', reason: '', badge: '' };

export const MOCK_PHRASES = [
  'Suresh ka 340 udhaar',
  'Ramesh ka 150 udhaar',
  'nahi, 430',
  'Suresh ka total',
  'din band',
];

/** A scripted stand-in for Gnani, used by ?voice=mock (e2e + offline demo). */
class MockVoice {
  constructor({ onPartial, onFinal, lang = 'hi-IN' }) {
    Object.assign(this, { onPartial, onFinal, lang, timer: null, phrase: MOCK_PHRASES[0], i: 0, active: false });
  }
  start() {
    this.stop();
    this.active = true;
    this.phrase = MOCK_PHRASES[this.i % MOCK_PHRASES.length];
    this.i++;
    const words = this.phrase.split(' ');
    let k = 0;
    this.timer = setInterval(() => {
      k++;
      this.onPartial?.(words.slice(0, k).join(' '));
      if (k >= words.length) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 90);
    return true;
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!this.active) return;
    this.active = false;
    this.onFinal?.(this.phrase);
  }
}

/**
 * @returns {{mode:string, reason:string, badge:string, engine:object, setLang:(l:string)=>void}}
 */
export async function resolveVoice({ onPartial, onFinal, onError, lang }) {
  const wants = VOICE; // 'dev' | 'gnani' | 'mock'

  if (wants === 'mock') {
    Object.assign(LOG, { mode: 'mock', reason: 'Scripted demo voice (?voice=mock)', badge: 'DEMO VOICE: scripted phrases' });
    return finalise(LOG, { engine: new MockVoice({ onPartial, onFinal, lang }) });
  }

  if (wants !== 'dev' && CONFIG.gatewayUrl) {
    const health = await probeGateway(CONFIG.gatewayUrl, CONFIG.healthTimeoutMs);
    if (health.ok) {
      Object.assign(LOG, { mode: 'gnani', reason: health.reason, badge: 'GNANI VOICE' });
      return finalise(LOG, { engine: new GnaniVoice({ onPartial, onFinal, onError, lang, baseUrl: CONFIG.gatewayUrl }) });
    }
    Object.assign(LOG, { mode: 'dev', reason: health.reason, badge: 'DEV VOICE: browser speech, not Gnani' });
  } else {
    Object.assign(LOG, {
      mode: 'dev',
      reason: CONFIG.gatewayUrl ? 'Voice mode is dev' : 'No Gnani gateway configured',
      badge: 'DEV VOICE: browser speech, not Gnani',
    });
  }

  if (!voiceSupported()) {
    Object.assign(LOG, { mode: 'none', reason: 'Voice not available in this browser', badge: 'VOICE NOT AVAILABLE' });
    return finalise(LOG, { engine: null });
  }
  return finalise(LOG, { engine: new DevVoice({ onPartial, onFinal, onError, lang }) });
}

function finalise(log, { engine }) {
  let current = { ...log, engine };
  current.setLang = (l) => {
    if (engine) engine.lang = l;
    current.lang = l;
  };
  return current;
}

export { speak, stopSpeaking, voiceErrorText };

export const speakWithLang = (text, lang) => speak(text, lang);
