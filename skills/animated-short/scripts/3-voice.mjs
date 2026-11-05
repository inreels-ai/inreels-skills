#!/usr/bin/env node
/**
 * Step 3 — narration as ONE take, with word timestamps.
 *
 * One take, not one per shot: a single read has continuous pacing, stitched
 * per-shot reads have an audible seam at every cut. The word timings are what
 * later let captions, cuts and sound land on the right syllable.
 *
 *   node scripts/3-voice.mjs --story work/story.json --dir work --voice e5WNhrdI30aXpS2RSGm1
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, need } from './lib/env.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const voice = args.voice ?? 'e5WNhrdI30aXpS2RSGm1';
// The film opens on picture and sound before anyone speaks. Every timing below
// carries this offset, so the mix and the cut stay in sync with it for free.
const LEAD_IN = Number(args.leadIn ?? 0.6);

const script = story.shots.map((s) => s.narration.trim()).join(' ');

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
  method: 'POST',
  headers: { 'xi-api-key': need('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
  body: JSON.stringify({
    text: script,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, speed: 0.92 },
  }),
});
if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
const data = await res.json();

const mp3 = path.join(dir, 'narration.mp3');
fs.writeFileSync(mp3, Buffer.from(data.audio_base64, 'base64'));

// character-level timings -> word timings
const a = data.alignment ?? data.normalized_alignment;
const words = [];
let cur = null;
a.characters.forEach((ch, i) => {
  const start = a.character_start_times_seconds[i];
  const end = a.character_end_times_seconds[i];
  if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
  if (!cur) cur = { word: '', start, end };
  cur.word += ch;
  cur.end = end;
});
if (cur) words.push(cur);
for (const w of words) { w.start += LEAD_IN; w.end += LEAD_IN; }

// hand each shot the span of its own sentence
let w = 0;
for (const shot of story.shots) {
  const n = shot.narration.trim().split(/\s+/).length;
  const span = words.slice(w, w + n);
  shot.voice = { start: span[0]?.start ?? 0, end: span[span.length - 1]?.end ?? 0, words: span };
  w += n;
}
story.narration = { file: mp3, seconds: words[words.length - 1].end, words: words.length, leadIn: LEAD_IN };
fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));

console.log(`narration ${story.narration.seconds.toFixed(1)}s, ${words.length} words -> ${mp3}`);
for (const s of story.shots) console.log(`  ${String(s.index).padStart(2)}. ${s.voice.start.toFixed(1)}-${s.voice.end.toFixed(1)}s  "${s.narration}"`);
