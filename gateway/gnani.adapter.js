// Upstream Gnani clients. Protocol verified against docs.gnani.ai:
//   STT: WSS wss://api.vachana.ai/stt/v3/stream
//        headers x-api-key-id, language_code, model=prisma-v3.0, x-sample-rate,
//                format (verbatim|transcribe|codemix|transliterate), VAD tuning
//        audio: raw PCM signed 16-bit LE, mono, exactly 1024-byte frames
//   TTS: WSS wss://api.vachana.ai/api/v1/tts
//        header X-API-Key-ID; one JSON synthesis request per turn
//        replies {type:'start'}, {type:'audio',data:{audio(base64),is_final}},
//                {type:'complete'}, {type:'error'}
import WebSocket from 'ws';

export const STT_URL = 'wss://api.vachana.ai/stt/v3/stream';
export const TTS_URL = 'wss://api.vachana.ai/api/v1/tts';
export const TTS_MODEL = 'timbre-v3.0';
export const TTS_VOICE = process.env.GNANI_TTS_VOICE || 'Shivani';
export const TTS_SAMPLE_RATE = 16000;

const LANGS = new Set(['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'gu-IN', 'pa-IN', 'kn-IN', 'te-IN', 'ta-IN', 'ml-IN']);

/**
 * Language header. The live API rejects a comma list here
 * ("exactly one locale is required"); parallel locales go in multi_lang_codes.
 */
export function languageHeader(lang, auto) {
  if (auto || !lang || lang === 'auto') return 'indic-auto';
  return LANGS.has(lang) ? lang : 'indic-auto';
}

/** Optional parallel locales for Hinglish-style input. */
export function multiLangCodes(lang) {
  if (!lang || lang === 'auto' || lang === 'en-IN' || !LANGS.has(lang)) return null;
  return `${lang},en-IN`;
}

export function openStt({ apiKey, lang, auto = false, format = 'transcribe' }) {
  const headers = {
    'x-api-key-id': apiKey,
    model: 'prisma-v3.0',
    language_code: languageHeader(lang, auto),
    'x-sample-rate': '16000',
    format,
    x_vad_threshold: '0.5',
    'x-vad-threshold': '0.5',
    'x-min-silence-ms': '600',
    'x-idle-timeout-sec': '60',
    topic: 'kirana shop khata, udhaar and payment',
  };
  const multi = multiLangCodes(lang);
  if (multi && process.env.GNANI_MULTI_LANG === '1') headers.multi_lang_codes = multi;
  return new WebSocket(STT_URL, { headers });
}

/** One synthesis request; resolves chunks through callbacks. */
export function synthesize({ apiKey, text, lang = 'hi-IN', voice = TTS_VOICE, onStart, onChunk, onEnd, onError }) {
  const ws = new WebSocket(TTS_URL, { headers: { 'X-API-Key-ID': apiKey, 'Content-Type': 'application/json' } });
  let done = false;
  const finish = () => { if (!done) { done = true; try { ws.close(); } catch { /* closed */ } } };

  ws.on('open', () => {
    ws.send(JSON.stringify({
      text,
      voice,
      model: TTS_MODEL,
      language: lang === 'auto' ? 'auto' : lang,
      speed: 1.0,
      audio_config: {
        sample_rate: TTS_SAMPLE_RATE,
        num_channels: 1,
        sample_width: 2,
        encoding: 'linear_pcm',
        container: 'raw',
      },
    }));
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'start') onStart?.();
    else if (msg.type === 'audio') {
      const b64 = msg.data?.audio || '';
      if (b64) onChunk?.(Buffer.from(b64, 'base64'), msg.data?.chunk_index ?? 0);
      if (msg.data?.is_final) { onEnd?.(); finish(); }
    } else if (msg.type === 'complete') { onEnd?.(); finish(); }
    else if (msg.type === 'error') { onError?.(msg.message || 'tts_error'); finish(); }
  });

  ws.on('error', (e) => { onError?.(e.message); finish(); });
  ws.on('close', () => { if (!done) { done = true; onError?.('tts_closed'); } });
  return ws;
}
