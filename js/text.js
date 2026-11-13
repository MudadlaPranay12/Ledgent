// Text normalisation before parsing.
// Pure functions, no DOM. Handles:
//  - Unicode NFKC + script transliteration (Devanagari, Telugu, Tamil, Bengali,
//    Gujarati, Kannada) so "तीन सौ चालीस" becomes "tiin sau chaaliis"
//  - native digit sets (Devanagari/Telugu/Tamil/Bengali/Gujarati/Kannada)
//  - "3,400" -> "3400", repeated-letter collapse, punctuation
// Filler stripping happens in the parser (it needs the active lexicon).

const cp = (base, n = 10) => Array.from({ length: n }, (_, i) => String.fromCodePoint(base + i));

const DIGIT_SETS = [
  cp(0x0966), // Devanagari
  cp(0x09e6), // Bengali
  cp(0x0a66), // Gurmukhi (bonus)
  cp(0x0ae6), // Gujarati
  cp(0x0be6), // Tamil
  cp(0x0c66), // Telugu
  cp(0x0ce6), // Kannada
  cp(0x0d66), // Malayalam
];

/** Replace every supported native digit with its ASCII equivalent. */
export function mapDigits(s) {
  let out = '';
  for (const ch of s) {
    let replaced = false;
    for (const set of DIGIT_SETS) {
      const i = set.indexOf(ch);
      if (i >= 0) { out += String(i); replaced = true; break; }
    }
    if (!replaced) out += ch;
  }
  return out;
}

// ---------- Script tables ----------
// Each script: consonants (inherent 'a'), independent vowels, vowel signs
// (matras), and marks (anusvara/visarga/virama). Every consonant carries an
// inherent "a" unless followed by a matra or a virama.

const deva = {
  consonants: {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh',
    'स': 's', 'ह': 'h', 'ळ': 'l', 'क़': 'q', 'ख़': 'kh', 'ग़': 'g',
    'ज़': 'j', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'ऱ': 'r', 'ऩ': 'n',
  },
  vowels: { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' },
  matras: { 'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' },
  marks: { 'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '', '़': '', 'ऽ': '' },
};

const telu = {
  consonants: {
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
    'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
    'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
    'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh', 'ష': 'sh',
    'స': 's', 'హ': 'h', 'ళ': 'l', 'ఱ': 'r',
  },
  vowels: { 'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ii', 'ఉ': 'u', 'ఊ': 'uu', 'ఋ': 'ri', 'ఎ': 'e', 'ఏ': 'ee', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'oo', 'ఔ': 'au' },
  matras: { 'ా': 'aa', 'ి': 'i', 'ీ': 'ii', 'ు': 'u', 'ూ': 'uu', 'ృ': 'ri', 'ె': 'e', 'ే': 'ee', 'ై': 'ai', 'ొ': 'o', 'ో': 'oo', 'ౌ': 'au' },
  marks: { 'ం': 'n', 'ఁ': 'n', 'ః': 'h', '్': '' },
};

const taml = {
  consonants: {
    'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஜ': 'j', 'ஞ': 'ny',
    'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ன': 'n',
    'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ற': 'r', 'ல': 'l', 'ள': 'l', 'ழ': 'zh',
    'வ': 'v', 'ஶ': 'sh', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
  },
  vowels: { 'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ii', 'உ': 'u', 'ஊ': 'uu', 'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au' },
  matras: { 'ா': 'aa', 'ி': 'i', 'ீ': 'ii', 'ு': 'u', 'ூ': 'uu', 'ெ': 'e', 'ே': 'ee', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oo', 'ௌ': 'au' },
  marks: { 'ஂ': 'n', 'ஃ': 'h', '்': '' },
};

const beng = {
  consonants: {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng',
  },
  vowels: { 'অ': 'a', 'আ': 'aa', 'ই': 'i', 'ঈ': 'ii', 'উ': 'u', 'ঊ': 'uu', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou' },
  matras: { 'া': 'aa', 'ি': 'i', 'ী': 'ii', 'ু': 'u', 'ূ': 'uu', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou' },
  marks: { 'ঁ': 'n', 'ঃ': 'h', '্': '' },
};

const gujr = {
  consonants: {
    'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ઙ': 'ng',
    'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'jh', 'ઞ': 'ny',
    'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n',
    'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
    'પ': 'p', 'ફ': 'ph', 'બ': 'b', 'ભ': 'bh', 'મ': 'm',
    'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 'sh', 'ષ': 'sh', 'સ': 's', 'હ': 'h', 'ળ': 'l',
  },
  vowels: { 'અ': 'a', 'આ': 'aa', 'ઇ': 'i', 'ઈ': 'ii', 'ઉ': 'u', 'ઊ': 'uu', 'ઋ': 'ri', 'એ': 'e', 'ઐ': 'ai', 'ઓ': 'o', 'ઔ': 'au' },
  matras: { 'ા': 'aa', 'િ': 'i', 'ી': 'ii', 'ુ': 'u', 'ૂ': 'uu', 'ૃ': 'ri', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ૅ': 'e' },
  marks: { 'ં': 'n', 'ઃ': 'h', '્': '' },
};

const knda = {
  consonants: {
    'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'ng',
    'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'ny',
    'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n',
    'ತ': 't', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
    'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm',
    'ಯ': 'y', 'ರ': 'r', 'ಲ': 'l', 'ವ': 'v', 'ಶ': 'sh', 'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h', 'ಳ': 'l',
  },
  vowels: { 'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ii', 'ಉ': 'u', 'ಊ': 'uu', 'ಋ': 'ri', 'ಎ': 'e', 'ಏ': 'ee', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'oo', 'ಔ': 'au' },
  matras: { 'ಾ': 'aa', 'ಿ': 'i', 'ೀ': 'ii', 'ು': 'u', 'ೂ': 'uu', 'ೃ': 'ri', 'ೆ': 'e', 'ೇ': 'ee', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'oo', 'ೌ': 'au' },
  marks: { 'ಂ': 'n', 'ಃ': 'h', '್': '' },
};

const SCRIPTS = [deva, telu, taml, beng, gujr, knda];

const SCRIPT_CHARS = new Map();
for (const s of SCRIPTS) {
  for (const ch of Object.keys(s.consonants)) SCRIPT_CHARS.set(ch, { kind: 'c', s });
  for (const ch of Object.keys(s.vowels)) SCRIPT_CHARS.set(ch, { kind: 'v', s });
  for (const ch of Object.keys(s.matras)) SCRIPT_CHARS.set(ch, { kind: 'm', s });
  for (const ch of Object.keys(s.marks)) SCRIPT_CHARS.set(ch, { kind: 'k', s });
}

/** Transliterate any supported Indic script to a Roman approximation. */
export function transliterate(input) {
  const src = String(input);
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const info = SCRIPT_CHARS.get(ch);
    if (!info) { out += ch; continue; }
    const { kind, s } = info;
    if (kind === 'c') {
      out += s.consonants[ch];
      const next = src[i + 1];
      const nx = next ? SCRIPT_CHARS.get(next) : null;
      if (nx && nx.kind === 'm' && nx.s === s) {
        out += s.matras[next];
        i++;
      } else if (nx && nx.kind === 'k' && nx.s === s && (next === '्' || next === '్' || next === '்' || next === '্' || next === '્')) {
        i++; // virama: no inherent vowel
      } else {
        // Hindi schwa deletion: a word-final inherent "a" is not pronounced
        // (तीन -> tiin, not tiina), which keeps number words recognisable.
        const wordEnd = next === undefined || /[\s,.;:!?()\[\]{}"'\-]/.test(next) || !SCRIPT_CHARS.has(next);
        if (!wordEnd) out += 'a';
      }
    } else if (kind === 'v') {
      out += s.vowels[ch];
    } else if (kind === 'm') {
      out += s.matras[ch];
    } else {
      out += s.marks[ch] ?? '';
    }
  }
  return out;
}

/** Levenshtein edit distance (used for fuzzy number/name matching). */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * Full normalisation: NFKC, digits, transliteration, lowercase, thousands
 * separators, punctuation, repeated-letter collapse.
 */
export function normalizeText(input) {
  let s = String(input ?? '');
  try { s = s.normalize('NFKC'); } catch { /* older engine: keep as-is */ }
  s = mapDigits(s);
  s = transliterate(s);
  s = s.toLowerCase();
  s = s.replace(/₹/g, ' ');
  s = s.replace(/(\d),(?=\d{2,3}(?!\d))/g, '$1'); // 3,400 -> 3400
  s = s.replace(/[.,;:!?"'“”‘’()[\]{}|/\\<>*+=~`^%$#@&—–_]/g, ' ');
  s = s.replace(/[-]/g, ' ');
  s = s.replace(/([a-z])\1{2,}/g, '$1');           // sooooo -> so (letters only: 9000 stays 9000)
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Token stream with commas preserved as clause separators. */
export function tokenize(text) {
  const s = normalizeText(text)
    .replace(/,/g, ' , ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.split(' ').filter(Boolean);
}

/**
 * Consonant-skeleton key used for phonetic name matching.
 * "ramesh" / "rameesh" / "рамеш" -> "rmsh"; "sabzi" / "sabji" -> "sbj".
 */
export function phoneticKey(input) {
  let s = transliterate(String(input).toLowerCase());
  s = mapDigits(s);
  s = s.replace(/[^a-z0-9]/g, '');
  s = s.replace(/ph/g, 'f').replace(/bh/g, 'b').replace(/dh/g, 'd').replace(/gh/g, 'g')
    .replace(/kh/g, 'k').replace(/th/g, 't').replace(/chh/g, 'c').replace(/ch/g, 'c')
    .replace(/sh/g, 's').replace(/zh/g, 'j').replace(/ck/g, 'k').replace(/q/g, 'k')
    .replace(/x/g, 'ks').replace(/z/g, 'j').replace(/w/g, 'v').replace(/f/g, 'p');
  s = s.replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a').replace(/ou/g, 'u').replace(/ai/g, 'e').replace(/au/g, 'o');
  s = s.replace(/y/g, 'i');
  if (!s) return '';
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiou]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

/** Loose spelling key (keeps length) used as a second-chance name match. */
export function looseKey(input) {
  let s = transliterate(String(input).toLowerCase()).replace(/[^a-z0-9]/g, '');
  return s.replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a')
    .replace(/z/g, 'j').replace(/w/g, 'v').replace(/(.)\1+/g, '$1');
}
