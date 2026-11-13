import assert from 'node:assert/strict';
import { MemoryStore } from '../js/ledger.js';
import { checkAllGuards, guardAmountVsMedian, guardRecentSameTypeAmount, guardTranscriptConflict } from '../js/guards.js';

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL:', name, '\n   ', e.message.split('\n')[0]); }
};

// ============= Guard 1: Amount vs Median =============

// Guard 1: flag when amount > 5x median past amount (need 3+ past entries)
await t('Guard 1: flags when amount > 5x median with 3+ past entries', async () => {
  const store = new MemoryStore();
  // Add exactly 3 past entries of 1000 paise each
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e3', txn_id: 't3', idempotency_key: 'k3', seq: 3, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-13', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags.type, 'amount_vs_median');
});

// Guard 1: no flag when only 2 past entries (below threshold)
await t('Guard 1: no flag with only 2 past entries', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags, null);
});

// Guard 1: no flag when amount is not > 5x median
await t('Guard 1: no flag when amount reasonable', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 2000, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags, null);
});

// ============= Guard 2: Recent Same Type+Amount =============

// Guard 2: 10-minute duplicate detection
await t('Guard 2: flags recent same type+amount within 10 min', async () => {
  const store = new MemoryStore();
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: tenMinAgo.toISOString().slice(0, 10), created_at: tenMinAgo.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags.type, 'recent_same');
});

// Guard 2: no flag when more than 10 minutes ago
await t('Guard 2: no flag when > 10 minutes ago', async () => {
  const store = new MemoryStore();
  const now = new Date();
  const oldDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: oldDate.toISOString().slice(0, 10), created_at: oldDate.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags, null);
});

// Guard 2: no flag when different amount
await t('Guard 2: no flag when different amount', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags, null);
});

// ============= Guard 3: Transcript Conflict =============

// Guard 3: transcript digits conflict with spoken form
await t('Guard 3: flags transcript conflict', async () => {
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardTranscriptConflict(draft, '123 udhaar');
  assert.strictEqual(flags.type, 'digit_conflict');
});

// Guard 3: no flag when digits match
await t('Guard 3: no flag when digits match', async () => {
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 12300, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardTranscriptConflict(draft, '123 udhaar');
  assert.strictEqual(flags, null);
});

// ============= checkAllGuards =============

await t('checkAllGuards returns array of flagged results', async () => {
  const store = new MemoryStore();
  // Three past entries are required before the median guard can fire.
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64), hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e3', txn_id: 't3', idempotency_key: 'k3', seq: 3, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-13', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64), hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = checkAllGuards(draft, [{ id: 'c1', name: 'Test', label: '', reminderOptIn: false }], store.events, '');
  assert.strictEqual(Array.isArray(flags), true);
  assert.strictEqual(flags.length, 1);
  assert.strictEqual(flags[0].type, 'amount_vs_median');
});

// ============= Combined Guard Tests =============

await t('Guard 1 with 2 entries returns null (below threshold)', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags, null);
});

// Guard 1 with exactly 3 entries and amount > 5x median
await t('Guard 1 with exactly 3 entries and amount > 5x median flags', async () => {
  const store = new MemoryStore();
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-11', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e2', txn_id: 't2', idempotency_key: 'k2', seq: 2, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-12', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  await store.putEvent({ event_id: 'e3', txn_id: 't3', idempotency_key: 'k3', seq: 3, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 1000, occurred_on: '2026-11-13', created_at: new Date().toISOString(), reverses_event_id: null, prev_hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 5001, occurredOn: '2026-11-14', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardAmountVsMedian(draft, store.events);
  assert.strictEqual(flags.type, 'amount_vs_median');
});

// Guard 2 recent same type+amount within 10 min
await t('Guard 2 flags recent duplicate', async () => {
  const store = new MemoryStore();
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: tenMinAgo.toISOString().slice(0, 10), created_at: tenMinAgo.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags.type, 'recent_same');
});

// Guard 2 no flag when > 10 min
await t('Guard 2 no flag when > 10 minutes', async () => {
  const store = new MemoryStore();
  const oldDate = new Date(Date.now() - 30 * 60 * 1000);
  
  await store.putEvent({ event_id: 'e1', txn_id: 't1', idempotency_key: 'k1', seq: 1, event_type: 'transaction_posted', customer_id: 'c1', transaction_type: 'credit', amount_paise: 34000, occurred_on: oldDate.toISOString().slice(0, 10), created_at: oldDate.toISOString(), reverses_event_id: null, prev_hash: 'GENESIS', hash: '0'.repeat(64) });
  
  const draft = {
    txn_id: 'tmp_test',
    customerStatus: 'ok',
    customerId: 'c1',
    customerName: 'Test',
    candidates: [],
    actions: [{ type: 'credit', amountPaise: 34000, occurredOn: '2026-11-11', dateUncertain: false, dateWord: null }],
    readback: null,
    idempotencyKey: null,
  };
  
  const flags = guardRecentSameTypeAmount(draft, store.events);
  assert.strictEqual(flags, null);
});

// ============= Export Test =============

await t('All guard functions are exported', async () => {
  assert.strictEqual(typeof guardAmountVsMedian, 'function');
  assert.strictEqual(typeof guardRecentSameTypeAmount, 'function');
  assert.strictEqual(typeof guardTranscriptConflict, 'function');
  assert.strictEqual(typeof checkAllGuards, 'function');
});

console.log(`${pass} passed, ${fail} failed`);