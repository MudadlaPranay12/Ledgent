// Ledgent configuration. Safe to import in Node (no `window` access at load).
const isBrowser = typeof window !== 'undefined' && typeof location !== 'undefined';

const VALID_VOICE = ['dev', 'gnani', 'mock'];
const VALID_LANGS = ['hi-IN', 'en-IN', 'te-IN', 'ta-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'pa-IN', 'ml-IN', 'auto'];

function param(name) {
  if (!isBrowser) return null;
  try { return new URLSearchParams(location.search).get(name); } catch { return null; }
}

function stored(key) {
  if (!isBrowser) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

const urlVoice = param('voice');
const urlLang = param('lang');

export const VOICE = VALID_VOICE.includes(urlVoice)
  ? urlVoice
  : (VALID_VOICE.includes(stored('ledgent_voice')) ? stored('ledgent_voice') : 'gnani');

export const LANG = VALID_LANGS.includes(urlLang)
  ? urlLang
  : (VALID_LANGS.includes(stored('ledgent_lang')) ? stored('ledgent_lang') : 'hi-IN');

// The gateway runs beside the app in development. A deployed app passes ?gw= or
// stores the URL; the key never reaches the browser.
const DEV_GATEWAY = isBrowser && ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : '';
export const GATEWAY_URL = (param('gw') || stored('ledgent_gateway') || DEV_GATEWAY).replace(/\/$/, '');

export const CONFIG = {
  voice: VOICE,
  lang: LANG,
  gatewayUrl: GATEWAY_URL,
  healthTimeoutMs: 1500,
  llmEnabled: param('llm') === '1' || stored('ledgent_llm') === '1',
  llmTimeoutMs: 1500,
  maxWidth: 430,
  langs: VALID_LANGS,
  sttFormat: param('format') === 'codemix' ? 'codemix' : 'transcribe',
};

if (isBrowser) {
  window.VOICE_MODE = VOICE;
  window.ledgentVoiceMode = VOICE;
  window.LEDGENT_LANG = LANG;
}

export function setVoice(mode) {
  if (!VALID_VOICE.includes(mode)) return;
  CONFIG.voice = mode;
  if (isBrowser) {
    try { localStorage.setItem('ledgent_voice', mode); } catch { /* private mode */ }
    window.VOICE_MODE = mode;
    window.ledgentVoiceMode = mode;
  }
}

export function setLang(lang) {
  if (!VALID_LANGS.includes(lang)) return;
  CONFIG.lang = lang;
  if (isBrowser) {
    try { localStorage.setItem('ledgent_lang', lang); } catch { /* private mode */ }
    window.LEDGENT_LANG = lang;
  }
}
