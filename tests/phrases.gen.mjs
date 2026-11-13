// Builds tests/phrases.json. Every line below declares what the SHOP MEANT —
// it is a hand-written spec table, not parser output. Run: node tests/phrases.gen.mjs
import fs from 'node:fs';

const TODAY = '2026-11-13';
const YDAY = '2026-11-12';
const out = [];

const credit = (who, id, form, amount, extra = {}) => out.push({
  input: `${who} ka ${form} udhaar`,
  expect: { intent: 'transaction', customer: id, amount, type: 'credit', date: TODAY, ...extra },
});

const AMBIG = 'ambiguous';
const amb = (who, form, amount) => out.push({
  input: `${who} ka ${form} udhaar`,
  expect: { intent: 'transaction', customer: AMBIG, amount, type: 'credit', date: TODAY },
});

// ---------- number forms (value in RUPEES) ----------
const NUMBERS = [
  ['340', 340], ['340 rupay', 340], ['340 rupaye', 340], ['3,400', 3400],
  ['teen sau chalis', 340], ['teen so chalis', 340], ['tin sau chalees', 340],
  ['tiin sau chaaliis', 340], ['तीन सौ चालीस', 340], ['तीन सौ 40', 340],
  ['3 sau 40', 340], ['three-forty', 340], ['three forty', 340],
  ['thirty four zero', 340], ['pachhattar', 75], ['pachattar', 75],
  ['sattar', 70], ['nabbe', 90], ['ek sau', 100], ['do sau', 200],
  ['paanch sau', 500], ['hazaar', 1000], ['ek hazaar', 1000],
  ['ek hazaar paanch sau', 1500], ['pandrah sau', 1500], ['1 hazaar 2 sau', 1200],
  ['do hazaar', 2000], ['dedh sau', 150], ['dhai sau', 250],
  ['saade teen sau', 350], ['sava sau', 125], ['chaar sau pachas', 450],
  ['1,250', 1250], ['bees', 20], ['99', 99], ['101', 101],
];

for (const [form, amount] of NUMBERS) {
  credit('suresh', 's1', form, amount * 100);
  credit('meena', 'm1', form, amount * 100);
  credit('gopal', 'g1', form, amount * 100);
}

// payment direction across a spread of number forms
for (const [form, amount] of NUMBERS.slice(0, 18)) {
  out.push({
    input: `suresh ne ${form} diya`,
    expect: { intent: 'transaction', customer: 's1', amount: amount * 100, type: 'payment', date: TODAY },
  });
}

// ---------- scripts: Devanagari, Telugu, Kannada, Bengali, Gujarati ----------
const scripted = [
  ['सुरेश का 340 उधार', 's1', 34000, 'credit'],
  ['सुरेश को 200 दिया', 's1', 20000, 'credit'],
  ['सुरेश ने 200 दिया', 's1', 20000, 'payment'],
  ['मीना का 100 उधार', 'm1', 10000, 'credit'],
  ['गोपाल का 100 उधार', 'g1', 10000, 'credit'],
  ['सुरेश का तीन सौ चालीस उधार', 's1', 34000, 'credit'],
  ['सुरेश का सवा सौ उधार', 's1', 12500, 'credit'],
  ['सुरेश का ढाई सौ उधार', 's1', 25000, 'credit'],
  ['सुरेश का नब्बे उधार', 's1', 9000, 'credit'],
  ['సురేష్ కి 340 అప్పు', 's1', 34000, 'credit'],
  ['సురేష్ కి ౩౪౦ అప్పు', 's1', 34000, 'credit'],
  ['సురేష్ కి 200 అప్పు', 's1', 20000, 'credit'],
  ['ಸುರೇಶ್ ಗೆ 200 ಸಾಲ', 's1', 20000, 'credit'],
  ['সুরেশ কে 200 ধার', 's1', 20000, 'credit'],
  ['સુરેશ ને 200 ઉધાર', 's1', 20000, 'credit'],
];
for (const [input, id, amount, type] of scripted) {
  out.push({ input, expect: { intent: 'transaction', customer: id, amount, type, date: TODAY } });
}
amb('रमेश', '150', 15000);
out.push({ input: 'రమేష్ కి 150 అప్పు', expect: { intent: 'transaction', customer: AMBIG, amount: 15000, type: 'credit', date: TODAY } });

// ---------- direction ----------
const directions = [
  ['suresh ne 200 diya', 'payment'],
  ['suresh ne 200 diye', 'payment'],
  ['suresh ko 200 diya', 'credit'],
  ['suresh ko 200 diye', 'credit'],
  ['suresh se 200 mila', 'payment'],
  ['suresh se 200 mile', 'payment'],
  ['suresh ka 200 udhaar', 'credit'],
  ['suresh ko 200 udhaar diya', 'credit'],
  ['suresh ne 200 jama kiye', 'payment'],
  ['suresh ka 200 baaki', 'credit'],
  ['suresh ka 200 likho', 'credit'],
  ['suresh ne 200 wapas diya', 'payment'],
  ['suresh se 200 aaya', 'payment'],
  ['suresh ko 200 diya udhaar', 'credit'],
  ['suresh ne 200 paid kiya', 'payment'],
  ['suresh ka 200 udhaar hai', 'credit'],
];
for (const [input, type] of directions) {
  out.push({ input, expect: { intent: 'transaction', customer: 's1', amount: 20000, type, date: TODAY } });
}

// ---------- queries ----------
const queries = [
  ['suresh ka total', { kind: 'customer_total', id: 's1' }],
  ['suresh ka total kitna', { kind: 'customer_total', id: 's1' }],
  ['suresh ka hisab', { kind: 'customer_total', id: 's1' }],
  ['suresh ka balance', { kind: 'customer_total', id: 's1' }],
  ['suresh ka kitna baaki', { kind: 'customer_total', id: 's1' }],
  ['meena ka total', { kind: 'customer_total', id: 'm1' }],
  ['gopal ka total', { kind: 'customer_total', id: 'g1' }],
  ['aaj kitna udhaar gaya', { kind: 'today_credit' }],
  ['aaj kitna udhaar diya', { kind: 'today_credit' }],
  ['aaj kitna aaya', { kind: 'today_payment' }],
  ['aaj kitna mila', { kind: 'today_payment' }],
  ['aaj kitna jama hua', { kind: 'today_payment' }],
  ['sabse zyada baaki kiska hai', { kind: 'max_owed' }],
  ['sabse zyada baaki kaun', { kind: 'max_owed' }],
  ['kitna udhaar aaj', { kind: 'today_credit' }],
];
for (const [input, expect] of queries) {
  out.push({ input, expect: { intent: 'query', ...expect } });
}
out.push({ input: 'ramesh ka total', expect: { intent: 'query', kind: 'customer_total', customer: AMBIG } });

// ---------- corrections ----------
const corrections = [
  ['nahi, 430', 43000], ['nahi 430', 43000], ['nahi, 340', 34000],
  ['galat 430', 43000], ['galat, 500', 50000], ['matlab 430', 43000],
  ['matlab, 340', 34000], ['sorry 430', 43000], ['no 430', 43000],
  ['wrong 430', 43000], ['nahi 1,250', 125000], ['correction 200', 20000],
];
for (const [input, amount] of corrections) {
  out.push({ input, expect: { intent: 'correct', amount } });
}

// ---------- dates ----------
const dates = [
  ['suresh ka aaj 200 udhaar', 's1', 20000, 'credit', TODAY, false],
  ['suresh ka today 200 udhaar', 's1', 20000, 'credit', TODAY, false],
  ['suresh ne kal 200 diya', 's1', 20000, 'payment', YDAY, false],
  ['suresh se kal 200 mila', 's1', 20000, 'payment', YDAY, false],
  ['suresh ne parso 200 diya', 's1', 20000, 'payment', '2026-11-11', false],
  ['suresh ka 10 tareekh ko 200 udhaar', 's1', 20000, 'credit', '2026-11-10', false],
  ['suresh ka 5 tareekh 100 udhaar', 's1', 10000, 'credit', '2026-11-05', false],
  ['suresh ka kal 300 udhaar', 's1', 30000, 'credit', null, true],
  ['suresh ka parso 200 udhaar', 's1', 20000, 'credit', null, true],
];
for (const [input, id, amount, type, date, uncertain] of dates) {
  out.push({ input, expect: { intent: 'transaction', customer: id, amount, type, date, dateUncertain: uncertain } });
}
out.push({ input: 'aaj 200 udhaar', expect: { intent: 'transaction', customer: 'missing', amount: 20000, type: 'credit', date: TODAY } });

// ---------- two Rameshes ----------
amb('ramesh', '150', 15000);
out.push({ input: 'ramesh ko 200 diya', expect: { intent: 'transaction', customer: AMBIG, amount: 20000, type: 'credit', date: TODAY } });
out.push({ input: 'ramesh ne 200 diya', expect: { intent: 'transaction', customer: AMBIG, amount: 20000, type: 'payment', date: TODAY } });
out.push({ input: 'ramesh bhaiya ka 150 udhaar', expect: { intent: 'transaction', customer: AMBIG, amount: 15000, type: 'credit', date: TODAY } });
out.push({ input: 'रमेश का 100 उधार', expect: { intent: 'transaction', customer: AMBIG, amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'రమేష్ కి 100 అప్పు', expect: { intent: 'transaction', customer: AMBIG, amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'sabzi wale ramesh ka 200 udhaar', expect: { intent: 'transaction', customer: 'r1', amount: 20000, type: 'credit', date: TODAY } });
out.push({ input: 'doodh wale ramesh ka 350 udhaar', expect: { intent: 'transaction', customer: 'r2', amount: 35000, type: 'credit', date: TODAY } });
out.push({ input: 'ramesh sabzi ka 100 udhaar', expect: { intent: 'transaction', customer: 'r1', amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'ramesh doodh ka 100 udhaar', expect: { intent: 'transaction', customer: 'r2', amount: 10000, type: 'credit', date: TODAY } });

// ---------- noisy / ASR junk ----------
for (const input of [
  'um suresh ka 340 udhaar',
  'aaa suresh ka 340 udhaar',
  'suresh ka 340 udhaar bhaiya',
  'suresh bhaiya ka 340 udhaar',
  'suresh ka three four zero udhaar',
  'suresh ka teen char shunya udhaar',
  'suresh ka 340 udhaar rupaye',
  'suresh ka 340 rs udhaar',
  'suresh ka 340 ₹ udhaar',
  'suresh ka 340 udhaar ji',
]) {
  out.push({ input, expect: { intent: 'transaction', customer: 's1', amount: 34000, type: 'credit', date: TODAY } });
}

// ---------- new customers ----------
out.push({ input: 'kishan ka 100 udhaar', expect: { intent: 'transaction', customer: 'new', newName: 'Kishan', amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'bhavesh ka 250 udhaar', expect: { intent: 'transaction', customer: 'new', newName: 'Bhavesh', amount: 25000, type: 'credit', date: TODAY } });
out.push({ input: 'kishan ko 100 diya', expect: { intent: 'transaction', customer: 'new', newName: 'Kishan', amount: 10000, type: 'credit', date: TODAY } });

// ---------- confidence ----------
out.push({ input: 'suresh ka 340 udhaar do sau', expect: { intent: 'transaction', customer: 's1', amount: 34000, type: 'credit', date: TODAY, flags: ['digit_word_mismatch'], level: 'low' } });
out.push({ input: 'suresh ka 3 sau chalis udhaar do sau', expect: { intent: 'transaction', customer: 's1', amount: 34000, type: 'credit', date: TODAY, flags: ['digit_word_mismatch'], level: 'low' } });
out.push({ input: 'suresh ka 340 udhaar teen sau chalees', expect: { intent: 'transaction', customer: 's1', amount: 34000, type: 'credit', date: TODAY, level: 'high' } });
out.push({ input: 'suresh ka 9000 udhaar', expect: { intent: 'transaction', customer: 's1', amount: 900000, type: 'credit', date: TODAY, flags: ['outside_usual_range'] } });

// ---------- confirm / cancel ----------
for (const input of ['haan', 'haan ji', 'theek hai', 'sahi', 'ok']) {
  out.push({ input, expect: { intent: 'confirm' } });
}
for (const input of ['nahi', 'cancel', 'ruko']) {
  out.push({ input, expect: { intent: 'cancel' } });
}

// ---------- labels ----------
out.push({ input: 'suresh atta ka 100 udhaar', expect: { intent: 'transaction', customer: 's1', amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'suresh chakki ka 100 udhaar', expect: { intent: 'transaction', customer: 's1', amount: 10000, type: 'credit', date: TODAY } });
out.push({ input: 'suresh ka 150 udhaar', expect: { intent: 'transaction', customer: 's1', amount: 15000, type: 'credit', date: TODAY } });

// duplicate inputs are removed, first expectation wins
const seen = new Set();
const uniq = out.filter((p) => (seen.has(p.input) ? false : (seen.add(p.input), true)));

fs.writeFileSync(new URL('./phrases.json', import.meta.url), JSON.stringify({ today: TODAY, phrases: uniq }, null, 2) + '\n');
console.log(`wrote ${uniq.length} phrases to tests/phrases.json`);
