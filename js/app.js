// App core: wires the UI to the parser, session state machine and ledger.
// Plain ES modules, no build step, no frameworks.
import { CONFIG } from './config.js';
import { IdbStore, MemoryStore, Ledger, balanceFor, entriesFor, sumFor } from './ledger.js';
import { parseUtterance } from './parser.js';
import { startDraft, generateReadback, confirmDraft, correctDraft, resetDraft, STATE } from './session.js';
import { checkAllGuards } from './guards.js';
import { answerQuery } from './answers.js';
import { llmFallback, llmAvailable } from './llm.js';
import { LANGS, chooseLang, langLabel, nextLang } from './lang.js';
import { resolveVoice, speak, stopSpeaking, voiceErrorText } from './voice-router.js';
import { digitsSpoken } from './numbers.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const rupees = (paise) => {
  const r = Math.abs(paise || 0) / 100;
  return Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100);
};
const shortDate = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');

const els = {
  top: $('top'), badge: $('voiceBadge'), bannerText: $('bannerText'),
  status: $('status'), statusText: $('statusText'),
  tabs: $('tabs'), page: $('page'), custName: $('custName'), custLabel: $('custLabel'), custBal: $('custBal'),
  lines: $('lines'), heard: $('heard'), heardText: $('heardText'), cursor: document.querySelector('#heard .cursor'),
  chips: $('chips'), draft: $('draft'), draftText: $('draftText'), choices: $('choices'),
  confirmBtn: $('confirmBtn'), cancelBtn: $('cancelBtn'),
  typeForm: $('typeForm'), typeInput: $('typeInput'),
  verifyBtn: $('verifyBtn'), remindersBtn: $('remindersBtn'), langBtn: $('langBtn'), langLbl: $('langLbl'),
  kbdBtn: $('kbdBtn'), dbgBtn: $('dbgBtn'), debug: $('debug'), dbgLines: $('dbgLines'),
  tamperBtn: $('tamperBtn'), wipeBtn: $('wipeBtn'), holdBtn: $('holdBtn'),
  toast: $('toast'), errorBox: $('errorBox'), errorText: $('errorText'), resetBtn: $('resetBtn'),
};

const S = {
  store: null, ledger: null, customers: [], events: [], today: localToday(),
  session: { state: STATE.IDLE, draft: null },
  activeCustomerId: null, holding: false, voice: null, lang: CONFIG.lang,
  lastTxnId: null, flags: [], lat: {}, finalLock: false, typingTimer: null, seenFinal: false,
};

// ---------------------------------------------------------------- status / toast
function setStatus(state, text) {
  els.status.dataset.state = state;
  els.statusText.textContent = text;
}
function toast(msg, ms = 3000) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
}
function showFatal(err) {
  els.errorText.textContent = String(err && (err.stack || err.message) || err);
  els.errorBox.hidden = false;
  setStatus('error', `Error: ${err?.message || 'startup failed'}`);
}

// ---------------------------------------------------------------- heard strip
function setHeard(text) {
  clearInterval(S.typingTimer);
  S.typingTimer = null;
  els.heardText.textContent = text || '';
  if (els.cursor) els.cursor.style.display = 'inline-block';
}
function typeIntoHeard(text, speed = 16) {
  clearInterval(S.typingTimer);
  els.heardText.textContent = '';
  if (els.cursor) els.cursor.style.display = 'inline-block';
  const chars = [...String(text)];
  let i = 0;
  S.typingTimer = setInterval(() => {
    i += 1;
    els.heardText.textContent = chars.slice(0, i).join('');
    if (i >= chars.length) { clearInterval(S.typingTimer); S.typingTimer = null; }
  }, speed);
}

// ---------------------------------------------------------------- speech out
function speakNow(text) {
  if (!text) return;
  S.lat.ttsAt = performance.now();
  const started = speak(text, S.lang, () => {
    if (!S.lat.firstAudio) S.lat.firstAudio = performance.now();
    renderDebug();
  });
  if (!started) S.lat.firstAudio = performance.now();
  renderDebug();
}

// ---------------------------------------------------------------- data
async function refresh() {
  S.events = await S.ledger.allEvents();
  S.customers = await S.ledger.customers();
  if (!S.activeCustomerId && S.customers[0]) S.activeCustomerId = S.customers[0].id;
}
const customerById = (id) => S.customers.find((c) => c.id === id) || null;
const labelOf = (c) => (c ? `${c.label ? c.label.replace(/ wala$/i, ' wale ') : ''}${c.name}`.trim() : 'Customer');

function stats(id) {
  if (!id) return null;
  const amounts = entriesFor(S.events, id).filter((e) => e.status !== 'reversed').map((e) => e.event.amount_paise).filter((a) => a > 0);
  if (amounts.length < 3) return { medianPaise: 0, count: amounts.length };
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return { medianPaise: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, count: sorted.length };
}

// ---------------------------------------------------------------- seeding
async function seed() {
  const defs = [
    { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: ['ramesh sabzi'], credits: [120, 200, 340], payment: 150, reminderOptIn: true },
    { id: 'r2', name: 'Ramesh', label: 'Doodh wala', aliases: ['ramesh doodh'], credits: [60, 80, 120], payment: 0, reminderOptIn: false },
    { id: 's1', name: 'Suresh', label: 'Atta chakki', aliases: ['suresh atta'], credits: [120, 250, 340], payment: 100, reminderOptIn: true },
    { id: 'm1', name: 'Meena', label: '', aliases: [], credits: [100, 150, 200], payment: 50, reminderOptIn: false },
    { id: 'g1', name: 'Gopal', label: '', aliases: [], credits: [50, 100, 150], payment: 0, reminderOptIn: false },
  ];
  for (const d of defs) {
    await S.ledger.addCustomer({ id: d.id, name: d.name, label: d.label, aliases: d.aliases, reminderOptIn: d.reminderOptIn });
    let i = 0;
    for (const amount of d.credits) {
      const occurredOn = addDays(S.today, -6 + i * 2);
      await S.ledger.post({
        customerId: d.id, type: 'credit', amountPaise: amount * 100,
        occurredOn, txnId: `seed_${d.id}_${i}`,
        idempotencyKey: `seed_${d.id}_${i}`,
        createdAt: `${occurredOn}T09:00:00.000Z`,
      });
      i += 1;
    }
    if (d.payment) {
      const occurredOn = addDays(S.today, -1);
      await S.ledger.post({
        customerId: d.id, type: 'payment', amountPaise: d.payment * 100,
        occurredOn, txnId: `seed_${d.id}_p`,
        idempotencyKey: `seed_${d.id}_p`,
        createdAt: `${occurredOn}T09:00:00.000Z`,
      });
    }
  }
}

// ---------------------------------------------------------------- render
function renderTabs() {
  els.tabs.innerHTML = '';
  let activeTab = null;
  for (const c of S.customers) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    const active = (S.session.draft?.customerId || S.activeCustomerId) === c.id;
    if (active) { b.classList.add('on'); activeTab = b; }
    const bal = balanceFor(S.events, c.id);
    const name = document.createElement('span');
    name.textContent = c.name;
    const small = document.createElement('small');
    small.textContent = `${c.label || 'customer'} · ${rupees(bal)}`;
    b.append(name, small);
    b.addEventListener('click', () => {
      S.activeCustomerId = c.id;
      if (S.session.draft && S.session.draft.customerStatus !== 'ok') {
        S.session.draft.customerStatus = 'ok';
        S.session.draft.customerId = c.id;
        S.session.draft.customerName = c.name;
        S.session.draft.candidates = [];
        S.flags = [];
      }
      renderAll();
    });
    els.tabs.append(b);
  }
  // Keep the open customer visible without scrolling the page itself.
  if (activeTab) els.tabs.scrollLeft = Math.max(0, activeTab.offsetLeft - 40);
}

function renderPage() {
  const draft = S.session.draft;
  const id = draft?.customerId || S.activeCustomerId;
  const c = customerById(id);
  els.custName.textContent = c ? c.name : (draft?.customerStatus === 'missing' ? '—' : 'Ledgent');
  els.custLabel.textContent = c ? (c.label || '') : (draft ? 'draft' : '');
  const bal = c ? balanceFor(S.events, c.id) : 0;
  els.custBal.innerHTML = '';
  const big = document.createElement('span');
  big.textContent = `${rupees(bal)} baaki`;
  const small = document.createElement('small');
  small.textContent = c ? 'rupay' : '';
  els.custBal.append(big, small);

  els.lines.innerHTML = '';

  if (draft) {
    const a = draft.actions?.[0] || {};
    const li = document.createElement('li');
    li.className = 'draft';
    li.dataset.draftLine = '1';
    const d = document.createElement('span'); d.className = 'd';
    d.textContent = a.occurredOn ? shortDate(a.occurredOn) : (a.dateWord || '?');
    const t = document.createElement('span'); t.className = 't';
    const typeLabel = a.type === 'payment' ? 'payment mila' : a.type === 'credit' ? 'udhaar' : 'udhaar/payment?';
    t.textContent = `${rupees(a.amountPaise || draft.amountPaise)} rupay ${typeLabel}`;
    const amt = document.createElement('span'); amt.className = 'a';
    amt.textContent = rupees(a.amountPaise || draft.amountPaise);
    li.append(d, t, amt);
    els.lines.append(li);
  }

  if (!c) {
    const li = document.createElement('li');
    li.className = 'more';
    li.textContent = 'Koi customer nahi. Neeche se naam boliye.';
    els.lines.append(li);
    return;
  }

  const entries = entriesFor(S.events, c.id).slice().reverse().slice(0, 14);
  for (const { event, status } of entries) {
    const li = document.createElement('li');
    li.className = event.transaction_type + (status === 'reversed' ? ' reversed' : '');
    li.dataset.seq = String(event.seq);
    const d = document.createElement('span'); d.className = 'd'; d.textContent = shortDate(event.occurred_on);
    const t = document.createElement('span'); t.className = 't'; t.textContent = event.transaction_type === 'credit' ? 'udhaar' : 'jama';
    const a = document.createElement('span'); a.className = 'a'; a.textContent = rupees(event.amount_paise);
    li.append(d, t, a);
    els.lines.append(li);
  }
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'more';
    li.textContent = 'Naya khata — pehli entry boliye.';
    els.lines.append(li);
  }
}

function draftQuestion() {
  const d = S.session.draft;
  if (!d) return { text: '', blocking: false, choices: [] };
  const a = d.actions?.[0] || {};

  if (d.customerStatus === 'ambiguous') {
    const names = d.candidates.map((id) => labelOf(customerById(id)));
    return {
      text: names.length === 2 ? `${names[0]} ya ${names[1]}?` : `${names.join(' ya ')}?`,
      blocking: true,
      choices: d.candidates.map((id) => ({ label: labelOf(customerById(id)), act: () => chooseCustomer(id) })),
    };
  }
  if (d.customerStatus === 'new') {
    return {
      text: `Naya customer ${d.newCustomerName} banaun?`, blocking: true,
      choices: [
        { label: `Haan, ${d.newCustomerName} banao`, act: () => createNewCustomer() },
        { label: 'Nahi', act: () => { S.session.draft = null; S.session.state = STATE.IDLE; renderAll(); setStatus('idle', 'Listening · ready'); } },
      ],
    };
  }
  if (d.customerStatus === 'missing') {
    return { text: 'Kiska hisab? Naam boliye ya Type dabaiye.', blocking: true, choices: [] };
  }
  if (!a.type) {
    return {
      text: 'Udhaar ya payment?', blocking: true,
      choices: [
        { label: 'Udhaar', act: () => setType('credit') },
        { label: 'Payment', act: () => setType('payment') },
      ],
    };
  }
  if (a.dateUncertain) {
    return {
      text: `${a.dateWord || 'kal'} se matlab ${addDays(S.today, -1)}? Ya aaj?`, blocking: true,
      choices: [
        { label: `Haan, ${shortDate(addDays(S.today, -1))}`, act: () => setDate(addDays(S.today, -1)) },
        { label: 'Aaj', act: () => setDate(S.today) },
      ],
    };
  }
  if (d.confidence && d.confidence.level === 'low') {
    return {
      text: `${digitsSpoken(a.amountPaise || 0)} — sahi?`, blocking: true,
      choices: [
        { label: 'Haan, sahi', act: () => { S.session.draft.confidence.level = 'high'; renderAll(); } },
        { label: 'Nahi', act: () => cancelDraft() },
      ],
    };
  }
  return { text: '', blocking: false, choices: [] };
}

function renderDraft() {
  const d = S.session.draft;
  if (!d) { els.draft.hidden = true; els.choices.innerHTML = ''; return; }
  els.draft.hidden = false;
  const q = draftQuestion();
  els.draft.classList.toggle('question', !!q.text);

  let text = generateReadback(d, S.customers);
  if (typeof text !== 'string') text = 'Naya entry';
  if (q.text) text = q.text;
  else if (S.flags.length) text = `${text} ${S.flags[0].message}`;
  els.draftText.textContent = text;

  els.choices.innerHTML = '';
  for (const ch of q.choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ch.label;
    b.addEventListener('click', () => { ch.act(); renderAll(); });
    els.choices.append(b);
  }
  if (!q.blocking && S.flags.length) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Haan, sahi hai';
    b.addEventListener('click', () => { S.flags = []; renderAll(); });
    els.choices.append(b);
  }
  els.confirmBtn.disabled = false;
}

function renderBadge() {
  const v = S.voice || { badge: 'voice…', mode: 'none', reason: '' };
  els.badge.textContent = v.badge;
  els.badge.className = 'badge ' + (v.mode === 'gnani' ? 'gnani' : v.mode === 'none' ? 'none' : 'dev');
  els.badge.title = v.reason || '';
  els.bannerText.textContent = v.mode === 'dev'
    ? `${v.reason}. Browser speech is a development stand-in.`
    : v.mode === 'gnani' ? 'Gnani voice active. Dabaake boliye.' : 'Dabaake boliye, main khata likhunga.';
}

function renderAll() {
  renderTabs();
  renderPage();
  renderDraft();
  els.langLbl.textContent = langLabel(S.lang);
  renderDebug();
}

function renderDebug() {
  if (els.debug.hidden) return;
  const d = (a, b) => (a && b ? `${Math.max(0, b - a).toFixed(0)} ms` : '—');
  const v = S.voice || {};
  const rows = [
    `voice: ${v.mode || '?'} — ${v.reason || ''}`,
    `lang: ${S.lang}   today: ${S.today}`,
    `speech→transcript: ${d(S.lat.speechEnd, S.lat.transcriptAt)}`,
    `transcript→parse: ${d(S.lat.transcriptAt, S.lat.parsedAt)}`,
    `parse→tts: ${d(S.lat.parsedAt, S.lat.ttsAt)}`,
    `end of speech→first audio: ${d(S.lat.speechEnd, S.lat.firstAudio)}`,
    `events: ${S.events.length}   customers: ${S.customers.length}`,
    `draft: ${S.session.draft ? S.session.draft.customerStatus + '/' + (S.session.draft.actions?.[0]?.type || '?') : 'none'}`,
    `llm fallback: ${llmAvailable() ? 'on' : 'off'}`,
  ];
  els.dbgLines.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.textContent = r;
    els.dbgLines.append(div);
  }
}

// ---------------------------------------------------------------- draft actions
async function chooseCustomer(id) {
  const c = customerById(id);
  if (!c || !S.session.draft) return;
  S.session.draft.customerStatus = 'ok';
  S.session.draft.customerId = id;
  S.session.draft.customerName = c.name;
  S.session.draft.candidates = [];
  S.activeCustomerId = id;
  S.flags = checkAllGuards(S.session.draft, S.customers, S.events, '');
  const text = generateReadback(S.session.draft, S.customers);
  typeIntoHeard(text);
  setStatus('needs', 'Needs confirmation');
  speakNow(text);
}

function setType(type) {
  if (!S.session.draft) return;
  S.session.draft.actions.forEach((a) => { a.type = type; });
  S.session.draft.type = type;
  const text = generateReadback(S.session.draft, S.customers);
  typeIntoHeard(text);
  setStatus('needs', 'Needs confirmation');
  speakNow(text);
}

function setDate(date) {
  if (!S.session.draft) return;
  S.session.draft.actions.forEach((a) => { a.occurredOn = date; a.dateUncertain = false; a.dateWord = null; });
  S.session.draft.occurredOn = date;
  S.session.draft.dateUncertain = false;
  const text = generateReadback(S.session.draft, S.customers);
  typeIntoHeard(text);
  setStatus('needs', 'Needs confirmation');
  speakNow(text);
}

async function createNewCustomer() {
  const d = S.session.draft;
  if (!d) return;
  const name = d.newCustomerName || 'Naya';
  const c = await S.ledger.addCustomer({ id: `c_${Date.now().toString(36)}`, name, label: '', reminderOptIn: false });
  await refresh();
  d.customerStatus = 'ok';
  d.customerId = c.id;
  d.customerName = c.name;
  S.activeCustomerId = c.id;
  S.flags = checkAllGuards(d, S.customers, S.events, '');
  const text = generateReadback(d, S.customers);
  typeIntoHeard(text);
  setStatus('needs', 'Needs confirmation');
  speakNow(text);
}

function cancelDraft() {
  resetDraft(S.session);
  S.flags = [];
  els.draft.hidden = true;
  setStatus('idle', 'Listening · ready');
  renderAll();
}

// ---------------------------------------------------------------- confirm / save
function markWritten(seq) {
  const li = els.lines.querySelector(`li[data-seq="${seq}"]`);
  if (li) { li.classList.add('just-written'); }
}

async function confirmCurrent() {
  const d = S.session.draft;
  if (!d) { toast('Koi draft nahi'); return; }
  const q = draftQuestion();
  if (q.blocking) {
    setStatus('needs', `Needs confirmation — ${q.text}`);
    typeIntoHeard(q.text);
    speakNow(q.text);
    return;
  }
  setStatus('thinking', 'Thinking…');
  try {
    const res = await confirmDraft({ state: S.session.state, draft: d }, S.ledger);
    if (!res.event) {
      const msg = res.needsDate ? 'Date clear nahi hai' : 'Draft adhura hai';
      setStatus('error', `Error: ${msg}`);
      speakNow(msg);
      return;
    }
    S.lastTxnId = res.event.txn_id;
    S.activeCustomerId = res.event.customer_id;
    S.session.draft = null;
    S.session.state = STATE.IDLE;
    S.flags = [];
    await refresh();
    renderAll();
    markWritten(res.event.seq);
    const what = `${customerById(res.event.customer_id)?.name || 'Customer'}: ${rupees(res.event.amount_paise)} rupay ${res.event.transaction_type === 'credit' ? 'udhaar' : 'jama'}`;
    setStatus('saved', `Saved · ${what}`);
    els.heardText.textContent = `Saved — ${what}`;
    speakNow(`Bachaya gaya. ${what}`);
    if (res.duplicate) toast('Yeh entry pehle se saved thi');
  } catch (e) {
    setStatus('error', `Error: ${e.message}`);
    speakNow('Save nahi hua');
  }
}

// ---------------------------------------------------------------- utterance routing
async function handleUtterance(text, source = 'chip') {
  const t = String(text || '').trim();
  if (!t) { setStatus('error', 'Error: No speech heard'); return; }

  S.lat.transcriptAt = S.lat.transcriptAt || performance.now();
  setHeard(t);
  setStatus('thinking', 'Thinking…');

  let parsed = parseUtterance(t, {
    customers: S.customers, today: S.today, activeDraft: S.session.draft,
    customerStats: (id) => stats(id),
  });
  S.lat.parsedAt = performance.now();

  if (parsed.intent === 'unknown' && llmAvailable()) {
    const alt = await llmFallback(t, { customers: S.customers, today: S.today, activeDraft: S.session.draft });
    if (alt) parsed = alt;
  }

  await route(parsed, t, source);
  renderDebug();
}

async function route(parsed, text, source) {
  const d = S.session.draft;

  if (parsed.intent === 'seal') return doSeal();

  if (parsed.intent === 'correct') {
    const amount = parsed.amountPaise;
    if (d) {
      d.actions.forEach((a) => { a.amountPaise = amount; });
      d.amountPaise = amount;
      d.confidence = { score: 0.95, level: 'high', reasons: [] };
      S.flags = checkAllGuards(d, S.customers, S.events, text);
      renderAll();
      typeIntoHeard(`Theek: ${rupees(amount)} rupay`);
      setStatus('needs', 'Needs confirmation');
      speakNow(`Theek, ${rupees(amount)} rupay. Confirm karein?`);
      return;
    }
    await correctLast(amount);
    return;
  }

  if (parsed.intent === 'confirm') { await confirmCurrent(); return; }

  if (parsed.intent === 'cancel') {
    if (d) { cancelDraft(); toast('Cancelled'); } else { setStatus('idle', 'Listening · ready'); }
    return;
  }

  if (parsed.intent === 'choose_customer' && d) { await chooseCustomer(parsed.id); return; }
  if (parsed.intent === 'choose_type' && d) { setType(parsed.type); return; }

  if (parsed.intent === 'query') {
    const ans = answerQuery(parsed, { customers: S.customers, events: S.events, today: S.today });
    typeIntoHeard(ans.text);
    setStatus('idle', `Listening · ${ans.text}`);
    toast(ans.text, 5000);
    speakNow(ans.text);
    return;
  }

  if (parsed.intent === 'transaction') {
    const built = startDraft(parsed, S.customers);
    if (!built) { setStatus('error', 'Error: draft nahi bana'); return; }
    S.session.draft = built.draft;
    S.session.state = STATE.DRAFT;
    S.flags = checkAllGuards(built.draft, S.customers, S.events, text);
    renderAll();
    const q = draftQuestion();
    if (q.text) {
      setStatus('needs', `Needs confirmation — ${q.text}`);
      typeIntoHeard(q.text);
      speakNow(q.text);
    } else {
      const rb = generateReadback(built.draft, S.customers);
      setStatus('needs', 'Needs confirmation');
      typeIntoHeard(rb);
      speakNow(`${rb} Confirm karein?`);
    }
    return;
  }

  // unknown / empty
  setStatus('error', 'Error: samajh nahi aaya');
  typeIntoHeard('Samajh nahi aaya. Dobara boliye?');
  speakNow('Samajh nahi aaya. Dobara boliye?');
}

async function correctLast(amount) {
  const txn = S.lastTxnId || [...S.events].reverse().find((e) => e.event_type === 'transaction_posted')?.txn_id;
  if (!txn) {
    setStatus('error', 'Error: koi entry nahi hai jo sudhar sake');
    speakNow('Koi entry nahi hai');
    return;
  }
  setStatus('thinking', 'Thinking…');
  try {
    const res = await correctDraft(txn, amount, S.ledger, `op_${Date.now()}`);
    S.lastTxnId = res.posted.txn_id;
    S.activeCustomerId = res.posted.customer_id;
    await refresh();
    renderAll();
    markWritten(res.posted.seq);
    setStatus('saved', `Saved · corrected to ${rupees(amount)} rupay`);
    typeIntoHeard(`Sahi kar diya: ${rupees(amount)} rupay`);
    speakNow(`Sahi kar diya: ${rupees(amount)} rupay`);
  } catch (e) {
    setStatus('error', `Error: ${e.message}`);
  }
}

async function doSeal() {
  setStatus('thinking', 'Thinking…');
  try {
    const { event, duplicate } = await S.ledger.sealDay(S.today);
    await refresh();
    const credit = sumFor(S.events, S.today, 'credit');
    const payment = sumFor(S.events, S.today, 'payment');
    const summary = `Aaj udhaar ${rupees(credit)} rupay, jama ${rupees(payment)} rupay.`;
    renderAll();
    setStatus('saved', `Saved · din band${duplicate ? ' (already sealed)' : ''}`);
    typeIntoHeard(`Din band. ${summary}`);
    speakNow(`Din band. ${summary}`);
    toast(`Din band · ${summary}`, 5000);
    void event;
  } catch (e) {
    setStatus('error', `Error: ${e.message}`);
  }
}

// ---------------------------------------------------------------- voice
async function initVoice() {
  S.voice = await resolveVoice({
    lang: S.lang,
    onPartial: (t) => {
      if (!S.holding) return;
      setHeard(t);
    },
    onFinal: (t) => {
      if (S.finalLock) return;
      S.finalLock = true;
      S.lat.transcriptAt = performance.now();
      S.holding = false;
      document.body.classList.remove('listening');
      handleUtterance(t, 'voice').finally(() => { setTimeout(() => { S.finalLock = false; }, 300); });
    },
    onError: (code) => {
      S.holding = false;
      document.body.classList.remove('listening');
      const msg = voiceErrorText(code);
      setStatus('error', msg);
      toast(msg, 4000);
      S.finalLock = false;
    },
  });
  if (S.voice.setLang) S.voice.setLang(S.lang);
  renderBadge();
  renderDebug();
  if (S.voice.mode === 'dev') toast(S.voice.reason, 5000);
}

function beginHold() {
  if (S.holding) return;
  stopSpeaking();
  if (!S.voice || !S.voice.engine) {
    setStatus('error', 'Voice not available in this browser');
    toast('Voice not available in this browser — use Type', 4000);
    return;
  }
  S.holding = true;
  S.seenFinal = false;
  S.lat = { speechEnd: 0 };
  document.body.classList.add('listening');
  setStatus('listening', 'Listening…');
  setHeard('');
  try { S.voice.engine.start(); } catch { S.holding = false; document.body.classList.remove('listening'); }
}

function endHold() {
  if (!S.holding) return;
  S.holding = false;
  S.lat.speechEnd = performance.now();
  document.body.classList.remove('listening');
  setStatus('thinking', 'Thinking…');
  try { S.voice?.engine?.stop(); } catch { /* ignore */ }
}

function initHold() {
  const isControl = (t) => !!(t && t.closest && t.closest('button,input,a,form,#debug,#chips'));
  document.addEventListener('pointerdown', (e) => { if (!isControl(e.target)) beginHold(); });
  window.addEventListener('pointerup', endHold);
  window.addEventListener('pointercancel', endHold);
  els.holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); beginHold(); });
  els.holdBtn.addEventListener('pointerup', (e) => { e.preventDefault(); endHold(); });
  els.holdBtn.addEventListener('pointerleave', () => endHold());
  els.holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------------------------------------------------------- chrome handlers
function initChrome() {
  els.confirmBtn.addEventListener('click', confirmCurrent);
  els.cancelBtn.addEventListener('click', () => { cancelDraft(); toast('Cancelled'); });

  els.typeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = els.typeInput.value.trim();
    if (!v) return;
    els.typeInput.value = '';
    S.lat.transcriptAt = performance.now();
    S.lat.speechEnd = S.lat.speechEnd || performance.now();
    handleUtterance(v, 'type');
  });

  els.kbdBtn.addEventListener('click', () => {
    els.typeForm.hidden = !els.typeForm.hidden;
    if (!els.typeForm.hidden) els.typeInput.focus();
  });

  els.dbgBtn.addEventListener('click', () => {
    els.debug.hidden = !els.debug.hidden;
    renderDebug();
  });

  els.langBtn.addEventListener('click', () => {
    const code = nextLang(S.lang);
    S.lang = chooseLang(code);
    S.voice?.setLang?.(S.lang);
    els.langLbl.textContent = langLabel(S.lang);
    const name = LANGS.find((l) => l.code === S.lang)?.name || S.lang;
    toast(`Language: ${name}`, 2000);
    speakNow(LANGS.find((l) => l.code === S.lang)?.name || '');
  });

  els.verifyBtn.addEventListener('click', async () => {
    const v = await S.ledger.verify();
    if (v.ok) {
      els.verifyBtn.className = 'tool ok';
      els.verifyBtn.querySelector('.ico').textContent = '✓';
      els.verifyBtn.querySelector('.lbl').textContent = 'Book verified';
      toast(`Book verified — ${v.count} entries intact`);
      setStatus('saved', `Saved · book verified (${v.count} entries)`);
    } else {
      els.verifyBtn.className = 'tool bad';
      els.verifyBtn.querySelector('.ico').textContent = '!';
      els.verifyBtn.querySelector('.lbl').textContent = 'Book TAMPERED';
      toast(`Verification failed: ${v.reason}`, 6000);
      setStatus('error', `Error: book tampered — ${v.reason}`);
    }
  });

  els.remindersBtn.addEventListener('click', showReminders);

  els.tamperBtn.addEventListener('click', async () => {
    const posted = [...S.events].filter((e) => e.event_type === 'transaction_posted');
    if (!posted.length) { toast('No entries to tamper'); return; }
    const target = posted[Math.max(0, posted.length - 1)];
    await S.store.tamper(target.seq, 999900);
    await refresh();
    els.verifyBtn.click();
    toast(`Tampered entry #${target.seq}`, 4000);
  });

  els.wipeBtn.addEventListener('click', async () => {
    try {
      await S.store.wipe();
      if (S.store instanceof MemoryStore) S.store = new MemoryStore();
      else S.store = await IdbStore.open();
      S.ledger = new Ledger(S.store);
      await refresh();
      await seed();
      await refresh();
      S.session.draft = null;
      S.session.state = STATE.IDLE;
      S.activeCustomerId = S.customers[0]?.id;
      els.verifyBtn.className = 'tool';
      els.verifyBtn.querySelector('.lbl').textContent = 'Book verified';
      renderAll();
      setStatus('idle', 'Listening · ready');
      toast('All data cleared, demo customers re-seeded');
    } catch (e) {
      setStatus('error', `Error: ${e.message}`);
    }
  });

  els.resetBtn.addEventListener('click', async () => {
    try {
      els.resetBtn.disabled = true;
      await new Promise((res) => { const r = indexedDB.deleteDatabase('ledgent-db'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
      try { localStorage.removeItem('ledgent_voice'); localStorage.removeItem('ledgent_lang'); } catch { /* ignore */ }
    } finally {
      location.reload();
    }
  });

  for (const b of els.chips.querySelectorAll('.chip-ex')) {
    b.addEventListener('click', () => {
      S.lat = { speechEnd: performance.now() };
      handleUtterance(b.textContent, 'chip');
    });
  }
}

function showReminders() {
  const opted = S.customers.filter((c) => c.reminderOptIn === true && Math.abs(balanceFor(S.events, c.id)) > 0);
  if (!opted.length) { toast('Koi customer opt-in nahi hai ya balance zero hai', 4000); return; }
  const text = opted.map((c) => `Namaste ${c.name} ji, aapka Rs ${rupees(balanceFor(S.events, c.id))} ka hisab baaki hai.`).join(' ');
  typeIntoHeard(text);
  speakNow(text);
  toast(text, 8000);
}

// ---------------------------------------------------------------- init
async function init() {
  try {
    S.store = await IdbStore.open();
  } catch (e) {
    // A broken IndexedDB must not produce a blank page: degrade, say so.
    S.store = new MemoryStore();
    setStatus('error', `Error: storage unavailable (${e.message}) — temporary memory`);
  }
  S.ledger = new Ledger(S.store);
  await refresh();
  if (!S.customers.length) { await seed(); await refresh(); }
  S.activeCustomerId = S.customers[0]?.id || null;

  renderAll();
  setStatus('idle', 'Listening · ready');
  initChrome();
  initHold();

  // Voice selection is async (gateway health probe) and must not block the UI.
  initVoice().catch((e) => {
    els.badge.textContent = 'VOICE ERROR';
    els.badge.className = 'badge none';
    els.badge.title = String(e.message);
  });

  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  window.__ledgent = { S, handleUtterance, confirmCurrent, parse: parseUtterance };
}

function boot() {
  init().catch(showFatal);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.addEventListener('error', (e) => {
  if (els.errorBox.hidden) showFatal(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (els.errorBox.hidden) showFatal(e.reason || 'unhandled rejection');
});
