// ADVERSARIAL SET — 30 phrases written after the parser was frozen and NOT used
// while developing it. Run exactly as written; reported separately from the
// main corpus. Expectations are what a shopkeeper meant, not parser output.
import { parseUtterance } from '../js/parser.js';

const TODAY = '2026-11-13';
const customers = [
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: ['ramesh sabzi'] },
  { id: 'r2', name: 'Ramesh', label: 'Doodh wala', aliases: ['ramesh doodh'] },
  { id: 's1', name: 'Suresh', label: 'Atta chakki', aliases: ['suresh atta'] },
  { id: 'm1', name: 'Meena', label: '', aliases: [] },
  { id: 'g1', name: 'Gopal', label: '', aliases: [] },
];
const ctx = { customers, today: TODAY };

const CASES = [
  { input: 'suresh ka 2 hazaar 5 sau udhaar', customer: 's1', amount: 250000, type: 'credit', date: TODAY },
  { input: 'suresh ne 1 hazaar 2 sau jama kiye', customer: 's1', amount: 120000, type: 'payment', date: TODAY },
  { input: 'मीना को 250 उधार दिया', customer: 'm1', amount: 25000, type: 'credit', date: TODAY },
  { input: 'गोपाल ने 300 दिया', customer: 'g1', amount: 30000, type: 'payment', date: TODAY },
  { input: 'suresh ka 75 rupay udhaar', customer: 's1', amount: 7500, type: 'credit', date: TODAY },
  { input: 'tin sau chalees rupay udhaar suresh', customer: 's1', amount: 34000, type: 'credit', date: TODAY },
  { input: 'suresh 340 udhaar', customer: 's1', amount: 34000, type: 'credit', date: TODAY },
  { input: 'suresh ka 340', customer: 's1', amount: 34000, type: null, date: TODAY },
  { input: 'suresh ko 200 udhaar', customer: 's1', amount: 20000, type: 'credit', date: TODAY },
  { input: 'suresh se 200 wapas mila', customer: 's1', amount: 20000, type: 'payment', date: TODAY },
  { input: 'nahi 430 kar do', customer: null, intent: 'correct', amount: 43000 },
  { input: 'galat hai 340', customer: null, intent: 'correct', amount: 34000 },
  { input: 'suresh ka total batao', customer: 's1', intent: 'query', kind: 'customer_total' },
  { input: 'aaj ka total udhaar', customer: null, intent: 'query', kind: 'today_credit' },
  { input: 'aaj kitna payment aaya', customer: null, intent: 'query', kind: 'today_payment' },
  { input: 'kiska sabse zyada baaki hai', customer: null, intent: 'query', kind: 'max_owed' },
  { input: 'sabzi wala ramesh 100 udhaar', customer: 'r1', amount: 10000, type: 'credit', date: TODAY },
  { input: 'doodh wala ramesh ko 50 diya', customer: 'r2', amount: 5000, type: 'credit', date: TODAY },
  { input: 'suresh ka 10 tareekh 500 udhaar', customer: 's1', amount: 50000, type: 'credit', date: '2026-11-10' },
  { input: 'suresh ne kal 150 diya', customer: 's1', amount: 15000, type: 'payment', date: '2026-11-12' },
  { input: 'suresh ka parso 100 udhaar', customer: 's1', amount: 10000, type: 'credit', date: null },
  { input: 'suresh ka 1 lakh udhaar', customer: 's1', amount: 10000000, type: 'credit', date: TODAY },
  { input: 'suresh ka dedh hazaar udhaar', customer: 's1', amount: 150000, type: 'credit', date: TODAY },
  { input: 'suresh ka saade chaar sau udhaar', customer: 's1', amount: 45000, type: 'credit', date: TODAY },
  { input: 'suresh ka pachas udhaar', customer: 's1', amount: 5000, type: 'credit', date: TODAY },
  { input: 'suresh ka unnis udhaar', customer: 's1', amount: 1900, type: 'credit', date: TODAY },
  { input: 'suresh ka 3 sau 45 udhaar', customer: 's1', amount: 34500, type: 'credit', date: TODAY },
  { input: 'suresh ka 340 udhaar 430', customer: 's1', amount: 34000, type: 'credit', date: TODAY },
  { input: 'meena ko 100 diya udhaar', customer: 'm1', amount: 10000, type: 'credit', date: TODAY },
  { input: 'vikram ka 200 udhaar', customer: 'new', newName: 'Vikram', amount: 20000, type: 'credit', date: TODAY },
];

let pass = 0;
const failures = [];

for (const c of CASES) {
  const parsed = parseUtterance(c.input, ctx);
  const errs = [];
  if (c.intent && parsed.intent !== c.intent) errs.push(`intent ${parsed.intent}`);
  if (!c.intent) {
    if (parsed.intent !== 'transaction') errs.push(`intent ${parsed.intent}`);
    const cust = parsed.customer || {};
    if (c.customer === 'new') {
      if (cust.status !== 'new' || cust.newName !== c.newName) errs.push(`customer ${cust.status}:${cust.newName}`);
    } else if (c.customer && (cust.status !== 'ok' || cust.id !== c.customer)) {
      errs.push(`customer ${cust.status}:${cust.id}`);
    }
    const a = parsed.actions?.[0] || {};
    if (a.amountPaise !== c.amount) errs.push(`amount ${a.amountPaise}`);
    if (a.type !== c.type) errs.push(`type ${a.type}`);
    if (a.occurredOn !== c.date) errs.push(`date ${a.occurredOn}`);
  } else if (c.kind && parsed.kind !== c.kind) {
    errs.push(`kind ${parsed.kind}`);
  }
  if (errs.length) failures.push({ input: c.input, errs });
  else pass++;
}

const rate = ((pass / CASES.length) * 100).toFixed(1);
console.log(`ADVERSARIAL: ${pass} passed, ${failures.length} failed (${CASES.length} total) — pass rate ${rate}%`);
for (const f of failures) console.log(`- "${f.input}" -> ${f.errs.join('; ')}`);
process.exitCode = failures.length ? 1 : 0;
