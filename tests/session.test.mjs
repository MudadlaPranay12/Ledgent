// Session state machine tests - outputs pass/fail at end, no process.exit()
import assert from 'node:assert/strict';
import { MemoryStore, Ledger, balanceFor, entriesFor } from '../js/ledger.js';
import { checkAllGuards, guardAmountVsMedian, guardRecentSameTypeAmount, guardTranscriptConflict } from '../js/guards.js';
import { startDraft, transition, confirmDraft, resetDraft } from '../js/session.js';
import { parseUtterance } from '../js/parser.js';

// Customers used across test file
const customers = [
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala' },
  { id: 'r2', name: 'Ramesh', label: 'Doodh wala' },
  { id: 's1', name: 'Suresh', label: 'Atta chakki' },
  { id: 'm1', name: 'Meena', label: '' },
];

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL:', name, '\n   ', e.message.split('\n')[0]); }
};

// ============= Session State Machine Tests =============
await t('IDLE -> DRAFT on start', async () => {
  const { draft, initialState } = startDraft({ intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 10000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }]});
  assert.strictEqual(initialState, 'draft');
  const result = transition({ state: 'idle', draft }, 'start', []);
  assert.strictEqual(result.state, 'draft');
});

await t('DRAFT -> CONFIRMED on confirm', async () => {
  const { draft } = startDraft({ intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 10000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }]});
  const result = transition({ state: 'draft', draft }, 'confirm', []);
  assert.strictEqual(result.state, 'confirmed');
});

await t('CONFIRMED -> IDLE on reset', async () => {
  const { draft } = startDraft({ intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 10000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }]});
  transition({ state: 'confirmed', draft }, 'confirm', []);
  const result = transition({ state: 'confirmed', draft }, 'reset', []);
  assert.strictEqual(result.state, 'idle');
});

await t('NOTHING written to ledger before confirm after idle', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  const parsed = { intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 50000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }] };
  const { draft } = startDraft(parsed, []);
  assert.strictEqual(store.events.length, 0);
  const result = await confirmDraft({ state: 'confirmed', draft }, ledger);
  assert.strictEqual(result.duplicate, false);
  const ev = await store.allEvents();
  assert.strictEqual(ev.length, 1);
  assert.strictEqual(ev[0].amount_paise, 50000);
});

await t('Same confirm retried with same idempotency_key creates no second event', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  const parsed = { intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }] };
  const { draft } = startDraft(parsed, []);
  const result1 = await confirmDraft({ state: 'confirmed', draft }, ledger);
  assert.strictEqual(result1.duplicate, false);
  const parsed2 = { intent: 'transaction', customer: { status: 'ok', id: 'c1' }, actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }] };
  const { draft: draft2 } = startDraft(parsed2, []);
  draft2.idempotencyKey = result1.event.idempotencyKey;
  const result2 = await confirmDraft({ state: 'confirmed', draft: draft2 }, ledger);
  assert.strictEqual(result2.duplicate, true);
  const ev = await store.allEvents();
  assert.strictEqual(ev.length, 1);
});

// ============= Ambiguous / Missing / Kal / New Customer Tests =============
await t('ambiguous customer status', async () => {
  const customers = [
    { id: 'r1', name: 'Ramesh', label: 'Sabzi wala' },
    { id: 'r2', name: 'Ramesh', label: 'Doodh wala' },
    { id: 's1', name: 'Suresh', label: 'Atta chakki' },
  ];
  const parsed = parseUtterance('Ramesh ka 150 udhaar', { customers, today: '2026-11-11', activeDraft: null });
  assert.strictEqual(parsed.customer.status, 'ambiguous');
  assert.strictEqual(parsed.customer.candidates.length, 2);
});

await t('missing customer name', async () => {
  const parsed = parseUtterance('340 udhaar', { customers: [{ id: 's1', name: 'Suresh', label: 'Atta chakki' }, { id: 'm1', name: 'Meena', label: '' }], today: '2026-11-11', activeDraft: null });
  assert.strictEqual(parsed.customer.status, 'missing');
});

await t('uncertain kal', async () => {
  const parsed = parseUtterance('Suresh ka kal 200 udhaar', { customers: [{ id: 's1', name: 'Suresh', label: 'Atta chakki' }], today: '2026-11-11', activeDraft: null });
  assert.strictEqual(parsed.actions[0].dateUncertain, true);
  assert.strictEqual(parsed.actions[0].occurredOn, null);
});

await t('new customer flow', async () => {
  const parsed = parseUtterance('Gopal ka 100 udhaar', { customers: [{ id: 's1', name: 'Suresh', label: 'Atta chakki' }, { id: 'm1', name: 'Meena', label: '' }], today: '2026-11-11', activeDraft: null });
  assert.strictEqual(parsed.customer.status, 'new');
  assert.strictEqual(parsed.customer.newName, 'Gopal');
});

// ============= Post-commit Correction Tests =============
await t('post-commit correction nets correctly', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  await ledger.post({ customerId: 'c1', type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', txnId: 't1', idempotencyKey: 'k1' });
  const result = await ledger.correct('t1', 43000, 'op1');
  const ev = await store.allEvents();
  assert.strictEqual(ev.length, 3);
  assert.strictEqual(balanceFor(ev, 'c1'), 43000);
  const entries = entriesFor(ev, 'c1').map(x => x.status);
  assert.deepStrictEqual(entries, ['reversed', 'active']);
  assert.strictEqual((await ledger.verify()).ok, true);
});

// ============= Guard Tests =============

await t('Guard 1: flags when amount > 5x median with 3+ entries', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e3', txn_id: 't3', idempotency_key: 'k3', seq: 3, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-13', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', customerName: 'Test',
    candidates: [], actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags.type, 'amount_vs_median');
});

await t('Guard 1: no flag with only 2 past entries', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags, null);
});

await t('Guard 1: no flag when amount reasonable', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 2000, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags, null);
});

// ============= Guard 2: Recent Same Type+Amount =============
await t('Guard 2: flags recent same type+amount within 10 min', async () => {
  const store = new MemoryStore();
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: tenMinAgo.toISOString().slice(0, 10), created_at: tenMinAgo.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags.type, 'recent_same');
});

await t('Guard 2: no flag when > 10 minutes ago', async () => {
  const store = new MemoryStore();
  const oldDate = new Date(Date.now() - 30 * 60 * 1000);
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: oldDate.toISOString().slice(0, 10), created_at: oldDate.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags, null);
});

await t('Guard 2: no flag when different amount', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 5000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags, null);
});

// ============= Guard 3: Transcript Conflict =============
await t('Guard 3: flags transcript conflict', async () => {
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardTranscriptConflict(draft, '123 udhaar');
  assert.strictEqual(flags.type, 'digit_conflict');
});

await t('Guard 3: no conflict when digits match', async () => {
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 12300, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = guardTranscriptConflict(draft, '123 udhaar');
  assert.strictEqual(flags, null);
});

await t('checkAllGuards returns array of flagged results', async () => {
  const store = new MemoryStore();
  // Three past entries are required before the median guard can fire.
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64), hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e3', txn_id: 't3', idempotency_key: 'k3', seq: 3, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-13', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64), hash: '0'.repeat(64) });
  const draft = {
    txn_id: 'tmp_test', customerStatus: 'ok', customerId: 'c1', candidates: [], actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null, idempotencyKey: null,
  };
  const flags = checkAllGuards(draft, [{ id: 'c1', name: 'Test', label: '', reminderOptIn: false }], store.events, '');
  assert.strictEqual(Array.isArray(flags), true);
  assert.strictEqual(flags.length, 1);
  assert.strictEqual(flags[0].type, 'amount_vs_median');
});

// ============= Reminder Tests =============
await t('reminders list only opted-in with balance > 0', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Ramesh', label: 'Sabzi wala', reminderOptIn: true });
  await ledger.post({ customerId: 'c1', type: 'credit', amountPaise: 50000, occurredOn: '2026-11-11', txnId: 't1', idempotencyKey: 'k1' });
  await ledger.addCustomer({ id: 'c2', name: 'Suresh', label: 'Atta chakki', reminderOptIn: false });
  await ledger.post({ customerId: 'c2', type: 'credit', amountPaise: 30000, occurredOn: '2026-11-11', txnId: 't2', idempotencyKey: 'k2' });
  await ledger.addCustomer({ id: 'c3', name: 'Meena', label: '', reminderOptIn: true });
  const ev = await store.allEvents();
  const optedIn = store.customers.filter(c => c.reminderOptIn === true && Math.abs(balanceFor(ev, c.id)) > 0);
  assert.strictEqual(optedIn.length, 1);
  assert.strictEqual(optedIn[0].name, 'Ramesh');
});

await t('default opt-in is false', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  const customer = store.customers.find(c => c.id === 'c1');
  assert.strictEqual(customer.reminderOptIn, false);
});

// Export results to stdout
console.log(`SESSION: ${pass} passed, ${fail} failed`);