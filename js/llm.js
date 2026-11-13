// Optional LLM fallback lane. OFF by default (config.llmEnabled).
// Called only when the deterministic rules cannot parse. Sends exactly one
// sentence to the gateway, which holds the provider key. No ledger, no
// customer database, 1.5 s timeout, strict JSON, re-validated by our rules.
import { CONFIG } from './config.js';
import { parseUtterance } from './parser.js';

const SHAPE = ['customer_text', 'amount_rupees', 'type', 'date_word', 'is_correction'];

function prune(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const k of SHAPE) out[k] = obj[k] ?? null;
  if (typeof out.customer_text !== 'string') return null;
  const amt = Number(out.amount_rupees);
  out.amount_rupees = Number.isFinite(amt) && amt > 0 && amt < 10000000 ? amt : null;
  out.type = out.type === 'credit' || out.type === 'payment' ? out.type : null;
  out.date_word = typeof out.date_word === 'string' ? out.date_word : null;
  out.is_correction = out.is_correction === true;
  return out;
}

export function llmAvailable() {
  return !!(CONFIG.llmEnabled && CONFIG.gatewayUrl);
}

/**
 * Ask the gateway's /llm endpoint. Never throws; returns null on any failure.
 * The result is turned into a draft sentence and re-run through the SAME rules,
 * so a hallucinated answer cannot bypass the parser.
 */
export async function llmFallback(text, ctx = {}) {
  if (!llmAvailable()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.llmTimeoutMs);
  try {
    const res = await fetch(`${CONFIG.gatewayUrl}/llm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sentence: String(text).slice(0, 300) }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = prune(await res.json());
    if (!json) return null;

    // Re-validate with the phone's own rules.
    const sentence = `${json.customer_text || ''} ${json.type === 'payment' ? 'ne diya' : 'ka udhaar'} ${json.amount_rupees ?? ''} ${json.date_word || ''}`;
    const revalidated = parseUtterance(sentence, { ...ctx, customers: ctx.customers || [] });
    if (revalidated.intent !== 'transaction') return null;
    revalidated.via = 'llm';
    revalidated.llmConfidence = null;
    return revalidated;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
