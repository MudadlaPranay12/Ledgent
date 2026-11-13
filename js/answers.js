// Spoken answers built from the local ledger with fixed templates.
// Pure: give it events + customers, it returns the sentence to speak.
import { balanceFor, sumFor } from './ledger.js';

const rupees = (paise) => {
  const r = Math.abs(paise) / 100;
  return Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100);
};

export function answerQuery(parsed, { customers = [], events = [], today }) {
  const kind = parsed.kind;

  if (kind === 'customer_total') {
    const id = parsed.id || (parsed.candidates && parsed.candidates[0]);
    const c = customers.find((x) => x.id === id);
    if (!c) return { kind, text: 'Kiska total, yeh samajh nahi aaya.' };
    const bal = balanceFor(events, c.id);
    const label = c.label ? ` (${c.label})` : '';
    if (bal > 0) return { kind, text: `${c.name}${label} ka ${rupees(bal)} rupay baaki hai.` };
    if (bal < 0) return { kind, text: `${c.name}${label} ka ${rupees(bal)} rupay humne zyada le liya hai.` };
    return { kind, text: `${c.name}${label} ka hisab barabar hai, kuch baaki nahi.` };
  }

  if (kind === 'today_credit') {
    const total = sumFor(events, today, 'credit');
    return { kind, text: `Aaj ${rupees(total)} rupay ka udhaar gaya.` };
  }

  if (kind === 'today_payment') {
    const total = sumFor(events, today, 'payment');
    return { kind, text: `Aaj ${rupees(total)} rupay aaya.` };
  }

  if (kind === 'max_owed') {
    let best = null;
    for (const c of customers) {
      const bal = balanceFor(events, c.id);
      if (bal > 0 && (!best || bal > best.bal)) best = { c, bal };
    }
    if (!best) return { kind, text: 'Kisi ka bhi kuch baaki nahi hai.' };
    return { kind, text: `Sabse zyada baaki ${best.c.name} ka hai, ${rupees(best.bal)} rupay.` };
  }

  return { kind, text: 'Yeh sawaal samajh nahi aaya.' };
}
