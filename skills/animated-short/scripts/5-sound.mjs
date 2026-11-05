#!/usr/bin/env node
/**
 * Step 5 — per-shot sound effects, then the mix.
 *
 * Audio is half the video. The mix puts narration on top, ambience under it,
 * and each shot's effect at that shot's own start time — which we know exactly,
 * because step 3 kept the word timings.
 *
 *   node scripts/5-sound.mjs --story work/story.json --dir work
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
fs.mkdirSync(path.join(dir, 'sfx'), { recursive: true });

async function sfx(text, seconds, file) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': need('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: Math.min(22, Math.max(1, seconds)) }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const total = story.narration.seconds + 1.5;

// one ambience bed under the whole film, from the story's own mood
const bedFile = path.join(dir, 'sfx', 'bed.mp3');
if (!fs.existsSync(bedFile)) {
  console.log('bed: continuous ambience');
  await sfx(`${story.score.mood}, continuous background ambience, no music, no speech`, 22, bedFile);
}

// one effect per shot that asked for one
for (const shot of story.shots) {
  if (!shot.sfx) continue;
  const file = path.join(dir, 'sfx', `${String(shot.index).padStart(2, '0')}.mp3`);
  if (!fs.existsSync(file)) {
    const len = (shot.voice?.end ?? 0) - (shot.voice?.start ?? 0) + 1;
    console.log(`  ${shot.index}. ${shot.sfx}`);
    await sfx(`${shot.sfx}. No music, no speech.`, len, file);
  }
  shot.sfxFile = file;
}

// ── mix: narration on top, bed under, effects at their own shot times ───────
const inputs = ['-i', story.narration.file, '-stream_loop', '-1', '-i', bedFile];
const parts = ['[0:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.0[v]',
               `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${total},volume=0.18[b]`];
let n = 2;
const mixLabels = ['[v]', '[b]'];
for (const shot of story.shots) {
  if (!shot.sfxFile) continue;
  inputs.push('-i', shot.sfxFile);
  const delay = Math.round((shot.voice?.start ?? 0) * 1000);
  parts.push(`[${n}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.3,adelay=${delay}|${delay}[s${n}]`);
  mixLabels.push(`[s${n}]`);
  n++;
}
parts.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:${total}[out]`);

const mix = path.join(dir, 'mix.m4a');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
  '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', mix]);

story.mix = mix;
fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
console.log(`\nmix -> ${mix} (${total.toFixed(1)}s)`);
