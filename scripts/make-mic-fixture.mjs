// Builds a 16 kHz mono WAV fixture used as the browser's fake microphone input.
// The audio content is Timbre-synthesised Telugu; the microphone, AudioWorklet,
// gateway and Prisma path it exercises in mic-session-check.mjs is real.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { loadEnv } from '../gateway/env.js';
import { TTS_URL, TTS_MODEL } from '../gateway/gnani.adapter.js';

loadEnv();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'tests', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const text = process.argv[2] || 'సురేష్ కి మూడు వందల నలభై రూపాయల అప్పు';
const lang = process.argv[3] || 'te-IN';
const file = path.join(OUT, process.argv[4] || 'te-mic.wav');

function tts(text, language) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TTS_URL, { headers: { 'X-API-Key-ID': process.env.GNANI_API_KEY } });
    const chunks = [];
    ws.on('open', () => ws.send(JSON.stringify({
      text, voice: process.env.GNANI_TTS_VOICE || 'Shivani', model: TTS_MODEL, language, speed: 1.0,
      audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
    })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'audio' && m.data?.audio) chunks.push(Buffer.from(m.data.audio, 'base64'));
      else if (m.type === 'complete' || m.data?.is_final) { try { ws.close(); } catch {} resolve(Buffer.concat(chunks)); }
      else if (m.type === 'error') reject(new Error(m.message));
    });
    ws.on('error', reject);
  });
}

function wav(pcm, rate = 16000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * bits / 8, 28);
  header.writeUInt16LE(channels * bits / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const pcm = await tts(text, lang);
if (!pcm.length) { console.error('TTS returned no audio'); process.exit(1); }
// A short lead-in of silence makes Chrome's capture start cleanly.
const silence = Buffer.alloc(16000 * 2 * 0.3);
fs.writeFileSync(file, wav(Buffer.concat([silence, pcm, silence])));
console.log(`wrote ${file}  ${(pcm.length / 32000).toFixed(2)}s of ${lang} speech — "${text}"`);
