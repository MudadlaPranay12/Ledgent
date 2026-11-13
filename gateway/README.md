# Ledgent voice gateway

Small Node service that holds the Gnani API key and bridges the browser to
**Prisma v3.0** (streaming STT) and **Timbre v3.0** (streaming TTS). Native
`node:http` + `ws`. No Docker, no framework, no database.

## Run

```bash
cd gateway
npm install
cp .env.example .env     # then set GNANI_API_KEY and ALLOWED_ORIGIN
node server.js           # or: npm start
```

```
GET /health    -> {status, stt, tts, model, ttsModel, ttsVoice, uptimeSec}
GET /session   -> {token, expires}        (origin checked, rate limited, 10 min TTL)
WS  /voice?token=...                      (single-use token, origin checked)
```

## Socket protocol

Browser → gateway:

| message | meaning |
| --- | --- |
| `{"type":"start","lang":"hi-IN","format":"transcribe"}` | open the upstream Prisma socket |
| binary frame | exactly 1024 bytes of PCM16 mono 16 kHz |
| `{"type":"commit"}` | end this utterance, keep the session |
| `{"type":"stop"}` | hard end of speech: commit + close upstream |
| `{"type":"tts","id":1,"text":"...","lang":"hi-IN"}` | synthesize one reply |
| `{"type":"tts_cancel"}` | barge-in: abort synthesis, drop the queue |

Gateway → browser: `connected`, `stt_ready`, `processing`,
`transcript {text, detected_language_code, latency_ms, audio_duration_ms}`,
`tts_start`, `tts_audio {id, seq, audio(base64 PCM)}`, `tts_end`, `error`.

## Guarantees

* The API key never leaves the server; startup logs only say whether it is present.
* No microphone audio and no transcript text is written to disk.
* `usage.json` (gitignored) holds request counts and timings only.
* One TTS request at a time per connection, matching the documented upstream limit.
* Origin allowlist and single-use tokens; `/session` is rate limited per IP.

## Deploy (no Docker)

Render: use `render.yaml` in the repository root (`runtime: node`,
`startCommand: node gateway/server.js`, health check `/health`). Railway: same
command, set the environment variables in the dashboard. `ALLOWED_ORIGIN` must be
the exact deployed frontend origin, e.g. `https://ledgent.netlify.app`.
