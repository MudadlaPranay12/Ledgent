// One-shot evidence run: real Timbre -> Prisma for the judge's Telugu/Hinglish
// example, then the parser on the real transcript. Two API calls only.
import WebSocket from 'ws';
import { loadEnv } from '../gateway/env.js';
import { STT_URL, TTS_URL, TTS_MODEL, languageHeader } from '../gateway/gnani.adapter.js';
import { parseUtterance } from '../js/parser.js';

loadEnv();
const KEY = process.env.GNANI_API_KEY;
const VOICE = process.env.GNANI_TTS_VOICE || 'Shivani';
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;

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
        resolve({ pcm: Buffer.concat(chunks), firstChunkMs: Math.round(firstAt - t0) });
      } else if (m.type === 'error') reject(new Error(m.message));
    });
    ws.on('error', reject);
  });
}

function stt(pcm, language, format = 'transcribe') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STT_URL, { headers: {
      'x-api-key-id': KEY, model: 'prisma-v3.0', language_code: languageHeader(language, language === 'auto'),
      'x-sample-rate': '16000', format, topic: 'kirana shop khata',
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
      if (m.type === 'transcript') { out.push(m); setTimeout(() => { try { ws.close(); } catch {} }, 300); resolve({ out, ms: Math.round(now() - t0) }); }
      else if (m.type === 'error') reject(new Error(m.message));
    });
    ws.on('error', reject);
  });
}

const text = process.argv[2] || 'Gopal ka paisa 300 migilindi';
const ttsLang = process.argv[3] || 'hi-IN';
const sttLang = process.argv[4] || 'auto';
const format = process.argv[5] || 'transcribe';

const t = await tts(text, ttsLang);
console.log(`TTS ${VOICE}/${TTS_MODEL} lang=${ttsLang}: first chunk ${t.firstChunkMs} ms, ${t.pcm.length} bytes`);
const r = await stt(t.pcm, sttLang, format);
for (const seg of r.out) {
  console.log(`STT lang=${sttLang} format=${format}: "${seg.text}"  detected=${seg.detected_language_code}  latency=${seg.latency}`);
}
const transcript = r.out.map((s) => s.text).join(' ');

// Parser on the REAL transcript, with the demo customer set.
const customers = [
  { id: 'g1', name: 'Gopal', label: '', aliases: [] },
  { id: 'r1', name: 'Ramesh', label: 'Sabzi wala', aliases: [] },
  { id: 's1', name: 'Suresh', label: '', aliases: [] },
];
const parsed = parseUtterance(transcript, { customers, today: '2026-11-13' });
console.log('\nparser result on the real transcript:');
console.log(JSON.stringify({
  intent: parsed.intent,
  customer: parsed.customer?.status, id: parsed.customer?.id,
  amountPaise: parsed.actions?.[0]?.amountPaise ?? parsed.amountPaise ?? null,
  type: parsed.actions?.[0]?.type ?? null,
  balanceAmbiguous: !!parsed.balanceAmbiguous,
  question: parsed.question ?? null,
}, null, 2));
