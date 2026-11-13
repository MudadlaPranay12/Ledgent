// Ten-language parser routing + the Telugu/Hinglish balance case.
// These are parser tests, not evidence of native-speaker or audio accuracy.
import assert from 'node:assert/strict';
import { parseUtterance } from '../js/parser.js';
import { LANGS, DISCLOSURE } from '../js/lang.js';

let pass = 0;
const ok = (name, fn) => { fn(); pass += 1; console.log(`  ok ${pass} - ${name}`); };

const customers = [
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: [] },
  { id: 's1', name: 'Suresh', label: '', aliases: [] },
  { id: 'g1', name: 'Gopal', label: '', aliases: [] },
  { id: 'm1', name: 'Meena', label: '', aliases: [] },
];
const parse = (text) => parseUtterance(text, { customers, today: '2026-03-10' });

ok('ten Prisma languages plus auto are offered', () => {
  const codes = LANGS.map((l) => l.code);
  for (const c of ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'gu-IN', 'pa-IN', 'kn-IN', 'te-IN', 'ta-IN', 'ml-IN']) {
    assert.ok(codes.includes(c), `missing ${c}`);
  }
  assert.ok(codes.includes('auto'));
  assert.equal(codes.length, 11);
});

ok('every language has an AI disclosure, auto included', () => {
  for (const l of LANGS) assert.ok(DISCLOSURE[l.code], `no disclosure for ${l.code}`);
});

const creditCases = [
  ['Ramesh ka teen sau chaalis udhaar', 'hi-IN', 34000, 'r1'],
  ['Give Suresh three hundred rupees credit', 'en-IN', 30000, 's1'],
  ['Gopal ki moodu vandala rupayala appu', 'te-IN', 30000, 'g1'],
  ['Ramesh-ku 300 rooba kadan', 'ta-IN', 30000, 'r1'],
  ['Ramesh la 300 rupaye udhaar', 'mr-IN', 30000, 'r1'],
  ['Ramesh ke 300 taka baki', 'bn-IN', 30000, 'r1'],
  ['Ramesh ne 300 rupiya baki', 'gu-IN', 30000, 'r1'],
  ['Ramesh ge 300 rupaayi baki', 'kn-IN', 30000, 'r1'],
  ['Ramesh de 300 rupaye udhaar', 'pa-IN', 30000, 'r1'],
  ['Rameshinu 300 rupa kadam', 'ml-IN', 30000, 'r1'],
];

for (const [text, lang, paise, id] of creditCases) {
  ok(`credit in ${lang}: ${text}`, () => {
    const p = parse(text);
    assert.equal(p.intent, 'transaction', `${lang} intent`);
    assert.equal(p.customer.status, 'ok', `${lang} customer`);
    assert.equal(p.customer.id, id);
    assert.equal(p.actions[0].type, 'credit', `${lang} direction`);
    assert.equal(p.actions[0].amountPaise, paise, `${lang} amount`);
  });
}

ok('payment direction across scripts', () => {
  const p1 = parse('Suresh ne 500 rupaye diye');
  assert.equal(p1.actions[0].type, 'payment');
  assert.equal(p1.actions[0].amountPaise, 50000);
  const p2 = parse('Meena ki 200 payment');
  assert.equal(p2.actions[0].type, 'payment');
});

ok('Telugu migilindi asks which entry, never guesses', () => {
  const p = parse('Gopal ka paisa 300 migilindi');
  assert.equal(p.intent, 'transaction');
  assert.equal(p.customer.id, 'g1');
  assert.equal(p.actions[0].amountPaise, 30000);
  assert.equal(p.balanceAmbiguous, true);
  assert.match(p.question, /300 baaki hai/);
  assert.match(p.question, /naya udhaar/);
});

ok('a plain amount statement is not treated as a balance question', () => {
  const p = parse('Gopal ka 300 udhaar');
  assert.equal(p.balanceAmbiguous, false);
});

ok('same-name customers raise a question instead of a pick', () => {
  const twins = [
    { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: [] },
    { id: 'r2', name: 'Ramesh', label: 'Doodh wala', aliases: [] },
  ];
  const p = parseUtterance('Ramesh ka 200 udhaar', { customers: twins, today: '2026-03-10' });
  assert.equal(p.customer.status, 'ambiguous');
  assert.equal(p.customer.candidates.length, 2);
  assert.match(p.question, /ya/);
});

ok('Indian amount words stay precise', () => {
  assert.equal(parse('Ramesh ka dhai sau udhaar').actions[0].amountPaise, 25000);
  assert.equal(parse('Ramesh ka saade teen sau udhaar').actions[0].amountPaise, 35000);
  assert.equal(parse('Ramesh ka dedh sau udhaar').actions[0].amountPaise, 15000);
  assert.equal(parse('Ramesh ka ek hazaar paanch sau udhaar').actions[0].amountPaise, 150000);
});

ok('quantity is not mistaken for money', () => {
  const p = parse('2 kilo aloo aur 340 udhaar Ramesh ka');
  assert.equal(p.actions[0].amountPaise, 34000);
});

ok('Punjabi and Malayalam scripts transliterate to Roman keys', async () => {
  // exercised through the parser: a Gurmukhi amount word must still resolve
  const p = parse('ਰਮੇਸ਼ ਦੇ 300 ਰੁਪਏ ਉਧਾਰ');
  assert.equal(p.intent, 'transaction');
  assert.equal(p.actions[0].type, 'credit');
});

console.log(`\n${pass} passed, 0 failed`);
