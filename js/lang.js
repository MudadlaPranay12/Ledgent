// Language roster shared by recognition, TTS and the language button.
import { LANGUAGES } from './lexicon/index.js';
import { CONFIG, setLang } from './config.js';

export const LANGS = [
  { code: 'hi-IN', short: 'हिं', name: 'Hindi' },
  { code: 'en-IN', short: 'EN', name: 'English' },
  { code: 'te-IN', short: 'తె', name: 'Telugu' },
  { code: 'ta-IN', short: 'த', name: 'Tamil' },
  { code: 'mr-IN', short: 'मरा', name: 'Marathi' },
  { code: 'bn-IN', short: 'বাং', name: 'Bengali' },
  { code: 'gu-IN', short: 'ગુ', name: 'Gujarati' },
  { code: 'kn-IN', short: 'ಕ', name: 'Kannada' },
];

export const lexiconLanguages = LANGUAGES;

export const currentLang = () => CONFIG.lang || 'hi-IN';
export const langLabel = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).short;
export const langName = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).name;

export function nextLang(code) {
  const i = LANGS.findIndex((l) => l.code === code);
  return LANGS[(i + 1) % LANGS.length].code;
}

export function chooseLang(code) {
  if (!LANGS.some((l) => l.code === code)) return currentLang();
  setLang(code);
  return code;
}
