# Ledgent - UPI-like Rupees Ledger Assistant

## Setup

### Prerequisites
- Node.js >= 18
- Python3 (for local server)
- Gnani API key (for production mode)
- ALLOWED_ORIGIN (for WebSocket security)

### Installation
```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Gnani API key and allowed origin

# Start the development server
npm start
# This runs python3 -m http.server 8080

# Or use the development mode
npm run dev
```

### Environment Variables
Create a `.env` file based on `.env.example`:

```
GNANI_API_KEY=your_gnani_api_key_here
ALLOWED_ORIGIN=https://your-domain.com
GATEWAY_PORT=3000
VOICE=gnani  # or "mock" for development
```

### Available Scripts
- `npm test` - Run every `tests/*.test.mjs` plus `tests/run.mjs` via `tests/all.mjs`, printing per-file counts and a grand total
- `npm run e2e` - Real Chromium (Playwright) run with `?voice=mock`; saves screenshots to `tests/artifacts/`
- `npm run check` - Run both test and E2E
- `npm start` - Static dev server on `http://localhost:8080` (`scripts/serve.mjs`)
- `npm run phrases` - Regenerate `tests/phrases.json` and run the phrase suite

`tests/run.mjs` is currently a placeholder: the original 41-test suite was lost and this folder has no git history to restore it from. `tests/all.mjs` reports it as `NO TESTS` until the original file is supplied.

## Architecture

### Overview
Ledgent is a UPI-like rupees ledger assistant that handles voice-based financial transactions. The system consists of:

1. **Frontend (PWA)** - Browser-based UI with voice input, Guard-controlled guardrails, and PWA features
2. **Gateway Server** - Node.js + WebSocket bridge to Gnani services
3. **Gnani Services** - Speech-to-text, natural language processing, and transaction management

### Data Flow
1. User speaks via browser voice input
2. Parser tokenizes and extracts amounts from utterance
3. Guard system checks 3 guards (amount vs median, recent same type+amount, transcript conflict)
4. If guards pass, session state machine processes the transaction
5. Ledger records the transaction with full audit trail
6. Replies confirmed via readback generation

### Component Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    LEDGENT PWA (Browser)                       │
│  ┌─────────────┐  voiceinput  ┌───────────────┐  parse  ┌──────┐ │
│  │  app.js     │  ──────────→ │  numbers.js   │ ──────→ │parser│ │ │
│  └─────────────┘              └───────────────┘         └──────┘ │
│           │                                                        │
│  tokens  │  WS connection  │  guard checks  │  ledger ops │
│  ────────┼──────────────►│  ────────────►│  ───────────►│
│           │                                                        │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GATEWAY SERVER (Node.js + ws)               │
│  ┌─────────────────────┐  HTTP/Socket  ┌────────────────────┐ │
│  │  server.js          │  ────────────→│  Gnani Adapter     │ │
│  │  - Token auth     │               │  - STT/TTS         │ │
│  │  - Origin check   │               │  - DPDP compliance │ │
│  │  - Rate limiting  │               │  - RA compliance   │ │
│  └─────────────────────┘               └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GNANI PRISMA v3.0 SERVICES                   │
│  - Speech-to-text (Timbre v3.0)                                 │
│  - Natural language understanding                              │
│  - Transaction management                                      │
│  - DPDP Act compliance                                         │
│  - Rate limiting & auditing                                    │
└─────────────────────────────────────────────────────────────────┐
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEDGER & STATE MACHINE                        │
│  - MemoryStore (in-memory event store)                         │
│  - Ledger class (with sealDay, verify, replay)                 │
│  - Guard system (3 guards + checkAllGuards)                    │
│  - Reminder opt-in system                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Gnani Services Used
- **STT (Speech-to-Text)**: Timbre v3.0 integration for Hindi/Indian language voice processing
- **TTS (Text-to-Speech)**: Audio output for readbacks and confirmations
- **NLP**: Natural language understanding for parsing voice utterances
- **DPDP Act**: Data Protection and Digital Privacy Act compliance for user data
- **RA (Risk Assessment)**: Risk assessment for transaction validation

## Gnani Services

### What Receives Audio/Text
- **Gateway WebSocket**: Receives audio chunks and transcripts from the PWA
- **Gnani Adapter**: Processes audio through STT, returns parsed text and extracted amounts
- **Ledger**: Records transactions with full audit trail (event hashing, sealing, verification)
- **Guard System**: Validates transactions against 3 security guards before commit

### DPDP Note
Ledgent complies with the Digital Personal Data Protection (DPDP) Act, 2023:
- No audio or transcript data is written to disk
- All gateway WebSocket traffic is encrypted and origin-authenticated
- User data is stored only in memory during sessions
- Session tokens have short TTL (10 minutes) and are rate-limited per IP
- Users can opt-out of reminders via `reminderOptIn` flag
- No personally identifiable information is retained after session expiry

### RA Checklist
- [ ] Guard 1: Amount vs median check (5x threshold with 3+ past entries)
- [ ] Guard 2: Recent same type+amount within 10 minutes
- [ ] Guard 3: Transcript digit conflict detection
- [ ] Origin authentication for WebSocket connections
- [ ] Token-based session management with 10-minute TTL
- [ ] Rate limiting per IP (10 requests/minute)
- [ ] No disk persistence of audio or transcripts
- [ ] DPDP Act compliance for data protection
- [ ] Reminder opt-in consent mechanism

## Limitations
- Gateway requires GNANI_API_KEY and ALLOWED_ORIGIN environment variables for production
- Mock mode (`VOICE=mock`) available for development and testing only
- Full Gnani integration requires active Gnani Prisma v3.0 and Timbre v3.0 accounts
- Voice input limited to supported languages (Hindi/Indian languages)
- Concurrent sessions per customer limited by state machine idempotency
- Storage is IndexedDB (`IdbStore`, schema v2); a blocked upgrade falls back to memory and says so
- Gnani voice is used only when a gateway URL is configured and `/health` answers; otherwise the app shows the fixed badge `DEV VOICE: browser speech, not Gnani`
- Telugu/Tamil/Marathi/Bengali/Gujarati/Kannada lexicon entries marked `unverified` in `js/lexicon/*.js` were not checked with native speakers
- The optional LLM fallback (`js/llm.js`) is off by default and expects a `POST /llm` route on the gateway, which is not implemented here
- PWA features work best on Chromium-based browsers
- Offline functionality limited to cached resources only

## Deployment

### Vercel/Netlify Frontend
1. Connect repository to Vercel or Netlify
2. Set environment variables in dashboard:
   - `GNANI_API_KEY`
   - `ALLOWED_ORIGIN`
   - `VOICE=gnani` (production) or `VOICE=mock` (development)
3. Deploy on push

### Gateway on Long-Running Host
1. Build and deploy Docker container to any Node.js hosting (Render, Railway, Fly.io, etc.)
2. Set same environment variables
3. Configure CORS/origin to match frontend domain
4. Update frontend `ALLOWED_ORIGIN` to point to gateway host

### Docker Deployment
```bash
# Build
docker build -t ledgent-gateway ./gateway/

# Run
docker run -d \
  -p 3000:3000 \
  -e GNANI_API_KEY=your_key \
  -e ALLOWED_ORIGIN=https://your-domain.com \
  ledgent-gateway
```

## PWA Features
- **Manifest**: icons (192, 512, 384, 152, 144, 128, 96, 72 px), standalone mode
- **Service Worker**: never caches gateway WebSocket/API calls, versioned cache, skipWaiting, clients.claim
- **Offline**: cached essential resources only
- **Installable**: Add to home screen on supported browsers