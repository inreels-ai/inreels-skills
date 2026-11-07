#!/usr/bin/env node
/**
 * Step 3 — the voice track, with word timestamps.
 *
 * Two modes, chosen from the story itself:
 *
 *   narration   one voice, ONE take. A single read has continuous pacing;
 *               stitching per-shot reads leaves an audible seam at every cut.
 *   dialogue    shots carry `speaker`, characters carry `voice`. Here the seam
 *               IS the form — it is a turn — so each line is its own take, laid
 *               out on a timeline with a pause between turns.
 *
 * Either way the output is one narration.mp3 plus a word-timed span per shot,
 * so steps 4-6 never learn which mode ran.
 *
 *   node scripts/3-voice.mjs --story work/story.json --dir work --voice e5WNhrdI30aXpS2RSGm1
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnv, need } from './lib/env.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const NARRATOR = args.voice ?? 'e5WNhrdI30aXpS2RSGm1';
// The film opens on picture and sound before anyone speaks. Every timing below
// carries this offset, so the mix and the cut stay in sync with it for free.
const LEAD_IN = Number(args.leadIn ?? 0.6);
// Room between turns. A speaker change needs the beat a real exchange has; the
// same voice carrying on only needs a breath.
const GAP_TURN = Number(args.gapTurn ?? 0.45);
const GAP_SAME = Number(args.gapSame ?? 0.22);

const key = need('ELEVENLABS_API_KEY');
const mp3 = path.join(dir, 'narration.mp3');

// ── one line of speech, with its character timings folded into words ────────

function foldWords(a) {
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
  return words;
}

async function speak(text, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, speed: 0.92 },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return {
    audio: Buffer.from(data.audio_base64, 'base64'),
    words: foldWords(data.alignment ?? data.normalized_alignment),
  };
}

// The true length of a take, trailing silence included — alignment ends at the
// last syllable, and placing the next turn there would clip this one's tail.
const length = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

// ── mode ────────────────────────────────────────────────────────────────────

const dialogue = story.shots.some((s) => s.speaker);

const told = new Set();
function voiceFor(speaker) {
  const c = story.characters?.find((x) => x.name === speaker);
  if (!c) {
    // A voice with no face — a narrator, a radio, a god. Legitimate, but say so
    // out loud, because the usual cause is a name typo'd out of characters[].
    if (!told.has(speaker)) { told.add(speaker); console.log(`  note  "${speaker}" is not in characters[] — reading it in the narrator voice.`); }
    return NARRATOR;
  }
  if (!c.voice) throw new Error(`character "${speaker}" speaks but has no "voice" (an ElevenLabs voice id). Give every speaking character one before step 3.`);
  return c.voice;
}

if (!dialogue) {
  // One read, straight through.
  const script = story.shots.map((s) => s.narration.trim()).join(' ');
  const { audio, words } = await speak(script, NARRATOR);
  fs.writeFileSync(mp3, audio);
  for (const w of words) { w.start += LEAD_IN; w.end += LEAD_IN; }

  // hand each shot the span of its own sentence
  let w = 0;
  for (const shot of story.shots) {
    const n = shot.narration.trim().split(/\s+/).length;
    const span = words.slice(w, w + n);
    shot.voice = { start: span[0]?.start ?? 0, end: span[span.length - 1]?.end ?? 0, words: span };
    w += n;
  }
  story.narration = { file: mp3, seconds: words[words.length - 1].end, words: words.length, leadIn: LEAD_IN, mode: 'narration' };
} else {
  // A line per turn, placed on a timeline.
  const lineDir = path.join(dir, 'lines');
  fs.mkdirSync(lineDir, { recursive: true });

  let at = LEAD_IN;
  const placed = [];
  for (const [i, shot] of story.shots.entries()) {
    const id = voiceFor(shot.speaker);
    const file = path.join(lineDir, `${String(shot.index).padStart(2, '0')}.mp3`);
    const stamp = `${id}\n${shot.narration.trim()}`;
    const stampFile = `${file}.txt`;
    // Re-reading a line you did not change is money for nothing, and tuning one
    // line of an exchange is the normal way this step gets re-run.
    let words;
    if (fs.existsSync(file) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp) {
      words = JSON.parse(fs.readFileSync(`${file}.words.json`, 'utf8'));
    } else {
      const take = await speak(shot.narration.trim(), id);
      fs.writeFileSync(file, take.audio);
      fs.writeFileSync(stampFile, stamp);
      fs.writeFileSync(`${file}.words.json`, JSON.stringify(take.words));
      words = take.words;
    }

    const abs = words.map((w) => ({ word: w.word, start: w.start + at, end: w.end + at }));
    shot.voice = { start: abs[0]?.start ?? at, end: abs[abs.length - 1]?.end ?? at, words: abs };
    placed.push({ file, at });

    const next = story.shots[i + 1];
    at += length(file) + (next && next.speaker === shot.speaker ? GAP_SAME : GAP_TURN);
  }

  // Lay the takes down at their offsets. They never overlap, so a sum is the
  // whole mix — normalize=0 keeps amix from ducking everything by 1/N, and
  // dropout_transition=0 keeps it from swelling as each take ends.
  const filter = placed
    .map((p, i) => `[${i}:a]adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[d${i}]`)
    .concat(`${placed.map((_, i) => `[d${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:dropout_transition=0[out]`)
    .join(';');
  execFileSync('ffmpeg', [
    '-y', ...placed.flatMap((p) => ['-i', p.file]),
    '-filter_complex', filter, '-map', '[out]',
    '-ac', '2', '-ar', '44100', '-b:a', '192k', mp3,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const last = story.shots[story.shots.length - 1].voice.end;
  const count = story.shots.reduce((n, s) => n + s.voice.words.length, 0);
  story.narration = { file: mp3, seconds: last, words: count, leadIn: LEAD_IN, mode: 'dialogue' };
}

fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));

console.log(`${story.narration.mode} — ${story.narration.seconds.toFixed(1)}s, ${story.narration.words} words -> ${mp3}`);
for (const s of story.shots)
  console.log(
    `  ${String(s.index).padStart(2)}. ${s.voice.start.toFixed(1)}-${s.voice.end.toFixed(1)}s` +
    `${s.speaker ? `  ${s.speaker}:` : ' '} "${s.narration}"`
  );
