// Ledgent configuration. Safe to import in Node (no `window` access at load).
const isBrowser = typeof window !== 'undefined' && typeof location !== 'undefined';

const VALID_VOICE = ['dev', 'gnani', 'mock'];
const VALID_LANGS = ['hi-IN', 'en-IN', 'te-IN', 'ta-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'kn-IN'];

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

export const VOICE = VALID_VOICE.includes(urlVoice) ? urlVoice : (VALID_VOICE.includes(stored('ledgent_voice')) ? stored('ledgent_voice') : 'gnani');

export const LANG = VALID_LANGS.includes(urlLang) ? urlLang : (VALID_LANGS.includes(stored('ledgent_lang')) ? stored('ledgent_lang') : 'hi-IN');

export const GATEWAY_URL = (param('gw') || stored('ledgent_gateway') || '').replace(/\/$/, '');

// Optional LLM fallback lane. Off by default; only used when the rules fail and
// the gateway explicitly advertises /llm.
export const CONFIG = {
  voice: VOICE,
  lang: LANG,
  gatewayUrl: GATEWAY_URL,
  healthTimeoutMs: 900,
  llmEnabled: param('llm') === '1' || stored('ledgent_llm') === '1',
  llmTimeoutMs: 1500,
  maxWidth: 430,
  langs: VALID_LANGS,
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
