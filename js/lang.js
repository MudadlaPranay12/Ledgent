// Language roster shared by Prisma recognition, Timbre synthesis and the UI.
// `auto` uses Prisma's indic-auto so the model reports the language it heard.
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
  { code: 'pa-IN', short: 'ਪੰ', name: 'Punjabi' },
  { code: 'ml-IN', short: 'മ', name: 'Malayalam' },
  { code: 'auto', short: 'AUTO', name: 'Auto detect' },
];

// First-turn AI disclosure. Hinglish is the documented fallback, never a claim
// that every language is native-speaker reviewed.
export const DISCLOSURE = {
  'hi-IN': 'Main Ledgent hoon, ek AI sahayak. Aapki boli likhta hoon, save karne se pehle poochhta hoon.',
  'en-IN': 'I am Ledgent, an AI assistant. I write what you say and ask before saving.',
  'te-IN': 'Nenu Ledgent, oka AI sahayak. Meeru cheppinadi rasi, save cheyye mundu adugutaanu.',
  'ta-IN': 'Naan Ledgent, oru AI udhavi. Neenga sonnathai ezhuthi, save seyya munnadi ketpen.',
  'mr-IN': 'Mi Ledgent, ek AI sahayak. Tumhi mhanal te lihito ani save karanyapurvi vicharto.',
  'bn-IN': 'Ami Ledgent, ek AI sahayak. Apni ja bolen ta likhi, save korar age jiggesh korbo.',
  'gu-IN': 'Hu Ledgent chhu, ek AI sahayak. Tame bolo te lakhu chhu, save karta pehla puchhu chhu.',
  'kn-IN': 'Naanu Ledgent, ondu AI sahayaka. Neenu heliddu bariyuttene, save maduva munna keluttane.',
  'pa-IN': 'Main Ledgent haan, ek AI sahayak. Tussi bolde ho, main likhda haan, save karan ton pehla puchhda haan.',
  'ml-IN': 'Njan Ledgent, oru AI sahayakan. Ningal parayunnathu ezhuthunnu, save cheyyunnathinu munpu chodikkum.',
  auto: 'Main Ledgent hoon, ek AI sahayak. Save karne se pehle poochhta hoon.',
};

export const currentLang = () => CONFIG.lang || 'hi-IN';
export const langLabel = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).short;
export const langName = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).name;
export const disclosureFor = (code) => DISCLOSURE[code] || DISCLOSURE.auto;

export function nextLang(code) {
  const i = LANGS.findIndex((l) => l.code === code);
  return LANGS[(i + 1) % LANGS.length].code;
}

export function chooseLang(code) {
  if (!LANGS.some((l) => l.code === code)) return currentLang();
  setLang(code);
  return code;
}
