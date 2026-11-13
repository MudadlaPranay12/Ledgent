// Customer matching: exact name, alias, then phonetic. Never picks the
// closest spelling when two customers genuinely match — it asks instead.
import { phoneticKey, looseKey, normalizeText } from './text.js';
import { labelWords, MERGED, hasAny } from './lexicon/index.js';

const nameKeys = (c) => {
  const out = new Set();
  const full = normalizeText(c.name || '');
  if (full) out.add(full);
  for (const part of full.split(' ')) if (part.length >= 3) out.add(part);
  for (const a of c.aliases || []) {
    const n = normalizeText(a);
    if (n) out.add(n);
  }
  return [...out];
};

const phonKeys = (c) => {
  const out = new Set();
  for (const k of nameKeys(c)) if (k.length >= 3) out.add(phoneticKey(k));
  return [...out];
};

const looseKeys = (c) => {
  const out = new Set();
  for (const k of nameKeys(c)) if (k.length >= 3) out.add(looseKey(k));
  return [...out];
};

const DATE_MARKERS = new Set(['tareekh', 'tarikh', 'date', 'din', 'baje', 'mahine', 'saal', 'se']);

const labelTokensOf = (c) => {
  const labels = labelWords(c.label || '');
  if (labels.length) return labels;
  // Merge "Atta chakki" style labels through the lexicon too.
  return normalizeText(c.label || '').split(' ').filter((t) => t.length >= 3);
};

// "wala"/"shop" describe no one on their own: both Rameshes are 'wala'.
const GENERIC_LABEL = new Set(['wala', 'wali', 'wale', 'vala', 'vale', 'vali', 'shop', 'customer', 'dukan']);

function narrowByLabel(list, words) {
  const hit = list.filter((c) => labelTokensOf(c).some((l) => !GENERIC_LABEL.has(l) && words.includes(l)));
  return hit.length === 1 ? hit[0] : null;
}

/**
 * Resolve a customer for a token list.
 * @returns {{status:'ok'|'ambiguous'|'new'|'missing', id?:string, candidates?:string[],
 *            newName?:string, matchedBy?:string}}
 */
// Names arrive with case endings glued on across languages: "Rameshinu"
// (Malayalam), "Ramesh-ku" (Tamil), "Rameshla" (Marathi). Strip a trailing
// particle before comparing, keeping at least four characters of the name.
const CASE_SUFFIXES = ['inu', 'inteth', 'nte', 'ude', 'ku', 'ki', 'nu', 'la', 'le', 'ge', 'ne', 'ke', 'de', 'da', 'di', 'ka', 'ko', 'il', 'ton', 'se'];
const nameVariants = (t) => {
  const out = [t];
  for (const s of CASE_SUFFIXES) {
    if (t.endsWith(s) && t.length - s.length >= 4) out.push(t.slice(0, -s.length));
  }
  return out;
};

export function matchCustomer(words, customers = [], opts = {}) {
  const tokens = words.filter((t) => t !== ',');
  const expanded = [...new Set(tokens.flatMap(nameVariants))];
  const exact = [];
  for (const c of customers) {
    if (nameKeys(c).some((k) => expanded.includes(k))) exact.push(c);
  }

  let pool = exact;
  let matchedBy = 'exact';

  if (pool.length === 0) {
    pool = [];
    for (const c of customers) {
      if (phonKeys(c).some((k) => expanded.some((t) => t.length >= 3 && phoneticKey(t) === k))) pool.push(c);
    }
    matchedBy = 'phonetic';
  }

  if (pool.length === 0) {
    pool = [];
    for (const c of customers) {
      if (looseKeys(c).some((k) => expanded.some((t) => t.length >= 3 && looseKey(t) === k))) pool.push(c);
    }
    matchedBy = 'loose';
  }

  if (pool.length === 1) return { status: 'ok', id: pool[0].id, matchedBy };
  if (pool.length > 1) {
    const one = narrowByLabel(pool, tokens);
    if (one) return { status: 'ok', id: one.id, matchedBy: 'label' };
    return { status: 'ambiguous', candidates: pool.map((c) => c.id) };
  }

  // Unknown name before a particle: "Gopal ka 100 udhaar" -> new customer.
  const particles = MERGED.tokens.particles;
  for (let p = 1; p < tokens.length; p++) {
    if (!particles.has(tokens[p])) continue;
    const prev = tokens[p - 1];
    if (!/^[a-z]{3,}$/.test(prev)) continue;
    if (hasAny(MERGED.tokens.payment, [prev]) || hasAny(MERGED.tokens.credit, [prev])) continue;
    if (hasAny(MERGED.tokens.query, [prev]) || hasAny(MERGED.tokens.past, [prev])) continue;
    if (hasAny(MERGED.tokens.today, [prev]) || hasAny(MERGED.tokens.yesterday, [prev]) || hasAny(MERGED.tokens.dayBefore, [prev])) continue;
    if (DATE_MARKERS.has(prev) || /\d/.test(prev)) continue;
    return { status: 'new', newName: cap(prev), matchedBy: 'new' };
  }

  return { status: 'missing' };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function customerName(customers, id) {
  const c = customers.find((x) => x.id === id);
  return c ? c.name : 'Customer';
}
