// Numbers: digits, Devanagari/Hindi words, English words, fuzzy ASR spellings,
// Indian compounds up to lakhs, and spoken digit-by-digit readback.
// Everything here returns RUPEES; callers convert to integer paise.
import { normalizeText, levenshtein, mapDigits } from './text.js';
import { ALL_MEANINGFUL } from './lexicon/index.js';

export { tokenize, normalizeText } from './text.js';

export const normalizeDigits = mapDigits;

// ---------- Word table ----------
const HI_TABLE =
  '0 shunya,sifar,zero|1 ek|2 do|3 teen,tin,tean,tein|4 char,chaar,chaar|5 paanch,panch,paach|' +
  '6 chhe,che,chhah,chah|7 saat,sat|8 aath,ath|9 nau|10 das,daas|11 gyarah,gyaarah|12 barah,baarah|' +
  '13 terah,tehrah|14 chaudah,chauda|15 pandrah,pandra|16 solah,sola|17 satrah|18 atharah,atthaarah|' +
  '19 unnis,unnees|20 bees,bis|21 ikkis,ikkees|22 baais,bais|23 teis,tais|24 chaubis,chaubees|' +
  '25 pachchis,pachis,pachchees|26 chhabbis,chabbis|27 sattais,sattaees|28 atthais|29 unatis,untis|' +
  '30 tees,tis|31 ikatis,iktees|32 battis,batees|33 tentis|34 chauntis,chauntis|35 paintis|36 chhattis|' +
  '37 saintis|38 adtis|39 untalis|40 chaalis,chalis,chalees,chalish,chaalees|41 iktalis|42 bayalis|' +
  '43 taintalis|44 chauvalis|45 paintalis|46 chhiyalis|47 saintalis|48 adtalis|49 unchas,unchaas|' +
  '50 pachas,pachaas,pachchas|51 ikyavan|52 bavan,bahavan|53 tirpan,tirpan|54 chauvan|55 pachpan|' +
  '56 chhappan|57 sattavan|58 atthavan|59 unsath|60 saath,sath|61 iksath|62 baasath|63 tirsath|' +
  '64 chausath|65 painsath|66 chhiyasath|67 sadsath|68 adsath|69 unhattar|70 sattar|71 ikhattar|' +
  '72 bahattar|73 tihattar|74 chauhattar|75 pachhattar,pachattar|76 chhihattar|77 sattahattar|' +
  '78 athhattar|79 unasi,unasi|80 assi|81 ikyasi|82 bayasi|83 tirasi|84 chaurasi|85 pachasi|' +
  '86 chhiyasi|87 sattasi|88 atthasi|89 nawasi|90 nabbe|91 ikyanve|92 baanve|93 tiranve|' +
  '94 chauranve|95 pachanve|96 chhiyanve|97 sattanve|98 atthanve|99 ninyanve';

const WORDS = new Map();      // token -> { v, en, tens }
const SYNONYMS = new Map();    // extra ASR spelling -> canonical

for (const part of HI_TABLE.split('|')) {
  const [n, list] = part.split(' ');
  for (const w of list.split(',')) if (w) WORDS.set(w, { v: Number(n), en: false, tens: Number(n) >= 20 && Number(n) % 10 === 0 });
}

const EN_UNITS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
EN_UNITS.forEach((w, i) => { if (i >= 0) WORDS.set(w, { v: i, en: true, tens: false }); });
const EN_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
for (const [w, v] of Object.entries(EN_TENS)) WORDS.set(w, { v, en: true, tens: true });

// ASR-error and spelling variants that edit distance alone should not guess.
for (const [alias, canon] of Object.entries({
  tin: 'teen', tean: 'teen', tein: 'teen', chalees: 'chalis', chalish: 'chalis', chaalees: 'chalis',
  so: 'sau', sao: 'sau', sock: 'sau', dhaai: 'dhai', adhai: 'dhai', adhaai: 'dhai',
  sade: 'saade', saadhe: 'saade', sawa: 'sava', shunya: 'zero', sifar: 'zero',
  pachattar: 'pachhattar', pachas: 'pachaas', tiin: 'teen', chaaliis: 'chalis',
  dhaaii: 'dhai', dhaaee: 'dhai', adhaaii: 'dhai', saadhe: 'saade',
})) SYNONYMS.set(alias, canon);

// Vowel-folded index so transliteration artefacts (tiin/chaaliis) match a
// canonical spelling without weakening edit-distance matching.
const foldVowels = (w) => w.replace(/aa/g, 'a').replace(/ii/g, 'i').replace(/ee/g, 'i')
  .replace(/oo/g, 'u').replace(/uu/g, 'u').replace(/ai/g, 'e').replace(/au/g, 'o');
const LOOSE = new Map();
{
  const seen = new Map();
  for (const k of WORDS.keys()) {
    const f = foldVowels(k);
    if (seen.has(f) && seen.get(f) !== WORDS.get(k).v) seen.set(f, null); // ambiguous fold
    else if (!seen.has(f)) seen.set(f, WORDS.get(k).v);
  }
  for (const [f, v] of seen) if (v != null) LOOSE.set(f, v);
}

const SCALE = { sau: 100, so: 100, sao: 100, hundred: 100, hazaar: 1000, hajar: 1000, hazar: 1000, thousand: 1000, lakh: 100000, lak: 100000, lakhs: 100000 };
const FRACTION = { dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, adhai: 2.5, adhaai: 2.5 };
const BONUS_ADD = { saade: 0.5, sade: 0.5, saadhe: 0.5 };
const BONUS_MUL = { sava: 1.25, sawa: 1.25, savaa: 1.25 };

const NUMBER_KEYS = [...WORDS.keys()];

/** Exact, synonym, then edit-distance lookup of a number word. */
export function lookupNumberWord(raw) {
  const w = SYNONYMS.get(raw) || raw;
  if (WORDS.has(w)) return { ...WORDS.get(w), key: w, fuzzy: false };
  const folded = foldVowels(w);
  // Never treat a real language word as a number ("no" is not "nau",
  // "balance" is not "baanve"). Exact dictionary hits above still win.
  if (ALL_MEANINGFUL.has(w) || ALL_MEANINGFUL.has(folded)) return null;
  if (LOOSE.has(folded)) {
    const v = LOOSE.get(folded);
    return { v, en: false, tens: v >= 20 && v % 10 === 0, key: folded, fuzzy: false };
  }
  if (w.length < 5) return null;
  const maxDist = w.length >= 7 ? 2 : 1;
  let best = null;
  let bestDist = Infinity;
  let tie = false;
  for (const k of NUMBER_KEYS) {
    if (k[0] !== w[0]) continue;
    if (Math.abs(k.length - w.length) > maxDist) continue;
    const d = levenshtein(w, k);
    if (d < bestDist) { bestDist = d; best = k; tie = false; }
    else if (d === bestDist) tie = true;
  }
  if (!best || bestDist > maxDist || tie) return null;
  return { ...WORDS.get(best), key: best, fuzzy: true };
}

export const isNumberWord = (w) => !!lookupNumberWord(w) || w in SCALE || w in FRACTION || w in BONUS_ADD || w in BONUS_MUL;

// Units that make a preceding digit a quantity, not a rupee amount. 'saal' is
// deliberately absent: in Kannada it means debt ("saala").
const UNIT_AFTER = new Set(['kilo', 'kg', 'gram', 'gm', 'litre', 'liter', 'ltr', 'packet', 'pkt', 'dozen', 'piece', 'pcs', 'din', 'baje', 'bje', 'mahine', 'tareekh']);

// ---------- Single number reader ----------
/**
 * Read one number starting at tokens[i].
 * Returns { value, next, digits, count, fuzzy } or null.
 */
export function readNumber(tokens, i) {
  let j = i;
  let total = 0;
  let cur = 0;
  let seenScale = false;
  let pendingAdd = null;
  let pendingMul = null;
  let fuzzy = false;
  let consumed = 0;
  let anyDigits = false;

  while (j < tokens.length) {
    // Canonicalise ASR spellings first (dhaaii -> dhai, so -> sau, ...).
    const t = SYNONYMS.get(tokens[j]) || tokens[j];

    if (t in BONUS_ADD) { pendingAdd = BONUS_ADD[t]; j++; consumed++; continue; }
    if (t in BONUS_MUL) { pendingMul = BONUS_MUL[t]; j++; consumed++; continue; }
    if (t in FRACTION) {
      if (cur !== 0 || seenScale) break;
      cur += FRACTION[t]; j++; consumed++; continue;
    }
    if (t in SCALE) {
      const scale = SCALE[t];
      if (scale === 100) {
        let base = cur || 1;
        if (pendingAdd != null) { base += pendingAdd; pendingAdd = null; }
        if (pendingMul != null) { base *= pendingMul; pendingMul = null; }
        cur = base * 100;
        seenScale = true; j++; consumed++; continue;
      }
      const base = cur || 1;
      total += base * scale;
      cur = 0; seenScale = true; j++; consumed++; continue;
    }

    // A digit token behaves exactly like a number word, so "1 hazaar 2 sau",
    // "3 sau 40" and "340 rupay" all run through one algorithm.
    let info = null;
    if (/^\d+(\.\d+)?$/.test(t)) {
      info = { v: parseFloat(t), en: false, tens: false, fuzzy: false, digits: true };
      anyDigits = true;
    } else {
      info = lookupNumberWord(t);
    }
    if (!info) break;
    if (info.fuzzy) fuzzy = true;
    let n = info.v;
    if (pendingAdd != null) { n += pendingAdd; pendingAdd = null; }
    if (pendingMul != null) { n *= pendingMul; pendingMul = null; }

    if (cur === 0) cur = n;
    else if (n === 0 && cur >= 10) cur *= 10;                                                    // thirty four zero -> 340
    else if (cur >= 10 && cur < 100 && cur % 10 === 0 && n > 0 && n < 10) cur += n;              // thirty four
    else if (cur >= 100 && cur % 100 === 0 && n > 0 && n < 100) cur += n;                        // teen sau chalis
    else if (cur >= 1 && cur < 10 && info.en && info.tens && total === 0) cur = cur * 100 + n;    // three forty
    else break;

    j++; consumed++;
  }

  if (consumed === 0) return null;
  return { value: total + cur, next: j, digits: anyDigits, count: consumed, fuzzy };
}

// ---------- Amount extraction ----------
const NOISE = new Set(['um', 'uh', 'hmm', 'aaa', 'hmm', 'er', 'ah']);

export function extractAmounts(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    // Spoken digit string: "three four zero" / "teen char shunya".
    let run = 1;
    let str = '';
    const firstInfo = lookupNumberWord(tokens[i]);
    if (firstInfo && firstInfo.v < 10) {
      str = String(firstInfo.v);
      let k = i + 1;
      while (k < tokens.length && run < 6) {
        const info = lookupNumberWord(tokens[k]);
        if (!info || info.v >= 10) break;
        str += String(info.v);
        run++; k++;
      }
      if (run >= 2 && str.length <= 6) {
        out.push({ paise: Math.round(Number(str) * 100), start: i, end: k, digits: false, count: run, digitString: true, fuzzy: false });
        i = k;
        continue;
      }
    }

    const r = readNumber(tokens, i);
    if (!r) { i++; continue; }
    const after = tokens[r.next];
    // A lone word for 2 or 9 is probably not an amount; 10 and above is.
    const ok = r.value > 0 &&
      (r.digits ? !UNIT_AFTER.has(after) : (r.count > 1 || r.value >= 10)) &&
      !NOISE.has(tokens[i]);
    if (ok) out.push({ paise: Math.round(r.value * 100), start: i, end: r.next, digits: r.digits, count: r.count, digitString: false, fuzzy: !!r.fuzzy });
    i = Math.max(r.next, i + 1);
  }
  return out;
}

/** Spoken digit-by-digit readback for low-confidence confirmation. */
const DIGIT_WORDS = ['shunya', 'ek', 'do', 'teen', 'char', 'paanch', 'chhe', 'saat', 'aath', 'nau'];
export function digitsSpoken(paise) {
  const rupees = Math.round(Math.abs(paise) / 100);
  return String(rupees).split('').map((d) => DIGIT_WORDS[Number(d)]).join('-');
}

/** Rupees (may be fractional) -> colloquial words, used for readback. */
export function amountToWords(paise) {
  const r = paise / 100;
  if (Number.isInteger(r)) return `${r} rupay`;
  return `${r} rupay`;
}

export function normalizeAmountText(text) {
  return normalizeText(text);
}
