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
import * as inreels from './lib/inreels.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
fs.mkdirSync(path.join(dir, 'sfx'), { recursive: true });

// elevenlabs = your own key. inreels = the same two ElevenLabs endpoints
// behind one account, billed in credits — an effect is 1 credit, a music bed
// 1 per 15s. This is the last step that forced a second key.
const SOUND_PROVIDER = process.env.SOUND_PROVIDER || 'elevenlabs';

async function sfx(text, seconds, file) {
  if (SOUND_PROVIDER === 'inreels') {
    // The effect model stops at 22s, which is also what the bed asks for, so
    // nothing here needs the music model — ambience under a 30s film is one
    // 22s effect looped by the mixer, not a scored cue.
    const { url } = await inreels.generateSound({
      prompt: text,
      seconds: Math.min(22, Math.max(1, Math.round(seconds))),
    });
    fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    return file;
  }
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': need('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: Math.min(22, Math.max(1, seconds)) }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const total = story.narration.seconds + 1.6;

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
const lead = story.narration.leadIn ?? 0;
const inputs = ['-i', story.narration.file, '-stream_loop', '-1', '-i', bedFile];

// The voice is delayed by the lead-in and split: one copy is heard, the other
// keys a compressor on the effects bus, so effects pull back whenever a word
// lands instead of fighting it.
const leadMs = Math.round(lead * 1000);
const parts = [
  // Generated audio comes back anywhere from -20 to -55 dB, so every stem is
  // normalised to a target level first. Fixed gains cannot work across that spread.
  `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5,aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,adelay=${leadMs}|${leadMs},asplit=2[v][keyraw]`,
  // sidechaincompress ENDS when its key ends, so without this pad the whole
  // mix is cut down to the length of the voice and the film's tail goes
  // silent. Silence in the key means no ducking, which is what we want there.
  `[keyraw]apad=whole_dur=${total}[key]`,
  `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${total},loudnorm=I=-31:TP=-3,aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=0.8[b]`,
];
let n = 2;
const busLabels = ['[b]'];
for (const shot of story.shots) {
  if (!shot.sfxFile) continue;
  inputs.push('-i', shot.sfxFile);
  // an effect starts a touch BEFORE its shot's first word and fades up into it
  const at = Math.max(0, (shot.voice?.start ?? 0) - 0.25);
  const delay = Math.round(at * 1000);
  parts.push(`[${n}:a]aformat=sample_rates=44100:channel_layouts=stereo,loudnorm=I=-27:TP=-3,aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=0.45,adelay=${delay}|${delay}[s${n}]`);
  busLabels.push(`[s${n}]`);
  n++;
}
parts.push(`${busLabels.join('')}amix=inputs=${busLabels.length}:duration=longest:normalize=0[bus]`);
parts.push(`[bus][key]sidechaincompress=threshold=0.03:ratio=12:attack=15:release=320:makeup=1[ducked]`);
parts.push(`[v][ducked]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:${total}[out]`);

const mix = path.join(dir, 'mix.m4a');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
  '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', mix]);

story.mix = mix;
fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
console.log(`\nmix -> ${mix} (${total.toFixed(1)}s)`);
