// Lexicon registry. Adding a language = add a lexicon file and one entry to
// MODULES. The parser never hard-codes a language word.
import { normalizeText } from '../text.js';
import hi from './hi.js';
import en from './en.js';
import te from './te.js';
import ta from './ta.js';
import mr from './mr.js';
import bn from './bn.js';
import gu from './gu.js';
import kn from './kn.js';
import pa from './pa.js';
import ml from './ml.js';

const MODULES = [hi, en, te, ta, mr, bn, gu, kn, pa, ml];

export const LANGUAGES = MODULES.map(({ code, name, tts, stt }) => ({ code, name, tts: tts || `${code}-IN`, stt: stt || `${code}-IN` }));

const TAGS = ['credit', 'payment', 'gave', 'took', 'past', 'today', 'yesterday', 'dayBefore',
  'correction', 'confirm', 'cancel', 'negation', 'query', 'queryMax', 'balance', 'fillers', 'particles'];

const normWord = (w) => normalizeText(w);

function collect(mod, tag) {
  const src = mod[tag];
  if (!src) return [];
  return (Array.isArray(src) ? src : []).flatMap((w) => {
    const phrase = normWord(w);
    if (!phrase) return [];
    return phrase.includes(' ') ? [{ phrase }] : [{ token: phrase }];
  });
}

function build(mods) {
  const out = { tokens: {}, phrases: {}, labels: new Map() };
  for (const tag of TAGS) out.tokens[tag] = new Set();
  for (const tag of TAGS) out.phrases[tag] = [];

  for (const mod of mods) {
    for (const tag of TAGS) {
      if (tag === 'today' || tag === 'yesterday' || tag === 'dayBefore') continue;
      // Direction words live under mod.direction, everything else at top level.
      const src = tag === 'credit' || tag === 'payment' ? mod.direction?.[tag] : mod[tag];
      for (const w of collect({ [tag]: src }, tag)) {
        if (w.token) out.tokens[tag].add(w.token);
        else out.phrases[tag].push(w.phrase);
      }
    }
    for (const [tag, list] of Object.entries(mod.dates || {})) {
      for (const w of collect({ [tag]: list }, tag)) {
        if (w.token) out.tokens[tag].add(w.token);
        else out.phrases[tag].push(w.phrase);
      }
    }
    for (const [label, words] of Object.entries(mod.labels || {})) {
      if (!out.labels.has(label)) out.labels.set(label, new Set());
      for (const w of words) {
        const n = normWord(w);
        for (const t of n.split(' ')) if (t) out.labels.get(label).add(t);
      }
    }
  }
  return out;
}

export const MERGED = build(MODULES);
const BY_CODE = new Map(MODULES.map((m) => [m.code, build([m])]));

/** Lexicon for one language, falling back to the merged set for robustness. */
export function lexiconFor(code) {
  return (code && BY_CODE.get(code)) || MERGED;
}

/** All tokens across every lexicon (used for "is this word meaningful?"). */
export const ALL_MEANINGFUL = (() => {
  const s = new Set();
  for (const tag of TAGS) for (const t of MERGED.tokens[tag]) s.add(t);
  return s;
})();

export const has = (set, token) => !!set && set.has(token);
export const hasAny = (set, tokens) => tokens.some((t) => set.has(t));
export const labelWords = (label) => {
  const n = normWord(label || '');
  return n.split(' ').filter((t) => t.length >= 3);
};
