// Verifies the UI contract: a recognised transcript is displayed and kept even
// when the transaction parser cannot understand it. Uses the mock voice so no
// microphone is needed, and injects the exact strings Prisma returned in
// tests/language-evidence.json.
import fs from 'node:fs';
import { chromium } from 'playwright';

const APP = process.env.APP_URL || 'http://localhost:8199';
const evidence = (() => {
  try { return JSON.parse(fs.readFileSync('tests/language-evidence.json', 'utf8')).results || []; }
  catch { return []; }
})();
const byLang = (code) => evidence.find((r) => r.lang === code)?.stt?.explicitTranscript || null;
const kn = byLang('kn-IN') || 'ರಮೇಶ್ ಗೆ 300 ರೂಪಾಯಿ ಸಾಲ.';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${APP}/?voice=mock`, { waitUntil: 'networkidle' });
await page.waitForSelector('#heardText');

// 1. Recognised Kannada transcript, parseable transaction
await page.evaluate((t) => window.__ledgent.handleUtterance(t, 'voice'), kn);
await page.waitForTimeout(400);
const rawKn = (await page.locator('#heardRawText').textContent()) || '';
const rawVisible = await page.locator('#heardRaw').isVisible();
const draftKn = (await page.locator('#draftText').textContent()) || '';
console.log(`Kannada transcript shown: ${rawVisible && rawKn.includes('ರಮೇಶ್') ? 'YES' : 'NO'} — ${rawKn.trim()}`);
console.log(`Kannada draft: ${draftKn.trim()}`);

// 2. Real transcript that is NOT a transaction
const stray = 'मुझे कल बाजार जाना है और दूध लाना है';
await page.evaluate((t) => window.__ledgent.handleUtterance(t, 'voice'), stray);
await page.waitForTimeout(400);
const heard = (await page.locator('#heardText').textContent()) || '';
const rawStray = (await page.locator('#heardRawText').textContent()) || '';
const draftStray = (await page.locator('#draftText').textContent()) || '';
const status = (await page.locator('#statusText').textContent()) || '';
const choices = await page.locator('#choices button').allTextContents();

const transcriptKept = heard.includes('बाजार') && rawStray.includes('बाजार');
const notGeneric = !/^samajh nahi aaya/i.test(heard.trim());
console.log(`stray transcript still on screen: ${transcriptKept ? 'YES' : 'NO'}`);
console.log(`  #heardText: ${heard.trim()}`);
console.log(`  #heardRaw:  ${rawStray.trim()}`);
console.log(`  clarify:    ${draftStray.trim()}`);
console.log(`  status:     ${status.trim()}`);
console.log(`  choices:    ${choices.join(' | ')}`);

await page.screenshot({ path: 'tests/artifacts/06-transcript-preserved.png' });
console.log(`screenshot: tests/artifacts/06-transcript-preserved.png`);
console.log(`page errors: ${errors.length ? errors.join('; ') : 'none'}`);

const ok = rawVisible && transcriptKept && notGeneric && /customer|amount/i.test(draftStray) && errors.length === 0;
console.log(ok ? 'TRANSCRIPT DISPLAY OK' : 'TRANSCRIPT DISPLAY FAILED');
await browser.close();
process.exit(ok ? 0 : 1);
