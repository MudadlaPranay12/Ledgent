// Checks that one active language actually drives the UI: transcript script,
// transaction labels, clarification text and the language handed to Timbre.
// Uses the mock voice (no microphone) and stubs speak() to capture the payload.
import { chromium } from 'playwright';

const APP = process.env.APP_URL || 'http://localhost:8199';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${APP}/?voice=mock`, { waitUntil: 'networkidle' });
await page.waitForSelector('#heardText');

// Capture what would be sent to Timbre and the language it is tagged with.
await page.evaluate(() => {
  window.__tts = [];
  const engine = window.__ledgent.S.voice.engine;
  const real = engine.speak.bind(engine);
  engine.speak = (text, lang) => { window.__tts.push({ text, lang }); return Promise.resolve(false); };
  window.__realSpeak = real;
});

const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

// Hindi (default) → English → Telugu via the language button.
await page.locator('#langBtn').click();
await page.locator('#langBtn').click();
await page.waitForTimeout(200);
const langCode = await page.evaluate(() => window.__ledgent.S.lang);
check('language switched to Telugu', langCode === 'te-IN', langCode);

const telugu = 'సురేష్ కి 340 అప్పు';
await page.evaluate((t) => window.__ledgent.handleUtterance(t, 'voice'), telugu);
await page.waitForTimeout(400);

const raw = (await page.locator('#heardRawText').textContent()) || '';
const draft = (await page.locator('#draftText').textContent()) || '';
const chips = await page.locator('#chips .chip-ex').allTextContents();
const hold = (await page.locator('#holdBtn .holdText').textContent()) || '';
const confirmLabel = (await page.locator('#confirmBtn').textContent()) || '';
const tts = await page.evaluate(() => window.__tts);

check('Telugu transcript shown in Telugu script', raw.includes('సురేష్') && !/[\u0900-\u097F]/.test(raw), raw.trim().slice(0, 48));
check('transaction label is Telugu (అప్పు)', draft.includes('అప్పు'), draft.trim());
check('no Hindi word "udhaar" in the readback', !/udhaar/i.test(draft), draft.trim());
check('example chips are Telugu', chips[0]?.includes('అప్పు') === true, chips[0]);
check('hold button localised', /పట్టుకోండి/.test(hold), hold);
check('confirm button localised', /నిర్ధారించు/.test(confirmLabel), confirmLabel);
const banner = (await page.locator('#bannerText').textContent()) || '';
check('AI disclosure banner is Telugu', /[\u0C00-\u0C7F]/.test(banner), banner.trim().slice(0, 40));
check('Timbre call tagged te-IN', tts.some((c) => c.lang === 'te-IN'), JSON.stringify(tts.map((c) => c.lang)));
check('Timbre text is Telugu', tts.some((c) => /[\u0C00-\u0C7F]/.test(c.text)), tts.map((c) => c.text).join(' | ').slice(0, 80));

// A real Telugu sentence that is not a transaction must still show, in Telugu.
await page.evaluate(() => window.__ledgent.handleUtterance('నాకు రేపు బజారుకు వెళ్లాలి', 'voice'));
await page.waitForTimeout(400);
const strayDraft = (await page.locator('#draftText').textContent()) || '';
const strayHeard = (await page.locator('#heardText').textContent()) || '';
check('Telugu clarification is localised', /ఎవరు|ఎంత/.test(strayDraft), strayDraft.trim());
check('Telugu transcript preserved on parse failure', strayHeard.includes('బజారుకు'), strayHeard.trim());

// A wrong-language recognition must be flagged, not silently accepted.
await page.evaluate(() => { window.__ledgent.S.detectedLang = 'hi-IN'; });
await page.evaluate(() => window.__ledgent.handleUtterance('సురేష్ కి 340 అప్పు', 'voice'));
await page.waitForTimeout(300);
const warn = (await page.locator('#heardRawText').textContent()) || '';
check('wrong-language warning shown', /⚠/.test(warn) && /hi-IN/.test(warn), warn.trim().slice(-60));

await page.screenshot({ path: 'tests/artifacts/07-telugu-ui.png' });
console.log('screenshot: tests/artifacts/07-telugu-ui.png');
console.log(`page errors: ${errors.length ? errors.join('; ') : 'none'}`);
const failures = checks.filter((c) => !c.pass).length + errors.length;
console.log(failures ? `LANGUAGE UI FAILED (${failures})` : 'LANGUAGE UI OK');
await browser.close();
process.exit(failures ? 1 : 0);
