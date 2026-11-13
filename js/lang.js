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
// Written in each language's own script so the disclosure is readable by the
// person using the app, not just transliterated into Latin letters.
export const DISCLOSURE = {
  'hi-IN': 'मैं Ledgent हूँ, एक AI सहायक। आप जो बोलेंगे लिखूँगा और सहेजने से पहले पूछूँगा।',
  'en-IN': 'I am Ledgent, an AI assistant. I write what you say and ask before saving.',
  'te-IN': 'నేను Ledgent, ఒక AI సహాయకుడిని. మీరు చెప్పినది రాసి, సేవ్ చేయడానికి ముందు అడుగుతాను.',
  'ta-IN': 'நான் Ledgent, ஒரு AI உதவியாளர். நீங்கள் சொல்வதை எழுதி, சேமிக்கும் முன் கேட்பேன்.',
  'mr-IN': 'मी Ledgent, एक AI सहाय्यक. तुम्ही म्हणता ते लिहितो आणि जतन करण्यापूर्वी विचारतो.',
  'bn-IN': 'আমি Ledgent, একটি AI সহায়ক। আপনি যা বলেন লিখি, সেভ করার আগে জিজ্ঞাসা করি।',
  'gu-IN': 'હું Ledgent છું, એક AI સહાયક. તમે બોલો તે લખું છું, સેવ કરતાં પહેલાં પૂછું છું.',
  'kn-IN': 'ನಾನು Ledgent, ಒಂದು AI ಸಹಾಯಕ. ನೀವು ಹೇಳಿದ್ದನ್ನು ಬರೆದು, ಉಳಿಸುವ ಮೊದಲು ಕೇಳುತ್ತೇನೆ.',
  'pa-IN': 'ਮੈਂ Ledgent ਹਾਂ, ਇੱਕ AI ਸਹਾਇਕ। ਤੁਸੀਂ ਬੋਲੋਗੇ ਲਿਖਦਾ ਹਾਂ, ਸੇਵ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਪੁੱਛਦਾ ਹਾਂ।',
  'ml-IN': 'ഞാൻ Ledgent, ഒരു AI സഹായി. നിങ്ങൾ പറയുന്നത് എഴുതി, സേവ് ചെയ്യുന്നതിന് മുൻപ് ചോദിക്കും.',
  auto: 'मैं Ledgent हूँ, एक AI सहायक। सहेजने से पहले पूछूँगा।',
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
