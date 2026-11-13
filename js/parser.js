// Deterministic parser (Lane 1). Runs on the phone. Never saves anything:
// it only proposes a draft. All language words come from js/lexicon/*.
import { tokenize, extractAmounts, isNumberWord, digitsSpoken } from './numbers.js';
import { phoneticKey, normalizeText } from './text.js';
import { MERGED, labelWords, hasAny } from './lexicon/index.js';
import { matchCustomer } from './customers.js';

const L = MERGED.tokens;
const SEPARATORS = new Set(['aur', 'and', 'phir', 'fir', 'then', 'tatha', 'plus']);
const CLAUSE_BREAK = new Set([',']);

export const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const hasPhrase = (text, tag) => (MERGED.phrases[tag] || []).some((p) => text.includes(p));

/** Which way does the money move? null means "ask, never guess". */
export function detectDirection(words) {
  const credit = hasAny(L.credit, words);
  const payment = hasAny(L.payment, words);
  const gave = hasAny(L.gave, words);
  const ne = words.includes('ne');
  const ko = words.includes('ko');
  const se = words.includes('se');

  if (credit && !payment) return 'credit';
  if (payment && !credit) return 'payment';
  if (gave && ne) return 'payment';   // "Ramesh ne 200 diya" -> Ramesh paid us
  if (gave && ko) return 'credit';    // "Ramesh ko 200 diya" -> we gave credit
  if (gave && (credit || payment)) return credit ? 'credit' : 'payment';
  if (gave) return null;              // bare "diya" is genuinely ambiguous
  if (se && payment) return 'payment';
  return null;
}

/** Resolve a day-of-month like "10 tareekh" against the shop's local today. */
export function resolveDayOfMonth(day, today) {
  const [y, m] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const thisMonth = `${y}-${pad(m)}-${pad(day)}`;
  if (thisMonth <= today) return thisMonth;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${pad(pm)}-${pad(day)}`;
}

export function detectDate(words, today, text = '') {
  if (hasAny(L.today, words) || hasPhrase(text, 'today')) return { date: today };
  const past = hasAny(L.past, words);

  if (hasPhrase(text, 'dayBefore') || hasAny(L.dayBefore, words)) {
    return past ? { date: addDays(today, -2) } : { date: null, uncertain: true, word: 'parso' };
  }
  for (const w of words) {
    if (L.yesterday.has(w)) return past ? { date: addDays(today, -1) } : { date: null, uncertain: true, word: w };
  }
  // "10 tareekh" / "10 tarikh"
  for (let i = 1; i < words.length; i++) {
    if (words[i] === 'tareekh' || words[i] === 'tarikh' || words[i] === 'date') {
      const d = Number(words[i - 1]);
      if (Number.isInteger(d) && d >= 1 && d <= 31) return { date: resolveDayOfMonth(d, today), dayOfMonth: d };
    }
  }
  return { date: today };
}

function splitClauses(tokens) {
  const clauses = [];
  let cl = [];
  for (const t of tokens) {
    if (CLAUSE_BREAK.has(t) || SEPARATORS.has(t)) { if (cl.length) clauses.push(cl); cl = []; }
    else cl.push(t);
  }
  if (cl.length) clauses.push(cl);

  const out = [];
  for (const c of clauses) {
    const am = extractAmounts(c);
    if (am.length < 2) { out.push(c); continue; }
    let from = 0;
    for (let k = 1; k < am.length; k++) {
      let cut = am[k].start;
      if (cut > 0 && (L.today.has(c[cut - 1]) || L.yesterday.has(c[cut - 1]))) cut--;
      out.push(c.slice(from, cut));
      from = cut;
    }
    out.push(c.slice(from));
  }
  return out.filter((c) => c.length);
}

/** Is this utterance just an amount and/or a correction word? */
function isBareAmount(words) {
  const meaningful = words.filter((w) => w !== ',');
  return meaningful.length <= 3 && meaningful.every((w) => /^\d+$/.test(w) || isNumberWord(w) ||
    L.correction.has(w) || L.confirm.has(w) || L.fillers.has(w));
}

/**
 * @returns parsed utterance
 * intent: transaction | query | correct | confirm | cancel | seal | choose_customer |
 *         choose_type | unknown | empty
 */
export function parseUtterance(text, ctx = {}) {
  const customers = ctx.customers || [];
  const today = ctx.today || new Date().toISOString().slice(0, 10);
  const activeDraft = ctx.activeDraft || null;
  const raw = String(text ?? '');
  const normalized = normalizeText(raw);
  const tokens = tokenize(raw);
  const words = tokens.filter((t) => t !== ',');
  if (!words.length) return { intent: 'empty', normalized, raw };

  const amounts = extractAmounts(tokens);
  const hasAmount = amounts.length > 0;
  const first = words[0];
  const direction = detectDirection(words);
  const dateInfo = detectDate(words, today, normalized);
  const customer = matchCustomer(words, customers);

  // ---- Day seal ----
  if (/din band|seal day|din khatam/.test(normalized)) {
    return { intent: 'seal', normalized, raw, customer, confidence: { score: 1, level: 'high', reasons: [] } };
  }

  // ---- Plain confirmation / cancellation ----
  const withoutFillers = words.filter((w) => !L.fillers.has(w));
  if (!hasAmount) {
    if (L.confirm.has(first) && withoutFillers.length <= 4 && !L.query.has(first)) {
      return { intent: 'confirm', normalized, raw, confidence: { score: 1, level: 'high', reasons: [] } };
    }
    if (L.cancel.has(first) || (L.negation.has(first) && withoutFillers.length <= 2 && !activeDraft)) {
      return { intent: 'cancel', normalized, raw, confidence: { score: 1, level: 'high', reasons: [] } };
    }
  }

  // ---- Corrections ----
  const correctionHit = hasAny(L.correction, words) || words.some((w) => w === 'matlab' || w === 'galat');
  const bare = isBareAmount(words);
  if (hasAmount && (correctionHit || (bare && activeDraft && !direction))) {
    const amt = amounts[0].paise;
    if (correctionHit && L.correction.has(first) && !hasAny(L.query, words) && words.length <= 6) {
      return {
        intent: 'correct', amountPaise: amt, type: direction,
        confidence: { score: 0.95, level: 'high', reasons: [] }, normalized, raw,
        needsConfirmation: false,
      };
    }
    if (bare && activeDraft) {
      return {
        intent: 'correct', amountPaise: amt, type: direction,
        confidence: { score: 0.9, level: 'high', reasons: ['bare_amount'] }, normalized, raw,
        needsConfirmation: false,
      };
    }
  }

  // ---- Draft follow-ups: choose customer / choose type ----
  if (activeDraft && activeDraft.customerStatus && activeDraft.customerStatus !== 'ok') {
    const pool = activeDraft.candidates?.length
      ? customers.filter((c) => activeDraft.candidates.includes(c.id))
      : customers;
    const hits = pool.filter((c) => {
      const keys = [c.name, ...(c.aliases || [])].map((k) => phoneticKey(normalizeText(k)));
      return words.some((w) => keys.includes(phoneticKey(w)));
    });
    const byLabel = pool.filter((c) => labelWords(c.label).some((l) => words.includes(l)));
    const pick = byLabel.length === 1 ? byLabel : hits;
    if (pick.length === 1) return { intent: 'choose_customer', id: pick[0].id, normalized, raw };
    if (pool.length >= 2 && words.length <= 3) {
      if (['pehla', 'first', '1'].includes(first)) return { intent: 'choose_customer', id: pool[0].id, normalized, raw };
      if (['dusra', 'doosra', 'second', '2'].includes(first)) return { intent: 'choose_customer', id: pool[1].id, normalized, raw };
    }
  }
  if (activeDraft && !hasAmount && !direction && activeDraft.actions?.some((a) => !a.type)) {
    return { intent: 'choose_type', type: direction, normalized, raw };
  }

  // ---- Queries ----
  if (!hasAmount) {
    const queryHit = hasAny(L.query, words) || words.includes('kitna') || words.includes('kitne');
    const maxHit = hasAny(L.queryMax, words) && words.includes('baaki');
    const isToday = hasAny(L.today, words);
    if (maxHit) return { intent: 'query', kind: 'max_owed', normalized, raw, customer };
    if (queryHit) {
      if (isToday && (hasAny(L.credit, words) || words.includes('gaya') || words.includes('diya'))) {
        return { intent: 'query', kind: 'today_credit', normalized, raw, customer };
      }
      if (isToday && (hasAny(L.payment, words) || words.includes('aaya') || words.includes('mila'))) {
        return { intent: 'query', kind: 'today_payment', normalized, raw, customer };
      }
      if (customer.status === 'ok') return { intent: 'query', kind: 'customer_total', id: customer.id, normalized, raw, customer };
      if (customer.status === 'ambiguous') return { intent: 'query', kind: 'customer_total', candidates: customer.candidates, normalized, raw, customer };
      if (isToday) return { intent: 'query', kind: 'today_credit', normalized, raw, customer };
    }
    return { intent: 'unknown', normalized, raw, customer, question: 'Samajh nahi aaya. Dobara boliye?' };
  }

  // ---- Transactions ----
  const actions = [];
  for (const cl of splitClauses(tokens)) {
    const am = extractAmounts(cl);
    if (!am.length) continue;
    const d = detectDate(cl, today, normalizeText(cl.join(' ')));
    actions.push({
      type: detectDirection(cl),
      amountPaise: am[0].paise,
      occurredOn: d.date,
      dateUncertain: !!d.uncertain,
      dateWord: d.word || null,
      dayOfMonth: d.dayOfMonth || null,
    });
  }
  if (!actions.length) return { intent: 'unknown', normalized, raw, customer };

  // ---- Confidence ----
  const reasons = [];
  const digitAmounts = amounts.filter((a) => a.digits && !a.digitString);
  const wordAmounts = amounts.filter((a) => !a.digits && !a.digitString);
  if (digitAmounts.length && wordAmounts.length &&
      !digitAmounts.some((d) => wordAmounts.some((w) => w.paise === d.paise))) {
    reasons.push('digit_word_mismatch');
  }
  if (amounts.some((a) => a.fuzzy)) reasons.push('noisy');
  if (words.length <= 2) reasons.push('short_transcript');
  if (!actions[0].type) reasons.push('unclear_direction');
  if (actions.some((a) => a.dateUncertain)) reasons.push('date_ambiguous');
  if (ctx.customerStats) {
    const stat = ctx.customerStats(customer.status === 'ok' ? customer.id : null);
    if (stat && stat.medianPaise > 0 && actions[0].amountPaise > stat.medianPaise * 5) reasons.push('outside_usual_range');
  }

  const penalty = reasons.reduce((s, r) => s + (r === 'digit_word_mismatch' ? 0.55 : r === 'outside_usual_range' ? 0.25 : 0.2), 0);
  const score = Math.max(0, Math.min(1, 1 - penalty));
  const level = score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low';

  let question = null;
  if (reasons.includes('unclear_direction')) question = 'Udhaar ya payment?';
  else if (reasons.includes('date_ambiguous')) question = `Kal se matlab ${addDays(today, -1)}? Ya aaj?`;
  else if (customer.status === 'ambiguous') {
    const names = customer.candidates.map((id) => {
      const c = customers.find((x) => x.id === id);
      return c ? `${c.label ? c.label.replace(/ wala$/i, ' wale ') : ''}${c.name}`.trim() : id;
    });
    question = names.length === 2 ? `${names[0]} ya ${names[1]}?` : `${names.join(' ya ')}?`;
  } else if (customer.status === 'new') question = `Naya customer ${customer.newName} banaun?`;
  else if (customer.status === 'missing') question = 'Kiska hisab?';

  const readbackDigits = level === 'low' ? digitsSpoken(actions[0].amountPaise) : null;
  if (readbackDigits) question = `${readbackDigits}, sahi?`;

  // "Gopal ka paisa 300 migilindi" says money is LEFT, not that a new entry
  // happened. Ask which one the shopkeeper means; never guess.
  let balanceAmbiguous = false;
  if (hasAmount && hasAny(L.balance, words) && customer.status === 'ok') {
    const c = customers.find((x) => x.id === customer.id);
    const name = c ? c.name : 'Customer';
    const rs = Math.round(actions[0].amountPaise / 100);
    balanceAmbiguous = true;
    question = `${name} ka total \u20b9${rs} baaki hai, ya \u20b9${rs} ka naya udhaar likhun?`;
  }

  return {
    intent: 'transaction', customer, actions, ambiguous: actions.length > 1,
    confidence: { score, level, reasons }, question, readbackDigits, balanceAmbiguous,
    needsConfirmation: level !== 'high' || customer.status !== 'ok' || !!question,
    normalized, raw,
  };
}

export const parse = parseUtterance;
