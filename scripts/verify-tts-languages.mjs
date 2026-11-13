// Proves the Timbre v3.0 request really changes language, instead of sending
// every reply as Hindi: synthesise a localized sentence per language, then feed
// that exact audio back through Prisma with the same explicit language and check
// the script that comes back.
import { loadEnv } from '../gateway/env.js';
import { TTS_URL, STT_URL, TTS_MODEL, languageHeader } from '../gateway/gnani.adapter.js';
import { EXAMPLES, scriptName } from '../js/i18n.js';
import WebSocket from 'ws';
import { record } from './api-usage.mjs';

loadEnv();
const KEY = process.env.GNANI_API_KEY;
const VOICE = process.env.GNANI_TTS_VOICE || 'Shivani';
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;
const LANGS = ['hi-IN', 'en-IN', 'te-IN', 'ta-IN', 'kn-IN', 'ml-IN', 'bn-IN', 'mr-IN'];
const SCRIPT_RX = {
  'hi-IN': /[\u0900-\u097F]/, 'mr-IN': /[\u0900-\u097F]/, 'te-IN': /[\u0C00-\u0C7F]/,
  'ta-IN': /[\u0B80-\u0BFF]/, 'kn-IN': /[\u0C80-\u0CFF]/, 'ml-IN': /[\u0D00-\u0D7F]/,
  'bn-IN': /[\u0980-\u09FF]/, 'en-IN': /[A-Za-z]/,
};

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
      'x-api-key-id': KEY, model: 'prisma-v3.0', language_code: languageHeader(language, false),
      'x-sample-rate': '16000', format: 'transcribe',
    } });
    const out = []; const t0 = now();
    ws.on('open', () => {
      let off = 0;
      const tick = setInterval(() => {
        if (off >= pcm.length) { clearInterval(tick); ws.send(JSON.stringify({ type: 'commit' })); return; }
        const end = Math.min(off + 1024, pcm.length);
        ws.send(pcm.subarray(off, end)); off = end;
      }, 32);
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'transcript') {
        out.push(m); record('stt', now() - t0);
        setTimeout(() => { try { ws.close(); } catch {} }, 250);
        resolve(out);
      } else if (m.type === 'error') { record('stt', now() - t0, false); reject(new Error(m.message)); }
    });
    ws.on('error', (e) => { record('stt', now() - t0, false); reject(e); });
  });
}

let ok = 0;
for (const lang of LANGS) {
  const text = (EXAMPLES[lang] || EXAMPLES['hi-IN'])[0];
  try {
    const t = await tts(text, lang);
    const rows = await stt(t.pcm, lang);
    const transcript = rows.map((r) => r.text).join(' ').trim();
    const scriptOk = SCRIPT_RX[lang]?.test(transcript) ?? true;
    if (scriptOk) ok += 1;
    console.log(`${lang.padEnd(6)} tts lang=${lang} first=${t.firstChunkMs}ms | asked: ${text}`);
    console.log(`       heard back: ${JSON.stringify(transcript)} → ${scriptName(lang)} script ${scriptOk ? 'OK' : 'MISMATCH'}`);
  } catch (e) {
    console.log(`${lang.padEnd(6)} ERROR ${e.message}`);
  }
}
console.log(`\nTTS language mapping verified: ${ok}/${LANGS.length}`);
