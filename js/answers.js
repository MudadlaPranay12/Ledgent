// Spoken answers built from the local ledger. Sentences are rendered in the
// active language; the ledger itself only holds amounts and 'credit'/'payment'.
import { balanceFor, sumFor } from './ledger.js';
import { t } from './i18n.js';

const rupees = (paise) => {
  const r = Math.abs(paise) / 100;
  return Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100);
};

export function answerQuery(parsed, { customers = [], events = [], today, lang = 'hi-IN' } = {}) {
  const kind = parsed.kind;
  const L = lang || 'hi-IN';

  if (kind === 'customer_total') {
    const id = parsed.id || (parsed.candidates && parsed.candidates[0]);
    const c = customers.find((x) => x.id === id);
    if (!c) return { kind, text: t(L, 'ansUnknown') };
    const bal = balanceFor(events, c.id);
    const label = c.label ? ` (${c.label})` : '';
    if (bal > 0) return { kind, text: t(L, 'ansTotal', { name: c.name, label, amount: rupees(bal) }) };
    if (bal < 0) return { kind, text: t(L, 'ansOverpaid', { name: c.name, label, amount: rupees(bal) }) };
    return { kind, text: t(L, 'ansEven', { name: c.name, label }) };
  }

  if (kind === 'today_credit') {
    return { kind, text: t(L, 'ansTodayCredit', { amount: rupees(sumFor(events, today, 'credit')) }) };
  }

  if (kind === 'today_payment') {
    return { kind, text: t(L, 'ansTodayPayment', { amount: rupees(sumFor(events, today, 'payment')) }) };
  }

  if (kind === 'max_owed') {
    let best = null;
    for (const c of customers) {
      const bal = balanceFor(events, c.id);
      if (bal > 0 && (!best || bal > best.bal)) best = { c, bal };
    }
    if (!best) return { kind, text: t(L, 'ansNoOne') };
    return { kind, text: t(L, 'ansMax', { name: best.c.name, amount: rupees(best.bal) }) };
  }

  return { kind, text: t(L, 'ansUnknown') };
}
