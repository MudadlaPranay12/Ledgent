# Ledgent — voice-first khata for Indian kirana shops

A shopkeeper holds the phone, speaks across the counter, and the transaction is
written into their notebook. Speech recognition is **Gnani Prisma v3.0**, speech
synthesis is **Gnani Timbre v3.0**, both streamed over WebSocket through a small
Node gateway that holds the API key. The ledger itself never leaves the device.

Hackathon: Gnani Voice Hackathon, Problem Statement 2.

---

## 1. Problem statement

Small shopkeepers keep credit ("udhaar") in a paper khata because typing an entry
mid-counter is slower than the conversation. Existing apps assume a form, a
keyboard, and English. The shopkeeper speaks Hinglish, Telugu, Tamil or Marathi,
often in one sentence, and cares about three things only: who, how much, and
whether it was credit or payment.

## 2. The Ledgent solution

* **Hold to talk.** Press the notebook, speak, release. Release is the hard
  endpoint; a new press while Ledgent is speaking cuts it off (barge-in).
* **Prisma writes the sentence onto the page** in a hand-written style, then the
  deterministic parser turns it into a pencil draft: customer, amount, direction,
  date.
* **Ledgent reads the draft back** with Timbre and asks before saving. Nothing is
  committed without confirmation.
* **Confirmed entries become blue ink** in an event-sourced, hash-chained ledger
  stored on the device (IndexedDB).
* **Spoken queries** ("Suresh ka total?", "aaj kitna udhaar gaya?") are answered
  locally from that ledger and spoken back.
* **Corrections** ("nahi, 430") reverse the original event and post a replacement;
  the hash chain still verifies.

## 3. Architecture

```
 Android Chrome (static HTML/CSS/JS, no build step)
 ┌───────────────────────────────────────────────────────────────┐
 │ index.html + js/app.js        notebook UI, drafts, ledger view │
 │ js/voice-gnani.js             gateway client, PCM playback     │
 │ js/audio-capture.js           AudioWorklet mic → 16 kHz PCM16  │
 │ js/parser.js + js/lexicon/*   deterministic multilingual parse │
 │ js/ledger.js                  hash-chained events in IndexedDB │
 └───────────────┬───────────────────────────────────────────────┘
                 │  GET /health, GET /session (short-lived token)
                 │  WS /voice  (Origin checked, token single-use)
 ┌───────────────▼───────────────────────────────────────────────┐
 │ gateway/server.js            native Node http + ws, no Docker  │
 │   · holds GNANI_API_KEY (server-side only)                     │
 │   · forwards exactly 1024-byte PCM16 frames upstream           │
 │   · streams Timbre PCM chunks back as base64                   │
 │   · cancellation, barge-in, rate limit, usage counter          │
 └───────┬───────────────────────────────────┬───────────────────┘
         │ WSS stt/v3/stream                 │ WSS api/v1/tts
 ┌───────▼────────────┐            ┌─────────▼──────────┐
 │ Gnani Prisma v3.0  │            │ Gnani Timbre v3.0  │
 └────────────────────┘            └────────────────────┘
```

Data that leaves the phone: microphone audio (to the gateway, then to Prisma) and
the short text of a spoken reply (to Timbre). Customer records, balances and the
ledger stay in the browser's IndexedDB; no LLM or external service receives them.

## 4. Setup — frontend and gateway

Requirements: Node 20+ (tested on 24.11.1), a Chromium-based browser, a Gnani API
key.

```bash
# 1. static app (no build step)
npm install
npm start                      # http://localhost:8199

# 2. gateway
cd gateway && npm install
cp .env.example .env           # then put the real key in gateway/.env
cd .. && npm run gateway       # http://localhost:8787
```

`gateway/.env` is gitignored and is the only place the key may exist locally:

```
GNANI_API_KEY=...
ALLOWED_ORIGIN=http://localhost:8199
GATEWAY_PORT=8787
GNANI_TTS_VOICE=Shivani
```

Open `http://localhost:8199/?voice=gnani`. If the gateway is unreachable the app
falls back to browser speech **with a loud "DEV VOICE" badge** — that fallback is
a development convenience, never the production path.

Useful URL flags: `?voice=mock` (scripted transcripts for demos/tests),
`?voice=dev` (browser speech), `?lang=te-IN`, `?gw=https://gateway.example.com`
(deployed gateway), `?format=codemix` (Prisma code-mix mode).

## 5. Gnani Prisma v3.0 integration

Verified against `docs.gnani.ai` and by live calls:

| Item | Value |
| --- | --- |
| Endpoint | `wss://api.vachana.ai/stt/v3/stream` |
| Auth header | `x-api-key-id` |
| Model header | `model: prisma-v3.0` |
| Language | `language_code: hi-IN` (exactly one locale; the API rejects a comma list — parallel locales need `multi_lang_codes`) |
| Auto detect | `language_code: indic-auto` |
| Audio | raw PCM, signed 16-bit LE, mono, 16 kHz |
| Framing | exactly 1024-byte frames, ~32 ms cadence |
| Modes | `format: transcribe` (default: numbers as digits) or `codemix` |
| End of utterance | client sends `{"type":"commit"}` |
| Server events | `connected`, `processing`, `transcript`, `error` |

Browser side: `getUserMedia` with `noiseSuppression`, `echoCancellation`,
`autoGainControl` → `AudioWorklet` (`js/pcm-worklet.js`) that resamples to 16 kHz
with linear interpolation and emits 512 Int16 samples (1024 bytes) per message.
The 48 kHz stream is never relabelled as 16 kHz.

## 6. Gnani Timbre v3.0 integration

| Item | Value |
| --- | --- |
| Endpoint | `wss://api.vachana.ai/api/v1/tts` |
| Auth header | `X-API-Key-ID` |
| Model | `model: timbre-v3.0` |
| Voice | `Shivani` (female, from the v3.0 catalogue; configurable) |
| Request | `{text, voice, model, language, speed, audio_config}` |
| `audio_config` | `sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: linear_pcm, container: raw` |
| Responses | `start`, `audio` (base64 chunks, `is_final`), `complete`, `error` |

Chunks are forwarded to the browser as they arrive and scheduled into a Web Audio
buffer queue; playback starts on the first chunk instead of waiting for `complete`.
Barge-in stops local sources and sends `tts_cancel`, which closes the upstream
synthesis socket and drops queued utterances.

Amounts are spoken as words before synthesis where the parser has a spoken form
(e.g. ₹340 → "teen sau chaalis rupaye"); the readback also offers digit-by-digit
confirmation ("teen-char-shunya rupaye, sahi?") when confidence is low.

## 7. Gnani services used

* Prisma v3.0 — streaming speech recognition (WebSocket).
* Timbre v3.0 — streaming speech synthesis (WebSocket).
* No voice cloning, no REST STT for the live microphone path.

## 8. Actual language support (measured, not claimed)

Prisma is asked for one language at a time, or `indic-auto`. The parser has
lexicons for ten languages plus Hinglish/English mixing. "Tested" below means
**automated parser tests**, except where real audio is named explicitly.

Speech recognition and transaction parsing are separate concerns and are tested
separately. `scripts/verify-languages.mjs` speaks a natural sentence with Timbre,
streams that audio back through Prisma, and then asks the parser what it made of
the transcript. Real output (`tests/language-evidence.json`):

| Language | Audio received | Transcript | Explicit lang honoured | Auto (indic-auto) | Parsed | Transcript kept |
| --- | --- | --- | --- | --- | --- | --- |
| Hindi | yes (90 frames) | "रमेश का 340 रुपये उधार लिख दो।" | yes | hi-IN ✓ | transaction, ₹340 credit | yes |
| English | yes (75) | "Give Suresh 300 rupees credit." | yes | en-IN ✓ | ₹300 credit, Suresh | yes |
| Telugu | yes (65) | "గోపాల్ కి 300 రూపాయల అప్పు." | yes | te-IN ✓ | ₹300 credit, Gopal | yes |
| Tamil | yes (68) | "ரமேஷுக்கு 300 ரூபாய் கடன்." | yes | ta-IN ✓ | ₹300 credit, Ramesh (ambiguous) | yes |
| Kannada | yes (63) | "ರಮೇಶ್ ಗೆ 300 ರೂಪಾಯಿ ಸಾಲ." | yes | **kn-IN ✗** (heard Hindi) | ₹300 credit, Ramesh (ambiguous) | yes |
| Malayalam | yes (65) | "രമേശിന് 300 രൂപ കടം." | yes | ml-IN ✓ | ₹300 credit, Ramesh (ambiguous) | yes |
| Bengali | yes (55) | "রমেশের 300 টাকা বাকি।" | yes | bn-IN ✓ | ₹300 credit, Ramesh (ambiguous) | yes |
| Marathi | yes (73) | "रमेशला 300 रुपये उधार." | yes | **mr-IN ✗** (heard Hindi) | ₹300 credit, Ramesh (ambiguous) | yes |

"Ramesh (ambiguous)" is correct behaviour: the demo data has two shopkeepers
named Ramesh, so Ledgent asks which one instead of picking.

Two honest caveats about this table. First, the audio is **Timbre-synthesised**,
not a human voice, so it is a development proxy and not native-speaker
validation. Second, **`indic-auto` misidentified Kannada as Hindi** (the returned
transcript was Devanagari and garbled) and reported Hindi for Marathi. Explicit
language selection was correct for all eight, and that is what the UI uses unless
the operator chooses AUTO.

Punjabi and Malayalam lexicon entries are best-effort and marked `// unverified`
in `js/lexicon/pa.js` and `ml.js`; they were not audio-tested here.

### Recognition is not parsing

The transcript is a first-class result. `handleUtterance()` always stores the raw
sentence (`S.rawTranscript`) and shows it in a `Prisma suna` line under the
listening strip, plus the detected language. If the parser cannot turn it into a
transaction, the UI keeps the transcript on screen and asks for the missing
pieces ("Suna: \"…\". Kaunsa customer, kitna, udhaar ya payment?") with *Dobara
boliye* and *Type karein* actions. It never replaces real words with a generic
"Samajh nahi aaya". The parser works from tokens and numbers, not a phrase list:
word order, code-mixing, glued Bengali hundreds ("তিনশো"), Indian amount words
("dhai sau", "saade teen sau") and case endings on names ("Rameshinu",
"ரமேஷுக்கு", "রমেশের", "रमेशला") are all handled.

## 9. Run instructions (local and deployed)

Local: section 4. HTTPS is required for microphone access in a deployed app.

Frontend → Netlify (`netlify.toml`) or Vercel (`vercel.json`): publish the
repository root, no build step. Then open the site with
`?gw=https://<gateway-host>` once, or store the gateway URL in the browser.

Gateway → Render (`render.yaml`) or Railway, native Node, no Docker:

```bash
cd gateway && npm install --omit=dev
node server.js
```

Set `GNANI_API_KEY` and `ALLOWED_ORIGIN=https://<your-static-site>` as service
secrets, and `GATEWAY_PORT` if the platform requires it. Health check:
`GET https://<gateway-host>/health` → `{"status":"ok","stt":"configured",...}`.

**Deployment status: not deployed.** No hosting account or credentials were
available in this environment, so the tunnel deploy check has not been run.

## 10. Responsible AI and data handling

* First turn: Ledgent says it is an AI, in the selected language (ten short
  disclosures in `js/lang.js`, Hinglish as the fallback).
* Synthetic demo customers only; the ledger lives on the device.
* No raw audio and no transcripts are written to disk by the app or the gateway.
  The gateway's usage counter stores counts and timings only.
* Nothing is saved without confirmation; corrections preserve the original entry
  as a reversal plus replacement event.
* No lending, no collection pressure, no reminders in this voice build.
* The API key never reaches the browser; `gateway/.env` is gitignored.

## 11. Testing

```bash
npm test                 # 352 passed, 0 failed across 9 files
npm run e2e              # Playwright, real Chromium, 8 checks + screenshots
node scripts/gnani-smoke.mjs "Ramesh ka teen sau chaalis udhaar" hi-IN
node scripts/gateway-live-check.mjs
node scripts/stt-benchmark.mjs --langs hi-IN --limit 5
node scripts/verify-languages.mjs                 # real audio, all 8 languages
node scripts/verify-languages.mjs --langs ml-IN   # re-check one, keeps earlier rows
node scripts/transcript-display-check.mjs         # Playwright: transcript survives a parse failure
```

`npm test` exits non-zero **only** because `tests/run.mjs` is a 39-byte
placeholder: the original 41-test suite was not recoverable from this folder (no
git history existed before this work). Everything else passes. Screenshots land
in `tests/artifacts/`.

Tests use a fake upstream (`tests/gateway.test.mjs`), so unit tests never spend
Gnani credits.

## 12. Measured evidence and known limitations

Real API runs (this machine, Node 24, November 2026):

```
Timbre v3.0 -> Prisma v3.0 loop
voice: Shivani (timbre-v3.0)   language: hi-IN
input text: Ramesh ka teen sau chaalis udhaar
TTS ok: 27 chunks, 69120 bytes PCM16 @16k (2.16s audio)
TTS request -> first audio chunk: 424 ms
TTS request -> stream complete:   1574 ms
STT ok: 1 transcript segment(s)
  transcript: "रमेश का 340 उधार।"
  detected_language_code: hi-IN   server latency: 101   audio_duration_ms: 2160
```

```
gateway GET /health -> {"status":"ok","stt":"configured","model":"prisma-v3.0",...}
GET /session (foreign origin) -> 403
GET /session (allowed origin) -> 200
WS /voice -> open (token accepted) -> connected -> stt_ready
real Prisma handshake through the gateway: OK (520 ms)
```

Hindi matrix, 5 categories (synthetic Timbre speech as input):

```
credit     "रमेश का 340 उधार।"          amount ✓  direction ✓  ambiguity flagged ✓
payment    "सुरेश ने 500 रुपये दिए।"     amount ✓  direction ✓  customer ✓
correction "नहीं, 430।"                 amount ✓  correction ✓
query      "सुरेश का टोटल कितना है?"     query ✓   customer ✓
ambiguity  "रमेश का 200 उधार।"          amount ✓  ambiguity flagged ✓

amount accuracy 4/4 · direction 4/4 · customer 2/3 · ambiguity 1/1 · 5 API calls
```

The one "customer miss" is two shopkeepers both named Ramesh in the demo data:
the parser correctly refuses to pick one and asks. For that reason the matrix now
expects ambiguity on bare "Ramesh" rows.

Not done / not verified:

* **No live microphone session was tested.** This machine has no microphone in
  the automated environment, so the mic → Prisma → UI path is implemented and
  unit-tested at the gateway boundary but not exercised end-to-end by a human
  voice. The eight-language evidence above used Timbre-synthesised audio; the
  displayed-transcript contract was checked in Chromium by injecting the exact
  Prisma strings (screenshot `tests/artifacts/06-transcript-preserved.png`).
* **`indic-auto` is unreliable for Kannada and Marathi** in this test: it
  misdetected Kannada as Hindi. Explicit language selection was correct for all
  eight languages, so the default is an explicit choice.
* **No real-voice latency p50/p95.** Only the numbers above were measured, and
  headless runs are excluded by definition. Use `scripts/stt-benchmark.mjs` with a
  real microphone and `tests/recorder.html` to collect 20+ runs.
* **Telugu synthetic proxy failed on one word**: Timbre pronounced "migilindi" as
  "मिलीलीटर" ("millilitre"), so the transcript contained a unit, not the balance
  word. The parser handles the same sentence when the transcript is right
  (`गोपाल का पैसा 300 मिगिलिंदी।` → balance question, never a guess), and it
  strips the Devanagari danda that real transcripts end with.
* Native number words exist for Hindi/English and a basic Telugu set; other
  languages rely on digits in the transcript.
* Netlify/Vercel/Render deployment was not executed.
