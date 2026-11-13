// Smart double-check guards for Ledgent drafts
// Pure (no DOM), unit-tested. Flags drafts that need extra verification.
// Version 1: three checks only, no LLM, no pressure language.

import { balanceFor, entriesFor, sumFor } from './ledger.js';

// ---------- Guard 1: Amount vs customer median ----------
// Flag if the amount is more than ~5x the customer's median past amount.
// Requires at least 3 entries for the median to be meaningful.

export function guardAmountVsMedian(draft, allEvents) {
  if (!draft || draft.customerStatus !== 'ok') return null; // need a known customer
  const customerId = draft.customerId;
  if (!customerId) return null;

  // Get all active (non-reversed) past events for this customer
  const pastEvents = entriesFor(allEvents, customerId)
    .filter((e) => e.status !== 'reversed')
    .map((e) => e.event.event_type === 'transaction_posted' ? e.event.amount_paise : 0)
    .filter((a) => a > 0);

  // Need at least 3 entries for median to be meaningful
  if (pastEvents.length < 3) return null;

  // Sort amounts and find median
  const sorted = pastEvents.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  let median;
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  // Flag if amount > 5x median
  const amount = draft.amountPaise ?? draft.actions?.[0]?.amountPaise ?? 0;
  if (amount > median * 5) {
    const amountInRupees = formatAmount(draft.amountPaise).replace(' rupay', '');
    return {
      type: 'amount_vs_median',
      message: `Yeh amount, ${draft.customerName} ka aam udhaar ${formatAmount(
        median,
      )} se zyada hai. Sahi?`,
      extraQuestion: `Nahi, ${amountInRupees}?`,
      threshold: median * 5,
    };
  }
  return null;
}

export function guardRecentSameTypeAmount(draft, ledgerEvents) {
  if (!draft || !draft.customerId) return null;

  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const amount = draft.amountPaise ?? draft.actions?.[0]?.amountPaise ?? 0;
  const type = draft.type ?? draft.actions?.[0]?.type ?? null;

  if (!ledgerEvents || ledgerEvents.length === 0) return null;

  let matchingCount = 0;
  for (let i = ledgerEvents.length - 1; i >= 0; i--) {
    const e = ledgerEvents[i];
    if (e.customer_id !== draft.customerId) continue;
    if (e.event_type !== 'transaction_posted') continue;
    // created_at is the moment of recording; occurred_on is only a date.
    const ts = Date.parse(e.created_at || e.occurred_on || '');
    if (!Number.isFinite(ts) || ts < tenMinAgo) continue;
    if (e.amount_paise !== amount) continue;
    if (type && e.transaction_type !== type) continue;
    matchingCount++;
    break; // we only need to know if there's at least 1
  }

  if (matchingCount >= 1) {
    return {
      type: 'recent_same',
      message: `Yeh same customer, same type aur same amount kal 10 minute mein bhi diya gaya tha. Sahi?`,
      extraQuestion: 'Yeh 3,400 hai? Sahi?',
    };
  }
  return null;
}

export function guardTranscriptConflict(draft, spokenAmountText) {
  if (!draft || !spokenAmountText) return null;

  // Compare in RUPEES: the draft stores paise, the transcript is spoken rupees.
  const extracted = Math.round((draft.amountPaise ?? draft.actions?.[0]?.amountPaise ?? 0) / 100);
  const spoken = parseInt(String(spokenAmountText).replace(/[^\d]/g, ''), 10) || 0;

  if (spoken > 0 && extracted !== spoken) {
    return {
      type: 'digit_conflict',
      message: `Transcript me ${spoken} likha hai lekin system ne ${formatAmount(
        extracted * 100,
      )} decode kiya. Sahi?`,
      extraQuestion: `Yeh ${formatAmount(extracted * 100)} hai? Sahi?`,
    };
  }
  return null;
}

export function checkAllGuards(draft, customers, ledgerEvents, spokenAmountText) {
  const flags = [];

  // Guard 1: Amount vs median
  const guard1 = guardAmountVsMedian(draft, ledgerEvents);
  if (guard1) flags.push(guard1);

  // Guard 2: Recent same type+amount
  const guard2 = guardRecentSameTypeAmount(draft, ledgerEvents);
  if (guard2) flags.push(guard2);

  // Guard 3: Transcript digit conflict
  const guard3 = guardTranscriptConflict(draft, spokenAmountText);
  if (guard3) flags.push(guard3);

  return flags;
}

// -------- Helper: format amount ------

function formatAmount(paise) {
  const rupees = paise / 100;
  if (Math.round(rupees) === rupees) {
    return `${rupees} rupay`;
  }
  return `${rupees}`;
}