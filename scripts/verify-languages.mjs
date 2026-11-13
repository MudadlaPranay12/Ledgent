// Real-audio check for the eight target languages: Timbre v3.0 speaks a natural
// sentence, Prisma v3.0 streams the audio back as text, and the existing parser
// is asked what it made of it. Speech recognition and transaction parsing are
// reported separately on purpose.
//
// Synthetic Timbre speech is a development proxy for a human voice, not
// native-speaker validation. Results: tests/language-evidence.json
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
const OUT = path.join(HERE, '..', 'tests', 'language-evidence.json');
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;

const LANGS = [
  { code: 'hi-IN', name: 'Hindi', text: 'रमेश का 340 रुपये उधार लिख दो' },
  { code: 'en-IN', name: 'English', text: 'Give Suresh three hundred rupees credit' },
  { code: 'te-IN', name: 'Telugu', text: 'గోపాల్ కి 300 రూపాయల అప్పు' },
  { code: 'ta-IN', name: 'Tamil', text: 'ரமேஷுக்கு 300 ரூபா கடன்' },
  { code: 'kn-IN', name: 'Kannada', text: 'ರಮೇಶ್ ಗೆ 300 ರೂಪಾಯಿ ಸಾಲ' },
  { code: 'ml-IN', name: 'Malayalam', text: 'രമേശിന് 300 രൂപ കടം' },
  { code: 'bn-IN', name: 'Bengali', text: 'রমেশের 300 টাকা বাকি' },
  { code: 'mr-IN', name: 'Marathi', text: 'रमेशला 300 रुपये उधार' },
];

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

function stt(pcm, language) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STT_URL, { headers: {
      'x-api-key-id': KEY, model: 'prisma-v3.0',
      language_code: languageHeader(language, language === 'auto'),
      'x-sample-rate': '16000', format: 'transcribe', topic: 'kirana shop khata',
    } });
    const out = []; const t0 = now();
    let frames = 0;
    ws.on('open', () => {
      let off = 0;
      const tick = setInterval(() => {
        if (off >= pcm.length) { clearInterval(tick); ws.send(JSON.stringify({ type: 'commit' })); return; }
        const end = Math.min(off + 1024, pcm.length);
        ws.send(pcm.subarray(off, end)); off = end; frames += 1;
      }, 32);
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'transcript') {
        out.push(m);
        record('stt', now() - t0);
        setTimeout(() => { try { ws.close(); } catch {} }, 250);
        resolve({ out, frames, ms: Math.round(now() - t0) });
      } else if (m.type === 'error') { record('stt', now() - t0, false); reject(new Error(m.message)); }
    });
    ws.on('error', (e) => { record('stt', now() - t0, false); reject(e); });
  });
}

// --langs ta-IN,ml-IN keeps a re-check small so credits are not spent twice.
const only = (() => {
  const i = process.argv.indexOf('--langs');
  return i >= 0 ? new Set(process.argv[i + 1].split(',')) : null;
})();
const selected = LANGS.filter((l) => !only || only.has(l.code));

const results = [];
for (const lang of selected) {
  const row = { lang: lang.code, name: lang.name, spoke: lang.text };
  try {
    const t = await tts(lang.text, lang.code);
    row.tts = { bytes: t.pcm.length, seconds: +(t.pcm.length / 32000).toFixed(2), firstChunkMs: t.firstChunkMs };
    if (!t.pcm.length) { row.error = 'TTS returned no audio'; results.push(row); continue; }

    const explicit = await stt(t.pcm, lang.code);
    const auto = await stt(t.pcm, 'auto');

    const eText = explicit.out.map((x) => x.text).join(' ').trim();
    const aText = auto.out.map((x) => x.text).join(' ').trim();
    const picked = eText || aText;
    const detected = (explicit.out[0]?.detected_language_code || auto.out[0]?.detected_language_code || null);
    const parsed = picked ? parseUtterance(picked, { customers: CUSTOMERS, today: new Date().toISOString().slice(0, 10) }) : null;

    row.stt = {
      prismaReceivedAudio: explicit.frames > 0 && (explicit.out[0]?.audio_duration_ms ?? 0) > 0,
      frames: explicit.frames,
      explicitTranscript: eText || null,
      autoTranscript: aText || null,
      detectedLanguage: detected,
      autoDetectionCorrect: auto.out[0]?.detected_language_code === lang.code,
      explicitLanguageHonored: explicit.out[0]?.detected_language_code === lang.code,
      serverLatencyMs: explicit.out[0]?.latency ?? null,
      wallMs: explicit.ms,
    };
    row.parse = parsed ? {
      intent: parsed.intent,
      amountPaise: parsed.actions?.[0]?.amountPaise ?? parsed.amountPaise ?? null,
      type: parsed.actions?.[0]?.type ?? null,
      customer: parsed.customer?.status === 'ok' ? parsed.customer.id : (parsed.customer?.status || null),
      transcriptPreserved: parsed.raw === picked,
      question: parsed.question || null,
    } : null;
    row.transcriptPreserved = !!picked;
    console.log(`${lang.code.padEnd(6)} transcript: ${JSON.stringify(picked || '(none)')}`);
    console.log(`       detected=${detected || '—'} auto-correct=${row.stt.autoDetectionCorrect} ` +
      `parse=${row.parse?.intent || '—'} amount=${row.parse?.amountPaise ?? '—'} type=${row.parse?.type || '—'} ` +
      `customer=${row.parse?.customer || '—'} preserved=${row.parse?.transcriptPreserved}`);
  } catch (e) {
    row.error = e.message;
    console.log(`${lang.code.padEnd(6)} ERROR ${e.message}`);
  }
  results.push(row);
}

// Keep earlier rows when only a subset is re-checked.
const previous = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')).results || []; } catch { return []; } })();
const merged = [...previous.filter((p) => !results.some((r) => r.lang === p.lang)), ...results]
  .sort((a, b) => LANGS.findIndex((l) => l.code === a.lang) - LANGS.findIndex((l) => l.code === b.lang));
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), voice: VOICE, model: TTS_MODEL, results: merged }, null, 2));
const transcribed = results.filter((r) => r.stt?.explicitTranscript || r.stt?.autoTranscript).length;
const parsedOk = results.filter((r) => r.parse?.intent === 'transaction').length;
console.log(`\nrecognised (transcript returned): ${transcribed}/${results.length}`);
console.log(`transcript survived into the parser: ${results.filter((r) => r.parse?.transcriptPreserved).length}/${results.length}`);
console.log(`transaction parsed: ${parsedOk}/${results.length}`);
console.log(`evidence written to tests/language-evidence.json`);
