// Real-Chromium end-to-end test. Launches Playwright, serves the app, drives it
// with ?voice=mock, saves screenshots and FAILS on console errors or missing tabs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = path.join(ROOT, 'tests', 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'playwright', 'package.json'), 'utf8'));
const shots = [];
const failures = [];

const server = createStaticServer(ROOT);
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

console.log(`Playwright version: ${pkg.version}`);
console.log(`Serving ${ROOT} at ${base}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 860 } });

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => consoleErrors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));

async function shot(name, label) {
  const file = path.join(ARTIFACTS, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ file, label });
  return file;
}

function check(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
}

try {
  await page.goto(`${base}/?voice=mock&lang=hi-IN`, { waitUntil: 'load' });

  // 1. Initial page with seeded customer tabs
  await page.waitForSelector('#tabs .tab', { timeout: 10000 });
  const tabCount = await page.locator('#tabs .tab').count();
  check(tabCount >= 5, `customer tabs rendered (${tabCount})`);
  check(await page.locator('#errorBox').isHidden(), 'no fatal error overlay');
  const badge = await page.locator('#voiceBadge').textContent();
  console.log(`voice badge: ${badge}`);
  await shot('01-initial-tabs.png', 'initial page with customer tabs');

  // 2. Draft with a pencil line
  await page.getByRole('button', { name: 'Suresh ka 340 udhaar', exact: true }).click();
  await page.waitForSelector('#lines li.draft', { timeout: 8000 });
  const draftText = await page.locator('#draftText').textContent();
  const status = await page.locator('#statusText').textContent();
  console.log(`draft readback: ${draftText}`);
  console.log(`status: ${status}`);
  check(/340/.test(draftText || ''), 'draft readback shows 340');
  check(/Needs confirmation/.test(status || ''), 'status says Needs confirmation');
  // the pencil line uses a .7s write animation; let it finish before capturing
  await page.waitForTimeout(1000);
  const draftLine = await page.locator('#lines li.draft').first().textContent();
  console.log(`draft line: ${draftLine}`);
  check(/340/.test(draftLine || ''), 'pencil draft line visible in the notebook');
  await shot('02-draft-pencil.png', 'draft with pencil line');

  // 3. Two-Ramesh disambiguation
  await page.getByRole('button', { name: 'Ramesh ka 150 udhaar', exact: true }).click();
  await page.waitForFunction(() => {
    const t = document.querySelector('#draftText')?.textContent || '';
    return /Sabzi wale Ramesh/.test(t) && /Doodh wale Ramesh/.test(t);
  }, { timeout: 8000 });
  const question = await page.locator('#draftText').textContent();
  console.log(`question: ${question}`);
  check(/Sabzi wale Ramesh/.test(question) && /Doodh wale Ramesh/.test(question), 'two-Ramesh question shown');
  await page.waitForTimeout(1000);
  await shot('03-two-ramesh.png', 'two-Ramesh disambiguation question');

  // Answer it, save, then tamper and verify -> red
  await page.locator('#choices button').first().click();
  await page.waitForFunction(() => !document.querySelector('#draftText')?.textContent?.includes('ya Doodh'), { timeout: 8000 });
  await page.locator('#confirmBtn').click();
  await page.waitForFunction(() => /Saved/.test(document.querySelector('#statusText')?.textContent || ''), { timeout: 8000 });

  await page.locator('#dbgBtn').click();
  await page.locator('#tamperBtn').click();
  await page.waitForFunction(() => document.querySelector('#verifyBtn')?.classList.contains('bad'), { timeout: 8000 });
  const verifyLabel = await page.locator('#verifyBtn .lbl').textContent();
  console.log(`verify label: ${verifyLabel}`);
  check(/TAMPERED/.test(verifyLabel || ''), 'Book verified turns red after tamper');
  await shot('04-book-tampered.png', 'Book TAMPERED after tamper');

  // 4. Hold-to-talk in mock mode must reach the same pipeline
  await page.locator('#wipeBtn').click();
  await page.waitForFunction(() => /Saved|Listening/.test(document.querySelector('#statusText')?.textContent || ''), { timeout: 8000 });
  const box = await page.locator('#holdBtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForFunction(() => {
    const t = document.querySelector('#heardText')?.textContent || '';
    return t.length > 3 && !/Dabaake boliye/.test(t);
  }, { timeout: 8000 });
  const heard = await page.locator('#heardText').textContent();
  console.log(`heard after hold: ${heard}`);
  check(heard.trim().length > 3, 'hold-to-talk produced a transcript');
} catch (e) {
  failures.push(`exception: ${e.message}`);
  console.log(`FAIL  exception: ${e.message}`);
  try { await shot('99-failure.png', 'failure state'); } catch { /* ignore */ }
}

if (consoleErrors.length) {
  console.log('\nConsole/page errors:');
  for (const e of consoleErrors) console.log(`  - ${e}`);
  failures.push(`${consoleErrors.length} console error(s)`);
}

await browser.close();
await new Promise((res) => server.close(res));

console.log('\nScreenshots:');
for (const s of shots) console.log(`  ${path.relative(ROOT, s.file).replace(/\\/g, '/')}  — ${s.label}`);

if (failures.length) {
  console.log(`\nE2E FAILED (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nE2E OK — all checks passed');
process.exit(0);
