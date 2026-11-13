// Language evaluation matrix: synthetic Timbre v3.0 speech -> Prisma v3.0 ->
// existing parser. 10 languages x 5 categories. Results are cached per
// (language, category, format) in tests/benchmark-cache.json so team credits
// are never spent twice. Synthetic speech is a development proxy, NOT
// native-speaker validation.
//
// Usage: node scripts/stt-benchmark.mjs [--langs hi-IN,te-IN] [--format transcribe|codemix]
//        [--limit 5] [--category credit] [--runs 1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { loadEnv } from '../gateway/env.js';
import { STT_URL, TTS_URL, TTS_MODEL, languageHeader } from '../gateway/gnani.adapter.js';
import { parseUtterance } from '../js/parser.js';
import { record } from './api-usage.mjs';

loadEnv();
const KEY = process.env.GNANI_API_KEY;
const VOICE = process.env.GNANI_TTS_VOICE || 'Shivani';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, '..', 'tests', 'benchmark-cache.json');

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const LANGS = (arg('langs', 'hi-IN')).split(',');
const FORMAT = arg('format', 'transcribe');
const LIMIT = Number(arg('limit', '0')) || Infinity;
const ONLY_CAT = arg('category', null);
const RUNS = Number(arg('runs', '1'));

const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;

// Best-effort test phrases. Digit amounts are used because the parser and TTS
// are both verified with digits; native number-word coverage is listed in the
// README as partial. Entries are NOT native-speaker reviewed.
const MATRIX = {
  'hi-IN': {
    // Two customers are named Ramesh in the demo data, so a bare "Ramesh" row
    // must come back as a question, not a pick.
    credit: ['Ramesh ka 340 udhaar', { amount: 34000, type: 'credit', ambiguous: true }],
    payment: ['Suresh ne 500 rupaye diye', { amount: 50000, type: 'payment', customer: 's1' }],
    correction: ['nahi, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh ka total kitna hai', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh ka 200 udhaar', { amount: 20000, ambiguous: true }],
  },
  'en-IN': {
    credit: ['Give Ramesh three hundred rupees credit', { amount: 30000, type: 'credit', ambiguous: true }],
    payment: ['Suresh gave 200 rupees', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['no, 430', { amount: 43000, type: 'correct' }],
    query: ['What is Suresh total', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 credit', { amount: 20000, ambiguous: true }],
  },
  'te-IN': {
    credit: ['Gopal ki 300 rupayala appu', { amount: 30000, type: 'credit', customer: 'g1' }],
    payment: ['Suresh 200 ichanu', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['kaadu, 430', { amount: 43000, type: 'correct' }],
    query: ['Gopal mottam entha', { type: 'query', customer: 'g1' }],
    ambiguity: ['Ramesh 200 appu', { amount: 20000, ambiguous: true }],
  },
  'ta-IN': {
    credit: ['Ramesh-ku 300 rooba kadan', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 kuduthen', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['illa, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh total evvalavu', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 kadan', { amount: 20000, ambiguous: true }],
  },
  'mr-IN': {
    credit: ['Ramesh la 300 rupaye udhaar', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh ne 200 dund dile', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['nahi, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh cha total kiti', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 udhaar', { amount: 20000, ambiguous: true }],
  },
  'bn-IN': {
    credit: ['Ramesh ke 300 taka baki', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 taka diye', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['na, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh er total koto', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 baki', { amount: 20000, ambiguous: true }],
  },
  'gu-IN': {
    credit: ['Ramesh ne 300 rupiya baki', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 rupiya aapya', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['nahi, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh nu total ketlu', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 baki', { amount: 20000, ambiguous: true }],
  },
  'kn-IN': {
    credit: ['Ramesh ge 300 rupaayi baki', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 kotta', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['illa, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh total eshtu', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 saala', { amount: 20000, ambiguous: true }],
  },
  'pa-IN': {
    credit: ['Ramesh de 300 rupaye udhaar', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 ditte', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['nahin, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh da total kinna', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 udhaar', { amount: 20000, ambiguous: true }],
  },
  'ml-IN': {
    credit: ['Rameshinu 300 rupa kadam', { amount: 30000, type: 'credit', customer: 'r1' }],
    payment: ['Suresh 200 thannu', { amount: 20000, type: 'payment', customer: 's1' }],
    correction: ['alla, 430', { amount: 43000, type: 'correct' }],
    query: ['Suresh aake ethra', { type: 'query', customer: 's1' }],
    ambiguity: ['Ramesh 200 kadam', { amount: 20000, ambiguous: true }],
  },
};

const CUSTOMERS = [
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: [] },
  { id: 'r2', name: 'Ramesh', label: 'Doodh wala', aliases: [] },
  { id: 's1', name: 'Suresh', label: '', aliases: [] },
  { id: 'g1', name: 'Gopal', label: '', aliases: [] },
];

function tts(text, language) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TTS_URL, { headers: { 'X-API-Key-ID': KEY } });
    const chunks = []; let firstAt = 0; const t0 = now();
    ws.on('open', () => ws.send(JSON.stringify({
      text, voice: VOICE, model: TTS_MODEL, language, speed: 1.0,
      audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
    })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'audio' && m.data?.audio) { if (!firstAt) firstAt = now(); chunks.push(Buffer.from(m.data.audio, 'base64')); }
      else if (m.type === 'complete' || m.data?.is_final) {
        try { ws.close(); } catch {}
        record('tts', now() - t0);
        resolve({ pcm: Buffer.concat(chunks), firstChunkMs: Math.round(firstAt - t0) });
      } else if (m.type === 'error') { record('tts', now() - t0, false); reject(new Error(m.message)); }
    });
    ws.on('error', (e) => { record('tts', now() - t0, false); reject(e); });
  });
}

function stt(pcm, language, format) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STT_URL, { headers: {
      'x-api-key-id': KEY, model: 'prisma-v3.0',
      language_code: languageHeader(language, language === 'auto'),
      'x-sample-rate': '16000', format, topic: 'kirana shop khata',
    } });
    const out = []; const t0 = now(); let endOfSpeech = 0;
    ws.on('open', () => {
      let off = 0;
      const tick = setInterval(() => {
        if (off >= pcm.length) {
          clearInterval(tick);
          endOfSpeech = now();
          ws.send(JSON.stringify({ type: 'commit' }));
          return;
        }
        const end = Math.min(off + 1024, pcm.length);
        ws.send(pcm.subarray(off, end)); off = end;
      }, 32);
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'transcript') {
        out.push(m);
        record('stt', now() - t0);
        setTimeout(() => { try { ws.close(); } catch {} }, 300);
        resolve({ out, endOfSpeechToTranscriptMs: Math.round(now() - (endOfSpeech || t0)) });
      } else if (m.type === 'error') { record('stt', now() - t0, false); reject(new Error(m.message)); }
    });
    ws.on('error', (e) => { record('stt', now() - t0, false); reject(e); });
  });
}

function score(parsed, expected) {
  const p = parsed;
  const got = {
    amount: p.actions?.[0]?.amountPaise ?? p.amountPaise ?? null,
    type: p.intent === 'correct' ? 'correct' : (p.actions?.[0]?.type || p.kind || null),
    customer: p.customer?.id || p.id || null,
    ambiguous: p.customer?.status === 'ambiguous',
  };
  return {
    amount: expected.amount ? got.amount === expected.amount : null,
    type: expected.type ? (expected.type === 'query' ? p.intent === 'query' : got.type === expected.type) : null,
    customer: expected.customer ? got.customer === expected.customer : null,
    ambiguity: expected.ambiguous ? got.ambiguous : null,
    got,
  };
}

const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();
const flush = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));

async function main() {
  if (!KEY) { console.error('GNANI_API_KEY missing in gateway/.env'); process.exit(1); }
  let calls = 0;
  const rows = [];
  for (const lang of LANGS) {
    const table = MATRIX[lang];
    if (!table) { console.log(`skip ${lang}: no phrases`); continue; }
    for (const [category, [text, expected]] of Object.entries(table)) {
      if (ONLY_CAT && category !== ONLY_CAT) continue;
      if (calls >= LIMIT) break;
      const key = `${lang}|${category}|${FORMAT}`;
      if (cache[key]?.runs >= RUNS) { rows.push(cache[key]); continue; }
      let entry;
      try {
        const t = await tts(text, lang);
        const r = await stt(t.pcm, lang, FORMAT);
        calls += 1;
        const transcript = r.out.map((s) => s.text).join(' ');
        const parsed = parseUtterance(transcript, { customers: CUSTOMERS, today: new Date().toISOString().slice(0, 10) });
        entry = {
          lang, category, format: FORMAT, text, transcript,
          detected: r.out[0]?.detected_language_code || null,
          score: score(parsed, expected), expected,
          ttsFirstChunkMs: t.firstChunkMs,
          transcriptMs: r.endOfSpeechToTranscriptMs,
          runs: (cache[key]?.runs || 0) + 1,
          at: new Date().toISOString(),
        };
        cache[key] = entry;
        flush();
        console.log(`${lang} ${category}: "${transcript}"  amount=${entry.score.amount} type=${entry.score.type} customer=${entry.score.customer}`);
      } catch (e) {
        console.log(`${lang} ${category}: ERROR ${e.message}`);
      }
      if (entry) rows.push(entry);
    }
  }
  if (!rows.length) { console.log('nothing ran (cache hit? raise --runs)'); return; }
  const rate = (field) => {
    const vals = rows.map((r) => r.score?.[field]).filter((v) => v !== null && v !== undefined);
    if (!vals.length) return 'n/a';
    return `${vals.filter(Boolean).length}/${vals.length}`;
  };
  console.log(`\nmatrix rows: ${rows.length}`);
  console.log(`amount accuracy:   ${rate('amount')}`);
  console.log(`direction accuracy:${rate('type')}`);
  console.log(`customer accuracy: ${rate('customer')}`);
  console.log(`ambiguity flagged: ${rate('ambiguity')}`);
  console.log(`api calls this run: ${calls}  (cached in tests/benchmark-cache.json)`);
}

main().catch((e) => { console.error('benchmark failed:', e.message); process.exit(1); });
