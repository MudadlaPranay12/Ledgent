// Real browser microphone session, end to end:
//   getUserMedia -> AudioWorklet (16 kHz PCM16) -> gateway WS -> Prisma te-IN
// The microphone input comes from a WAV fed to Chromium's fake audio device
// (the Telugu audio itself is synthetic). Everything after the mic is the real
// runtime path, including the language the browser actually asks for.
//
//   node scripts/mic-session-check.mjs [langCode] [wavPath]
import path from 'node:path';
import { chromium } from 'playwright';

const APP = process.env.APP_URL || 'http://localhost:8199';
const wantLang = process.argv[2] || 'te-IN';
const wav = path.resolve(process.argv[3] || 'tests/fixtures/te-mic.wav');
const SCRIPT = {
  'te-IN': /[\u0C00-\u0C7F]/, 'ta-IN': /[\u0B80-\u0BFF]/, 'kn-IN': /[\u0C80-\u0CFF]/,
  'ml-IN': /[\u0D00-\u0D7F]/, 'bn-IN': /[\u0980-\u09FF]/, 'hi-IN': /[\u0900-\u097F]/, 'mr-IN': /[\u0900-\u097F]/,
  'en-IN': /[A-Za-z]/,
};

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: 430, height: 940 } });
await context.grantPermissions(['microphone'], { origin: APP });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${APP}/?voice=gnani`, { waitUntil: 'networkidle' });
await page.waitForSelector('#heardText');
await page.waitForFunction(() => window.__ledgent?.S?.voice?.mode === 'gnani', { timeout: 8000 }).catch(() => {});

// Select the language the way a shopkeeper would: open the chooser, pick Telugu.
const before = await page.evaluate(() => window.__ledgent.S.lang);
await page.locator('#langBtn').click();
await page.locator('#langMenu button', { hasText: wantLang }).first().click();
await page.waitForTimeout(200);
const selected = await page.evaluate(() => ({
  lang: window.__ledgent.S.lang,
  engineLang: window.__ledgent.S.voice?.engine?.lang,
  langLbl: document.querySelector('#langLbl')?.textContent,
  banner: document.querySelector('#bannerText')?.textContent,
}));
console.log(`language before: ${before} → after chooser: ${selected.lang} (engine ${selected.engineLang}, label ${selected.langLbl})`);
console.log(`disclosure now: ${selected.banner}`);

// Hold the button like a user and let the fake microphone stream for ~4.5s.
const box = await page.locator('#holdBtn').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(4500);
await page.mouse.up();

let result = null;
try {
  await page.waitForFunction(() => (window.__ledgent?.S?.rawTranscript || '').length > 0, { timeout: 20000 });
  result = await page.evaluate(() => {
    const S = window.__ledgent.S;
    return {
      lang: S.lang,
      sttRequested: S.sttRequested,
      detected: S.detectedLang,
      transcript: S.rawTranscript,
      status: document.querySelector('#statusText')?.textContent,
      trace: document.querySelector('#langTrace')?.textContent,
      draft: document.querySelector('#draftText')?.textContent,
      heardRaw: document.querySelector('#heardRawText')?.textContent,
      micMode: S.voice?.mode,
    };
  });
} catch {
  result = await page.evaluate(() => ({
    lang: window.__ledgent.S.lang,
    sttRequested: window.__ledgent.S.sttRequested,
    detected: window.__ledgent.S.detectedLang,
    transcript: window.__ledgent.S.rawTranscript,
    status: document.querySelector('#statusText')?.textContent,
    trace: document.querySelector('#langTrace')?.textContent,
    draft: document.querySelector('#draftText')?.textContent,
    micMode: window.__ledgent.S.voice?.mode,
  }));
}

await page.screenshot({ path: 'tests/artifacts/08-real-mic-telugu.png' });
console.log(JSON.stringify(result, null, 2));
console.log(`page errors: ${errors.length ? errors.join('; ') : 'none'}`);

const scriptOk = SCRIPT[wantLang]?.test(result.transcript || '') ?? false;
const checks = [
  ['selector changed the active language', result.lang === wantLang],
  ['gateway session asked for that language', result.sttRequested === wantLang],
  ['transcript is in the expected script', scriptOk],
  ['UI trace shows the language chain', (result.trace || '').includes(wantLang)],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed ? `MIC SESSION FAILED (${failed})` : 'MIC SESSION OK');
await browser.close();
process.exit(failed ? 1 : 0);
