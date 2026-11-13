// Runs tests/phrases.json against the parser and prints EVERY failure.
// Expectations were written by hand (see phrases.gen.mjs), never from parser output.
import fs from 'node:fs';
import { parseUtterance } from '../js/parser.js';

const data = JSON.parse(fs.readFileSync(new URL('./phrases.json', import.meta.url), 'utf8'));
const TODAY = data.today;
const phrases = data.phrases;

const customers = [
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: ['ramesh sabzi'] },
  { id: 'r2', name: 'Ramesh', label: 'Doodh wala', aliases: ['ramesh doodh'] },
  { id: 's1', name: 'Suresh', label: 'Atta chakki', aliases: ['suresh atta'] },
  { id: 'm1', name: 'Meena', label: '', aliases: [] },
  { id: 'g1', name: 'Gopal', label: '', aliases: [] },
];
const ctx = {
  customers,
  today: TODAY,
  customerStats: (id) => (id === 's1' ? { medianPaise: 25000, count: 3 } : null),
};

let pass = 0;
const failures = [];

for (const p of phrases) {
  const parsed = parseUtterance(p.input, ctx);
  const errs = [];

  if (p.expect.intent === 'transaction') {
    if (parsed.intent !== 'transaction') {
      errs.push(`intent ${parsed.intent}`);
    } else {
      const c = parsed.customer || {};
      if (p.expect.customer === 'ambiguous') {
        if (c.status !== 'ambiguous') errs.push(`customer ${c.status} (wanted ambiguous)`);
      } else if (p.expect.customer === 'new') {
        if (c.status !== 'new') errs.push(`customer ${c.status} (wanted new)`);
        else if (p.expect.newName && c.newName !== p.expect.newName) errs.push(`newName ${c.newName}`);
      } else if (p.expect.customer === 'missing') {
        if (c.status !== 'missing') errs.push(`customer ${c.status} (wanted missing)`);
      } else if (c.status !== 'ok' || c.id !== p.expect.customer) {
        errs.push(`customer ${c.status}:${c.id || (c.candidates || []).join('|')}`);
      }
      const a = parsed.actions?.[0] || {};
      if (p.expect.amount != null && a.amountPaise !== p.expect.amount) errs.push(`amount ${a.amountPaise} wanted ${p.expect.amount}`);
      if (p.expect.type && a.type !== p.expect.type) errs.push(`type ${a.type} wanted ${p.expect.type}`);
      if ('date' in p.expect && a.occurredOn !== p.expect.date) errs.push(`date ${a.occurredOn} wanted ${p.expect.date}`);
      if ('dateUncertain' in p.expect && !!a.dateUncertain !== p.expect.dateUncertain) errs.push(`dateUncertain ${a.dateUncertain}`);
      if (p.expect.level && parsed.confidence?.level !== p.expect.level) errs.push(`level ${parsed.confidence?.level}`);
      for (const flag of p.expect.flags || []) {
        if (!(parsed.confidence?.reasons || []).includes(flag)) errs.push(`missing flag ${flag}`);
      }
    }
  } else if (p.expect.intent === 'query') {
    if (parsed.intent !== 'query') errs.push(`intent ${parsed.intent}`);
    if (p.expect.kind && parsed.kind !== p.expect.kind) errs.push(`kind ${parsed.kind}`);
    if (p.expect.id && parsed.id !== p.expect.id) errs.push(`id ${parsed.id}`);
    if (p.expect.customer === 'ambiguous' && parsed.customer?.status !== 'ambiguous') errs.push('customer not ambiguous');
  } else if (p.expect.intent === 'correct') {
    if (parsed.intent !== 'correct') errs.push(`intent ${parsed.intent}`);
    if (p.expect.amount != null && parsed.amountPaise !== p.expect.amount) errs.push(`amount ${parsed.amountPaise}`);
  } else {
    if (parsed.intent !== p.expect.intent) errs.push(`intent ${parsed.intent}`);
  }

  if (errs.length) failures.push({ input: p.input, expect: p.expect, actual: summarise(parsed), errs });
  else pass++;
}

function summarise(parsed) {
  const a = parsed.actions?.[0] || {};
  const c = parsed.customer || {};
  return {
    intent: parsed.intent,
    kind: parsed.kind,
    customer: c.status === 'ok' ? c.id : c.status === 'new' ? `new:${c.newName}` : c.status,
    amount: a.amountPaise,
    type: a.type,
    date: a.occurredOn,
    level: parsed.confidence?.level,
    reasons: parsed.confidence?.reasons,
  };
}

const rate = ((pass / phrases.length) * 100).toFixed(1);
console.log(`PHRASES: ${pass} passed, ${failures.length} failed (${phrases.length} total) — pass rate ${rate}%`);
if (failures.length) {
  console.log('\nFAILURES (input | expected | actual):');
  for (const f of failures) {
    console.log(`- "${f.input}"`);
    console.log(`    expected ${JSON.stringify(f.expect)}`);
    console.log(`    actual   ${JSON.stringify(f.actual)}`);
    console.log(`    diff     ${f.errs.join('; ')}`);
  }
}
process.exitCode = failures.length ? 1 : 0;
