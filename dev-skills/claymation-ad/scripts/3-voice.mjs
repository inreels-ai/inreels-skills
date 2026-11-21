#!/usr/bin/env node
/**
 * Step 3 — the voiceover, and the timeline every later step reads.
 *
 * The voice does NOT decide the cut here; the beat map does. So this step has
 * two jobs:
 *
 *   1. record `vo` as one take and place it on the timeline
 *   2. stamp each shot with the span it occupies, worked out from `seconds`
 *
 * Step 4 and step 5 then read those spans exactly as they would in a story
 * film, which is why they need no ad-specific version.
 *
 *   node scripts/3-voice.mjs --ad work/ad.json --dir work --voice CwhRBWXzGAHq8TQ4Fs17
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, need } from './lib/env.mjs';
import * as inreels from './lib/inreels.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const adPath = args.ad ?? path.join(dir, 'ad.json');
const ad = JSON.parse(fs.readFileSync(adPath, 'utf8'));
const VOICE_PROVIDER = process.env.VOICE_PROVIDER || 'elevenlabs';
// inReels voices are named slugs; ElevenLabs ids are rejected there and the
// reverse, so the default has to follow the backend.
const voice = args.voice ?? ad.voiceId ?? (VOICE_PROVIDER === 'inreels' ? 'allison-millennial' : 'CwhRBWXzGAHq8TQ4Fs17');
// Ads open on picture and sound. The voice comes in a beat later, once the
// viewer has seen the problem.
const VO_AT = Number(args.voAt ?? ad.voStartsAt ?? 0.5);

// ── the timeline, straight off the beat map ────────────────────────────────
let t = 0;
for (const s of ad.shots) {
  s.voice = { start: t, end: t + s.seconds };
  t += s.seconds;
}
const total = t;

// ── one take ───────────────────────────────────────────────────────────────
const mp3 = path.join(dir, 'vo.mp3');
let words = 0;
if ((ad.vo ?? '').trim()) {
  if (VOICE_PROVIDER === 'inreels') {
    const { url, seconds } = await inreels.generateSpeech({ text: ad.vo.trim(), voiceId: voice });
    fs.writeFileSync(mp3, Buffer.from(await (await fetch(url)).arrayBuffer()));
    words = ad.vo.trim().split(/\s+/).length;
    if (seconds && VO_AT + seconds > total)
      console.log(`  warn  the read runs ${(VO_AT + seconds).toFixed(1)}s but the ad is ${total.toFixed(1)}s — it will be cut off.`);
  } else {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
    method: 'POST',
    headers: { 'xi-api-key': need('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({
      text: ad.vo.trim(),
      model_id: 'eleven_multilingual_v2',
      // An ad read is brighter and faster than a story narration.
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45, speed: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  fs.writeFileSync(mp3, Buffer.from(data.audio_base64, 'base64'));
  const a = data.alignment ?? data.normalized_alignment;
  const spoken = a.character_end_times_seconds[a.character_end_times_seconds.length - 1];
  words = ad.vo.trim().split(/\s+/).length;
  if (VO_AT + spoken > total)
    console.log(`  warn  the read runs ${(VO_AT + spoken).toFixed(1)}s but the ad is ${total.toFixed(1)}s — it will be cut off.`);
  }
} else {
  // A music-only ad is a real choice; give the mixer silence to sit under.
  fs.writeFileSync(mp3, Buffer.alloc(0));
}

// 5-sound reads these two, and does not care that this is an ad.
ad.narration = { file: mp3, seconds: total, leadIn: VO_AT, words };
fs.writeFileSync(adPath, JSON.stringify(ad, null, 2));

console.log(`voice at ${VO_AT}s, ${words} words · ad is ${total.toFixed(1)}s`);
for (const s of ad.shots)
  console.log(`  ${String(s.index).padStart(2)}. ${s.voice.start.toFixed(2).padStart(5)}-${s.voice.end.toFixed(2).padStart(5)}s  ${s.movement.padEnd(8)} ${s.look.padEnd(5)} ${s.type}`);
