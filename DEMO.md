# Ledgent — live demo (2–3 minutes) and pitch outline (6 slides)

Before the judges arrive: `npm start` (app on :8199), `npm run gateway` (gateway on
:8787), open `http://localhost:8199/?voice=gnani`, confirm the badge reads
**GNANI VOICE**. Close other tabs that might hold the microphone.

## Live demo script (2:30)

**0:00 — 0:15 · Start clean**
"Yeh Ledgent hai — dukaan ka khata, bolne se likhta hai." Press the notebook once.
Ledgent identifies itself as an AI in Hindi and the status line says Listening.

**0:15 — 0:45 · A credit entry**
Hold the notebook and say: *"Ramesh ka teen sau chaalis udhaar."* Release.
Prisma writes the sentence onto the ruled page character by character. The pencil
draft appears: Ramesh, ₹340, udhaar. Ledgent reads it back with Timbre and asks
for confirmation. Tap **Confirm** — the pencil line turns into blue ink and the
balance above the page updates.

**0:45 — 1:10 · A payment**
Hold, say: *"Suresh ne paanch sau rupaye diye."* Release. Direction is detected as
a payment, readback is spoken, confirm, balance drops by ₹500.

**1:10 — 1:30 · Same-name question and a correction**
Hold, say: *"Ramesh ka do sau udhaar."* Ledgent asks *"Sabzi wale Ramesh ya Doodh
wale Ramesh?"* — tap one. Then say *"nahi, 430"*: the draft amount becomes ₹430
before anything is saved. Confirm.

**1:30 — 1:50 · A spoken query**
Hold, say: *"Suresh ka total?"* The answer comes from the local ledger and Timbre
speaks it. Point at the latency panel: speech end → transcript → parse → first
audio, all measured, nothing estimated.

**1:50 — 2:10 · Barge-in**
Hold while Ledgent is still speaking: playback stops instantly and a new listening
session starts. "Ledgent never talks over the shopkeeper."

**2:10 — 2:30 · Integrity and privacy**
Tap **Book verified** → "Book verified, N entries intact". Optionally tap the
tamper tool → the label turns red, showing the hash chain is real. Close with:
"Audio goes to Gnani; the khata stays on this phone."

Fallback if the room's network fails: reload with `?voice=mock` — same UI, scripted
transcripts — and say plainly that this is the scripted demo, not the live API.

## Pitch outline (6 slides)

1. **The paper khata is not broken — the apps are.** 12 million kirana shops still
   write credit by hand because typing mid-counter costs more than it saves.
2. **Speak, don't type.** Hold the notebook, speak Hinglish/Telugu/Tamil/Marathi,
   release. Prisma v3.0 transcribes, the on-device parser extracts who / how much /
   credit-or-payment, and the entry is written into the same ruled page.
3. **Trust is the product.** Pencil draft → spoken readback (Timbre v3.0) → explicit
   confirmation → blue ink. Ambiguous speech (two Rameshes, unclear direction,
   "migilindi") produces a question, never a guess.
4. **Built for the counter, not the cloud.** Deterministic parser and hash-chained
   ledger on the device; only audio and the reply text leave the phone; a 700-line
   Node gateway holds the key with origin checks, single-use tokens and rate limits.
5. **Measured, not claimed.** Real numbers: TTS first audio 424 ms, Prisma server
   latency ~101 ms, gateway handshake 520 ms; 352 automated tests; the language
   matrix and its gaps are published in the README.
6. **Next.** Native-speaker validation for Punjabi and Malayalam, a 20-run latency
   study on a low-end Android phone, and a printed-statement bridge so the digital
   khata and the paper one agree.
