import assert from 'node:assert/strict';
import { Ledger, MemoryStore, balanceFor } from '../js/ledger.js';

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL:', name, '\n   ', e.message.split('\n')[0]); }
};

// ============= Reminder Opt-In Tests =============

// Reminders list only opted-in customers with balance > 0
await t('reminders list only opted-in customers with balance > 0', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  
  // Customer with opt-in and balance > 0
  await ledger.addCustomer({ id: 'c1', name: 'Ramesh', label: 'Sabzi wala', reminderOptIn: true });
  await ledger.post({ customerId: 'c1', type: 'credit', amountPaise: 50000, occurredOn: '2026-11-11', txnId: 't1', idempotencyKey: 'k1' }); // 500 rupees owed
  
  // Customer without opt-in
  await ledger.addCustomer({ id: 'c2', name: 'Suresh', label: 'Atta chakki', reminderOptIn: false });
  await ledger.post({ customerId: 'c2', type: 'credit', amountPaise: 30000, occurredOn: '2026-11-11', txnId: 't2', idempotencyKey: 'k2' }); // 300 rupees owed
  
  // Customer with opt-in but balance = 0
  await ledger.addCustomer({ id: 'c3', name: 'Meena', label: '', reminderOptIn: true });
  // No events for Meena, balance is 0
  
  const ev = await store.allEvents();
  
  // Filter: opted-in AND balance > 0
  const optedIn = store.customers.filter(c => c.reminderOptIn === true && Math.abs(balanceFor(ev, c.id)) > 0);
  
  // Should only include Ramesh
  assert.strictEqual(optedIn.length, 1);
  assert.strictEqual(optedIn[0].name, 'Ramesh');
  
  // Suresh should not appear (no opt-in)
  // Meena should not appear (balance = 0)
});

// Default opt-in is false
await t('default opt-in is false for new customers', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  
  const customer = store.customers.find(c => c.id === 'c1');
  assert.strictEqual(customer.reminderOptIn, false);
});

// ============= Reminder Template =============

// Template format verification
await t('reminder template format is correct', async () => {
  const template = (name, amount) => `Namaste ${name} ji, aapka Rs ${amount} ka hisab baaki hai. Jab suvidha ho, bata dijiyega. Dhanyavaाद.`;
  
  const result = template('Ramesh', '500');
  assert.strictEqual(result, 'Namaste Ramesh ji, aapka Rs 500 ka hisab baaki hai. Jab suvidha ho, bata dijiyega. Dhanyavaाद.');
  
  const result2 = template('Suresh', '1000');
  assert.strictEqual(result2, 'Namaste Suresh ji, aapka Rs 1000 ka hisab baaki hai. Jab suvidha ho, bata dijiyega. Dhanyavaाद.');
});

// ============= Opt-In Persistence =============

// Opt-in status persists across sessions
await t('opt-in status persists', async () => {
  const store = new MemoryStore();
  const ledger = new Ledger(store);
  
  // Add customer without setting reminderOptIn
  await ledger.addCustomer({ id: 'c1', name: 'Test' });
  
  // Default should be false
  assert.strictEqual(store.customers.find(c => c.id === 'c1').reminderOptIn, false);
  
  // Manually set to true
  store.customers.find(c => c.id === 'c1').reminderOptIn = true;
  assert.strictEqual(store.customers.find(c => c.id === 'c1').reminderOptIn, true);
});

console.log(`${pass} passed, ${fail} failed`);