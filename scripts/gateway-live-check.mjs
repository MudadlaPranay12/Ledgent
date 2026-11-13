// Live check of the Node gateway against the real Gnani upstream:
// /health -> /session (origin checked) -> WS /voice -> real Prisma socket opens.
// One upstream handshake, no audio. Prints timings only.
import WebSocket from 'ws';
import { createGateway } from '../gateway/server.js';

const ORIGIN = process.env.CHECK_ORIGIN || 'http://localhost:8199';
const gw = createGateway({ allowedOrigin: ORIGIN, writeUsage: false });
await new Promise((r) => gw.httpServer.listen(0, r));
const port = gw.httpServer.address().port;
const base = `http://127.0.0.1:${port}`;

console.log(`gateway listening on :${port}  key present: ${gw.hasKey}`);

const health = await (await fetch(`${base}/health`)).json();
console.log('GET /health ->', JSON.stringify(health));

const forbidden = await fetch(`${base}/session`, { headers: { Origin: 'http://evil.example' } });
console.log(`GET /session (foreign origin) -> ${forbidden.status}`);

const ok = await fetch(`${base}/session`, { headers: { Origin: ORIGIN } });
const { token, expires } = await ok.json();
console.log(`GET /session (allowed origin) -> ${ok.status}, token ${token.slice(0, 8)}…, expires in ${Math.round((expires - Date.now()) / 1000)}s`);

const ws = new WebSocket(`ws://127.0.0.1:${port}/voice?token=${token}`, { headers: { Origin: ORIGIN } });
const t0 = Date.now();
const events = [];
const done = new Promise((resolve) => {
  ws.on('open', () => {
    console.log('WS /voice -> open (token accepted)');
    ws.send(JSON.stringify({ type: 'start', lang: 'hi-IN', format: 'transcribe' }));
  });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    events.push(msg.type);
    console.log(`  <- ${msg.type}${msg.message ? ' (' + msg.message + ')' : ''}`);
    if (msg.type === 'stt_ready' || msg.type === 'connected' || msg.type === 'error') {
      ws.send(JSON.stringify({ type: 'stop' }));
      setTimeout(() => resolve(), 300);
    }
  });
  ws.on('error', (e) => { console.log('  ws error:', e.message); resolve(); });
});
await done;
ws.close();
console.log(`real Prisma handshake through the gateway: ${events.includes('stt_ready') ? 'OK' : 'NOT CONFIRMED'} (${Date.now() - t0} ms)`);
await gw.close();
