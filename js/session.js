// Session state machine: IDLE -> DRAFT -> (needs customer | needs type | needs date | ready) -> CONFIRMED
// Pure logic apart from the ledger writes in confirmDraft/correctDraft.
export const STATE = { IDLE: 'idle', DRAFT: 'draft', CONFIRMED: 'confirmed' };

const todayStr = () => new Date().toISOString().slice(0, 10);

// ==================================================================
// Draft creation from a parsed utterance
// ==================================================================
export function startDraft(parsed, customers = []) {
  if (!parsed || ['empty', 'cancel', 'unknown'].includes(parsed.intent)) return null;

  const customer = parsed.customer || { status: 'missing' };
  const actions = (parsed.actions || []).map((a) => ({ ...a }));
  let custStatus = customer.status;
  let custId = null;
  let custName = null;
  let candidates = [];

  if (custStatus === 'ok') {
    custId = customer.id;
    const c = customers.find((x) => x.id === custId);
    custName = c ? c.name : null;
  } else if (custStatus === 'ambiguous') {
    candidates = customer.candidates || [];
  } else if (custStatus === 'new') {
    custName = customer.newName;
  }

  const first = actions[0] || {};
  const draft = {
    txn_id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    customerStatus: custStatus,
    customerId: custId,
    customerName: custName,
    newCustomerName: custStatus === 'new' ? customer.newName : null,
    candidates,
    actions,
    type: first.type ?? null,
    occurredOn: first.occurredOn ?? null,
    dateUncertain: !!first.dateUncertain,
    dateWord: first.dateWord ?? null,
    amountPaise: first.amountPaise ?? 0,
    confidence: parsed.confidence || null,
    question: parsed.question || null,
    readback: null,
    idempotencyKey: null,
  };

  return { draft, initialState: STATE.DRAFT };
}

// ==================================================================
// State machine transition
// ==================================================================
export function transition(session, event, customers = [], payload = null) {
  if (!session) return { state: STATE.IDLE };

  if (session.state === STATE.IDLE) {
    if (event === 'start' && session.draft) {
      session.state = STATE.DRAFT;
      return { state: STATE.DRAFT, draft: session.draft };
    }
    return { state: STATE.IDLE };
  }

  if (session.state === STATE.DRAFT) {
    if (event === 'confirm') {
      session.state = STATE.CONFIRMED;
      return { state: STATE.CONFIRMED, draft: session.draft };
    }
    if (event === 'cancel' || event === 'reset') {
      resetDraft(session);
      return { state: STATE.IDLE };
    }
    if (event === 'set_customer') {
      const c = customers.find((x) => x.id === (payload || event));
      if (c) {
        session.draft.customerStatus = 'ok';
        session.draft.customerId = c.id;
        session.draft.customerName = c.name;
        session.draft.candidates = [];
      }
      return { state: STATE.DRAFT, draft: session.draft };
    }
    if (event === 'set_type') {
      if (session.draft && payload) {
        session.draft.actions.forEach((a) => { a.type = payload; });
        session.draft.type = payload;
      }
      return { state: STATE.DRAFT, draft: session.draft };
    }
    if (event === 'set_date') {
      if (session.draft) {
        session.draft.actions.forEach((a) => {
          a.occurredOn = payload && payload.date ? payload.date : todayStr();
          a.dateUncertain = false;
          a.dateWord = null;
        });
        session.draft.occurredOn = session.draft.actions[0]?.occurredOn || todayStr();
        session.draft.dateUncertain = false;
      }
      return { state: STATE.DRAFT, draft: session.draft };
    }
    if (event === 'set_amount') {
      if (session.draft && Number.isInteger(payload)) {
        session.draft.actions.forEach((a) => { a.amountPaise = payload; });
        session.draft.amountPaise = payload;
      }
      return { state: STATE.DRAFT, draft: session.draft };
    }
  }

  if (session.state === STATE.CONFIRMED) {
    if (event === 'reset' || event === 'cancel') {
      resetDraft(session);
      return { state: STATE.IDLE };
    }
  }

  return { state: session.state };
}

// ==================================================================
// Read-back
// ==================================================================
const rupees = (paise) => {
  const r = (paise || 0) / 100;
  return Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100);
};

const typeWord = (t) => (t === 'payment' ? 'payment mila' : 'udhaar');

export function generateReadback(draft, customers = []) {
  if (!draft) return null;

  if (draft.customerStatus === 'ambiguous') {
    return { type: 'ambiguousCustomer', candidates: draft.candidates || [] };
  }
  if (draft.customerStatus === 'new') {
    return `Naya customer ${draft.newCustomerName || draft.customerName || ''}: ${rupees(draft.amountPaise)} rupay?`;
  }
  if (draft.customerStatus === 'missing') {
    return 'Kiska hisab? Customer ka naam boliye.';
  }

  const c = customers.find((x) => x.id === draft.customerId);
  const name = c ? `${c.name}${c.label ? ` (${c.label})` : ''}` : (draft.customerName || 'Customer');
  const action = draft.actions?.[0] || {};
  const amount = action.amountPaise ?? draft.amountPaise;
  const type = action.type ?? draft.type;

  if (!type) return `${name}: ${rupees(amount)} rupay — udhaar ya payment?`;
  const when = action.dateUncertain ? `${action.dateWord || 'kal'}?` : (action.occurredOn || todayStr());
  return `${name}: ${rupees(amount)} rupay ${typeWord(type)} — ${when}.`;
}

// ==================================================================
// Confirm draft to ledger
// ==================================================================
/**
 * Writes the draft. Async and idempotent: retrying the same draft (same
 * idempotencyKey) never creates a second event.
 */
export async function confirmDraft(session, ledger) {
  const draft = session?.draft || session;
  const none = { duplicate: false, event: null, events: [], old: null, posted: null };

  if (!draft || draft.customerStatus !== 'ok' || !draft.customerId) return none;

  const actions = draft.actions?.length
    ? draft.actions
    : [{ type: draft.type, amountPaise: draft.amountPaise, occurredOn: draft.occurredOn }];

  if (actions.some((a) => !a.type || !a.amountPaise)) return none;
  if (actions.some((a) => !a.occurredOn)) return { ...none, needsDate: true };

  if (!draft.idempotencyKey) draft.idempotencyKey = `idem_${draft.txn_id}`;

  const events = [];
  let duplicate = false;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const multi = actions.length > 1;
    const res = await ledger.post({
      customerId: draft.customerId,
      type: a.type,
      amountPaise: a.amountPaise,
      occurredOn: a.occurredOn,
      txnId: multi ? `${draft.txn_id}_${i}` : draft.txn_id,
      idempotencyKey: multi ? `${draft.idempotencyKey}_${i}` : draft.idempotencyKey,
    });
    if (res.duplicate) duplicate = true;
    if (res.event) {
      res.event.idempotencyKey = res.event.idempotency_key;
      events.push(res.event);
    }
  }

  if (session && session.state) session.state = STATE.CONFIRMED;
  return { duplicate, event: events[0] || null, events, old: null, posted: events[0] || null };
}

/** Correct an already-committed transaction: reverse, then repost. */
export async function correctDraft(txnId, newAmountPaise, ledger, opKey) {
  const res = await ledger.correct(txnId, newAmountPaise, opKey || `op_${Date.now()}`);
  res.posted.idempotencyKey = res.posted.idempotency_key;
  return res;
}

// ==================================================================
// Reset
// ==================================================================
export function resetDraft(session) {
  if (session) {
    session.draft = null;
    session.state = STATE.IDLE;
  }
}
