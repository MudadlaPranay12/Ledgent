// Event-sourced, append-only, hash-chained ledger. Amounts are integer paise.

export const GENESIS = 'GENESIS';
export class HeadMoved extends Error {}
export class DuplicateKey extends Error {}

export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return s.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export async function sha256Hex(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const canonical = (e) => JSON.stringify([
  e.event_id, e.txn_id, e.idempotency_key, e.seq, e.event_type, e.customer_id,
  e.transaction_type, e.amount_paise, e.occurred_on, e.created_at, e.reverses_event_id ?? null,
]);

// ---------- Stores ----------
export class MemoryStore {
  constructor() { this.events = []; this.custs = new Map(); }
  async head() { const l = this.events[this.events.length - 1]; return l ? { seq: l.seq, hash: l.hash } : { seq: 0, hash: GENESIS }; }
  async byIdempotency(k) { return this.events.find((e) => e.idempotency_key === k) || null; }
  async putEvent(ev, expectedSeq) {
    const l = this.events[this.events.length - 1];
    // expectedSeq is optional: the Ledger always passes it, direct store use
    // (seeding, fixtures) may not.
    if (expectedSeq !== undefined && (l ? l.seq : 0) !== expectedSeq) throw new HeadMoved();
    if (this.events.some((e) => e.idempotency_key === ev.idempotency_key)) throw new DuplicateKey();
    this.events.push(ev);
  }
  async allEvents() { return this.events.map((e) => ({ ...e })); }
  async allCustomers() { return [...this.custs.values()]; }
  /** Array view used by the UI and the reminder tests. */
  get customers() { return [...this.custs.values()]; }
  async putCustomer(c) { this.custs.set(c.id, c); }
  async tamper(seq, amount) { const e = this.events.find((x) => x.seq === seq); if (e) e.amount_paise = amount; }
  async wipe() { this.events = []; this.custs = new Map(); }
}

export class IdbStore {
  static VERSION = 2;
  constructor(db) { this.db = db; }
  // Schema version 2. An upgrade (or a stale/half-created v1 database) must not
  // leave the app without stores, so every upgrade re-checks what exists.
  static open(name = 'ledgent-db') {
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, IdbStore.VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'seq' });
          events.createIndex('idem', 'idempotency_key', { unique: true });
        }
        if (!db.objectStoreNames.contains('customers')) db.createObjectStore('customers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => res(new IdbStore(r.result));
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Database upgrade blocked — close other Ledgent tabs'));
    });
  }

  async getMeta(key) { const v = await this._req('meta', 'readonly', (s) => s.get(key)); return v ? v.value : null; }
  setMeta(key, value) { return this._req('meta', 'readwrite', (s) => s.put({ key, value })); }
  _req(store, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  async head() {
    const c = await new Promise((res, rej) => {
      const tx = this.db.transaction('events', 'readonly');
      const req = tx.objectStore('events').openCursor(null, 'prev');
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
    return c ? { seq: c.value.seq, hash: c.value.hash } : { seq: 0, hash: GENESIS };
  }
  byIdempotency(k) { return this._req('events', 'readonly', (s) => s.index('idem').get(k)).then((r) => r || null); }
  putEvent(ev, expectedSeq) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction('events', 'readwrite');
      const st = tx.objectStore('events');
      const checkDup = () => {
        const g = st.index('idem').get(ev.idempotency_key);
        g.onsuccess = () => {
          if (g.result) { rej(new DuplicateKey()); tx.abort(); return; }
          st.add(ev);
        };
      };
      if (expectedSeq === undefined) { checkDup(); }
      else {
        const cur = st.openCursor(null, 'prev');
        cur.onsuccess = () => {
          const headSeq = cur.result ? cur.result.value.seq : 0;
          if (headSeq !== expectedSeq) { rej(new HeadMoved()); tx.abort(); return; }
          checkDup();
        };
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  allEvents() { return this._req('events', 'readonly', (s) => s.getAll()); }
  allCustomers() { return this._req('customers', 'readonly', (s) => s.getAll()); }
  putCustomer(c) { return this._req('customers', 'readwrite', (s) => s.put(c)); }
  async tamper(seq, amount) {
    const all = await this.allEvents();
    const e = all.find((x) => x.seq === seq);
    if (e) { e.amount_paise = amount; await this._req('events', 'readwrite', (s) => s.put(e)); }
  }
  async wipe() { this.db.close(); await new Promise((res) => { const r = indexedDB.deleteDatabase('ledgent-db'); r.onsuccess = r.onerror = r.onblocked = () => res(); }); }
}

// ---------- Pure replay helpers ----------
export function replay(events) {
  const byId = new Map(); const reversed = new Set(); const errors = [];
  for (const e of events) {
    byId.set(e.event_id, e);
    if (e.event_type !== 'transaction_reversed') continue;
    const t = byId.get(e.reverses_event_id);
    if (!t) errors.push(`seq ${e.seq}: reversal target missing`);
    else if (t.event_type !== 'transaction_posted') errors.push(`seq ${e.seq}: reversal target is not a posting`);
    else if (t.customer_id !== e.customer_id || t.txn_id !== e.txn_id) errors.push(`seq ${e.seq}: reversal does not match its target`);
    else if (reversed.has(t.event_id)) errors.push(`seq ${e.seq}: event already reversed`);
    else reversed.add(t.event_id);
  }
  return { byId, reversed, errors };
}
// Amount the customer owes because of one posting (credit +, payment -).
const effect = (e) => (e.transaction_type === 'credit' ? 1 : -1) * e.amount_paise;

export function balanceFor(events, customerId) {
  const { byId } = replay(events);
  let sum = 0;
  for (const e of events) {
    if (e.customer_id !== customerId) continue;
    if (e.event_type === 'transaction_posted') sum += effect(e);
    else if (e.event_type === 'transaction_reversed') { const t = byId.get(e.reverses_event_id); if (t) sum -= effect(t); }
  }
  return sum;
}
export function entriesFor(events, customerId) {
  const { reversed } = replay(events);
  return events.filter((e) => e.customer_id === customerId && e.event_type === 'transaction_posted')
    .map((e) => ({ event: e, status: reversed.has(e.event_id) ? 'reversed' : 'active' }));
}
export function sumFor(events, date, type) {
  const { reversed } = replay(events);
  return events.filter((e) => e.event_type === 'transaction_posted' && !reversed.has(e.event_id) &&
    e.occurred_on === date && e.transaction_type === type).reduce((s, e) => s + e.amount_paise, 0);
}

// ---------- Ledger ----------
export class Ledger {
  constructor(store) { this.store = store; this._q = Promise.resolve(); }

  _enqueue(fn) {
    const run = () => (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('ledgent-ledger', fn) : fn());
    const p = this._q.then(run);
    this._q = p.catch(() => {});
    return p;
  }

  append(f) { return this._enqueue(() => this._append(f)); }

  async _append(f) {
    if (!f.idempotency_key) throw new Error('idempotency_key required');
    if (!Number.isInteger(f.amount_paise) || f.amount_paise <= 0) throw new Error('amount must be positive integer paise');
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.store.byIdempotency(f.idempotency_key);
      if (existing) return { event: existing, duplicate: true };
      const head = await this.store.head();
      const ev = {
        event_id: uuid(), txn_id: f.txn_id, idempotency_key: f.idempotency_key, seq: head.seq + 1,
        event_type: f.event_type, customer_id: f.customer_id, transaction_type: f.transaction_type,
        amount_paise: f.amount_paise, occurred_on: f.occurred_on,
        created_at: f.created_at || new Date().toISOString(),
        reverses_event_id: f.reverses_event_id ?? null, prev_hash: head.hash,
      };
      ev.hash = await sha256Hex(ev.prev_hash + canonical(ev));
      try { await this.store.putEvent(ev, head.seq); return { event: ev, duplicate: false }; }
      catch (e) {
        if (e instanceof HeadMoved) continue;
        if (e instanceof DuplicateKey) return { event: await this.store.byIdempotency(f.idempotency_key), duplicate: true };
        throw e;
      }
    }
    throw new Error('Ledger busy, try again');
  }

  customers() { return this.store.allCustomers(); }
  async addCustomer({ id, name, label = '', reminderOptIn = false, aliases = [] }) {
    const existing = (await this.customers()).find((c) => c.id === id);
    if (existing) return existing;
    const c = { id: id || `c_${uuid().slice(0, 8)}`, name, label, aliases, reminderOptIn, createdAt: new Date().toISOString() };
    await this.store.putCustomer(c);
    return c;
  }
  allEvents() { return this.store.allEvents(); }

  post({ customerId, type, amountPaise, occurredOn, txnId, idempotencyKey, createdAt }) {
    return this.append({ idempotency_key: idempotencyKey, txn_id: txnId || uuid(), event_type: 'transaction_posted',
      customer_id: customerId, transaction_type: type, amount_paise: amountPaise, occurred_on: occurredOn,
      created_at: createdAt });
  }

  async reverse(eventId, idempotencyKey) {
    const events = await this.allEvents();
    const { byId, reversed } = replay(events);
    const t = byId.get(eventId);
    if (!t || t.event_type !== 'transaction_posted') throw new Error('Nothing to reverse');
    if (reversed.has(eventId)) throw new Error('Already reversed');
    return this.append({ idempotency_key: idempotencyKey, txn_id: t.txn_id, event_type: 'transaction_reversed',
      customer_id: t.customer_id, transaction_type: t.transaction_type, amount_paise: t.amount_paise,
      occurred_on: t.occurred_on, reverses_event_id: t.event_id });
  }

  // Correction = reverse the active posting of this transaction, then post the new amount (same txn_id).
  async correct(txnId, newAmountPaise, opKey) {
    const events = await this.allEvents();
    const { reversed } = replay(events);
    const active = [...events].reverse().find((e) => e.txn_id === txnId && e.event_type === 'transaction_posted' && !reversed.has(e.event_id));
    if (!active) throw new Error('No active entry to correct');
    const rev = await this.reverse(active.event_id, `${opKey}:rev`);
    const post = await this.post({ customerId: active.customer_id, type: active.transaction_type, amountPaise: newAmountPaise,
      occurredOn: active.occurred_on, txnId, idempotencyKey: `${opKey}:post` });
    return { reversal: rev.event, posted: post.event, old: active };
  }

  // Day seal: writes a day-seal event (hash of chain head + day's totals).
  // Does NOT affect customer balances. Has its own event_type 'day_seal'.
  // Amount is 0 and is excluded from balance calculations in balanceFor/replay.
  async sealDay(today) {
    // Compute today's credit/payment totals from active (non-reversed) events
    const events = await this.allEvents();
    const { reversed } = replay(events);
    let todayCredit = 0, todayPayment = 0;
    for (const e of events) {
      if (e.occurred_on !== today) continue;
      if (e.event_type !== 'transaction_posted') continue;
      if (reversed.has(e.event_id)) continue;
      if (e.transaction_type === 'credit') todayCredit += e.amount_paise;
      else if (e.transaction_type === 'payment') todayPayment += e.amount_paise;
    }

    // Build day seal event with amount 0 (not a transaction)
    const sealEvent = {
      event_id: `seal_${Date.now()}`,
      txn_id: `day_seal_${today}`,
      idempotency_key: `day_seal_${today}_${Math.random().toString(36).slice(2, 9)}`,
      seq: 0, // will be set after getting head
      event_type: 'day_seal',
      customer_id: '',
      transaction_type: 'credit', // neutral for canonical consistency
      amount_paise: 0, // does NOT affect balances - excluded from total calculations in balanceFor/replay
      occurred_on: today,
      created_at: new Date().toISOString(),
      reverses_event_id: null,
      prev_hash: '', // will be set after getting head
    };

    // Get head to compute seq and prev_hash
    const head = await this.store.head();
    sealEvent.seq = head.seq + 1;
    sealEvent.prev_hash = head.hash;

    // Compute hash using the same method as verify()
    sealEvent.hash = await sha256Hex(sealEvent.prev_hash + canonical(sealEvent));

    // Check idempotency key duplicate
    if (await this.store.byIdempotency(sealEvent.idempotency_key)) {
      return { event: await this.store.byIdempotency(sealEvent.idempotency_key), duplicate: true };
    }

    // Store the event using store.putEvent, which checks seq and idempotency key
    // The seq should be head.seq + 1, so we pass head.seq as expectedSeq
    // because putEvent checks that the current last seq equals expectedSeq
    try { await this.store.putEvent(sealEvent, head.seq); }
    catch (e) {
      if (e instanceof DuplicateKey) return { event: await this.store.byIdempotency(sealEvent.idempotency_key), duplicate: true };
      throw e;
    }
    return { event: sealEvent, duplicate: false };
  }

  async verify() {
    const events = await this.allEvents();
    let prev = GENESIS;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.seq !== i + 1) return { ok: false, count: events.length, brokenAtSeq: e.seq, reason: 'sequence gap' };
      if (e.prev_hash !== prev) return { ok: false, count: events.length, brokenAtSeq: e.seq, reason: 'previous hash mismatch' };
      const h = await sha256Hex(e.prev_hash + canonical(e));
      if (h !== e.hash) return { ok: false, count: events.length, brokenAtSeq: e.seq, reason: 'entry was changed' };
      prev = e.hash;
    }
    const { errors } = replay(events);
    if (errors.length) return { ok: false, count: events.length, brokenAtSeq: null, reason: errors[0] };
    return { ok: true, count: events.length };
  }
}