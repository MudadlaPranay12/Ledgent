// Local Gnani API usage counter shared by the scripts. Stores counts and
// timings only: never the key, never audio, never transcript text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'gateway', 'usage.json');

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function record(kind, ms, ok = true) {
  const u = read();
  u.sttSessions ??= 0; u.sttTranscripts ??= 0; u.ttsRequests ??= 0; u.ttsChunks ??= 0;
  u.errors ??= 0; u.scriptCalls ??= 0; u.scriptMs ??= 0;
  if (kind === 'stt') u.sttSessions += 1;
  if (kind === 'tts') u.ttsRequests += 1;
  if (!ok) u.errors += 1;
  u.scriptCalls += 1;
  u.scriptMs = Math.round(u.scriptMs + (ms || 0));
  u.lastCallAt = new Date().toISOString();
  try { fs.writeFileSync(FILE, JSON.stringify(u, null, 2)); } catch { /* best effort */ }
}

export function summary() {
  const u = read();
  return `${u.scriptCalls || 0} script API call(s), ${u.scriptMs || 0} ms total`;
}
