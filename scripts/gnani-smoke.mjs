// Real Gnani smoke test: Timbre v3.0 synthesis -> Prisma v3.0 streaming STT.
// Small on purpose: team credits are limited. No key, audio or transcript is
// logged; only timings, byte counts and the returned transcript text.
import WebSocket from 'ws';
import { loadEnv } from '../gateway/env.js';
import { STT_URL, TTS_URL, TTS_MODEL, languageHeader } from '../gateway/gnani.adapter.js';

loadEnv();
const KEY = process.env.GNANI_API_KEY;
const VOICE = process.env.GNANI_TTS_VOICE || 'Shivani';
if (!KEY) { console.error('GNANI_API_KEY missing in gateway/.env'); process.exit(1); }

const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;

function tts(text, language = 'hi-IN') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TTS_URL, { headers: { 'X-API-Key-ID': KEY } });
    const chunks = [];
    let firstAt = 0;
    const t0 = now();
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('tts timeout')); }, 30000);
    ws.on('open', () => ws.send(JSON.stringify({
      text,
      voice: VOICE,
      model: TTS_MODEL,
      language,
      speed: 1.0,
      audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
    })));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'audio' && msg.data?.audio) {
        if (!firstAt) firstAt = now();
        chunks.push(Buffer.from(msg.data.audio, 'base64'));
      } else if (msg.type === 'complete' || msg.data?.is_final) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        const pcm = Buffer.concat(chunks);
        resolve({ pcm, firstChunkMs: Math.round(firstAt - t0), totalMs: Math.round(now() - t0), chunks: chunks.length });
      } else if (msg.type === 'error') {
        clearTimeout(timer);
        reject(new Error(msg.message || 'tts error'));
      }
    });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function stt(pcm, language, format = 'transcribe') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STT_URL, {
      headers: {
        'x-api-key-id': KEY,
        model: 'prisma-v3.0',
        language_code: languageHeader(language, language === 'auto'),
        'x-sample-rate': '16000',
        format,
        topic: 'kirana shop khata',
      },
    });
    const out = [];
    const t0 = now();
    let sentAt = 0;
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('stt timeout')); }, 30000);
    ws.on('open', () => {
      // Prisma expects exactly 1024-byte PCM frames at realtime pace.
      let offset = 0;
      const tick = setInterval(() => {
        if (offset >= pcm.length) {
          clearInterval(tick);
          sentAt = now();
          ws.send(JSON.stringify({ type: 'commit' }));
          return;
        }
        const end = Math.min(offset + 1024, pcm.length);
        ws.send(pcm.subarray(offset, end));
        offset = end;
      }, 32);
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'transcript') {
        out.push(msg);
        clearTimeout(timer);
        setTimeout(() => { try { ws.close(); } catch {} }, 300);
        resolve({ transcripts: out, firstTranscriptMs: Math.round(now() - t0) - (sentAt ? Math.round(now() - sentAt) : 0), totalMs: Math.round(now() - t0) });
      } else if (msg.type === 'error') {
        clearTimeout(timer);
        reject(new Error(msg.message || 'stt error'));
      }
    });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function main() {
  const phrase = process.argv[2] || 'Ramesh ka teen sau chaalis udhaar';
  const lang = process.argv[3] || 'hi-IN';

  console.log(`Timbre v3.0 -> Prisma v3.0 loop`);
  console.log(`voice: ${VOICE} (${TTS_MODEL})   language: ${lang}`);
  console.log(`input text: ${phrase}`);

  const t = await tts(phrase, lang);
  console.log(`\nTTS ok: ${t.chunks} chunks, ${t.pcm.length} bytes PCM16 @16k (${(t.pcm.length / 32000).toFixed(2)}s audio)`);
  console.log(`TTS request -> first audio chunk: ${t.firstChunkMs} ms`);
  console.log(`TTS request -> stream complete:   ${t.totalMs} ms`);

  const r = await stt(t.pcm, lang);
  console.log(`\nSTT ok: ${r.transcripts.length} transcript segment(s)`);
  for (const seg of r.transcripts) {
    console.log(`  transcript: "${seg.text}"`);
    console.log(`  detected_language_code: ${seg.detected_language_code || '—'}`);
    console.log(`  segment_index: ${seg.segment_index ?? '—'}  audio_duration_ms: ${seg.audio_duration_ms ?? '—'}  server latency: ${seg.latency ?? '—'}`);
  }
  console.log(`round trip wall time: ${r.totalMs} ms`);

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const heard = r.transcripts.map((s) => s.text).join(' ');
  const hasAmount = /340|3\s*4\s*0|teen sau chaalis|chaalis/.test(norm(heard));
  console.log(`\nspoken -> transcript check: ${hasAmount ? 'amount words present' : 'amount NOT matched (report as-is)'}`);
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
