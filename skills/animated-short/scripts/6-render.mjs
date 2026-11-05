#!/usr/bin/env node
/**
 * Step 6 — cut the film.
 *
 * Shots are cut to the narration, not to a fixed beat: each shot holds for
 * exactly as long as its own sentence takes to say. Stills get a slow push
 * toward the subject; animated shots play as filmed. ffmpeg only — no
 * Remotion, no npm install.
 *
 *   node scripts/6-render.mjs --story work/story.json --dir work --out work/film.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const out = args.out ?? path.join(dir, 'film.mp4');
const W = 1080, H = 1920, FPS = 30;
const TAIL = 1.6; // the film holds after the last word
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);

fs.mkdirSync(path.join(dir, 'seg'), { recursive: true });

// ── each shot holds for its own sentence ───────────────────────────────────
const shots = story.shots;
for (let i = 0; i < shots.length; i++) {
  const start = i === 0 ? 0 : shots[i].voice.start; // shot 1 covers the lead-in
  const end = i + 1 < shots.length ? shots[i + 1].voice.start : story.narration.seconds + TAIL;
  shots[i].from = start;
  shots[i].dur = Math.max(1.2, end - start);
}

// ── one normalised segment per shot ────────────────────────────────────────
for (const s of shots) {
  const seg = path.join(dir, 'seg', `${String(s.index).padStart(2, '0')}.mp4`);
  const d = s.dur.toFixed(3);
  if (!args.resegment && fs.existsSync(seg)) { s.seg = seg; process.stdout.write(`  ${s.index}${s.clip ? '*' : ' '}`); continue; }

  if (s.clip && fs.existsSync(s.clip)) {
    // animated: fill the frame, then fit the clip to the shot's length
    const cs = s.clipSeconds ?? 5;
    const speed = s.dur > cs ? (s.dur / cs).toFixed(4) : null; // slow it rather than freeze
    const vf = [
      `scale=${W}:${H}:force_original_aspect_ratio=increase`,
      `crop=${W}:${H}`,
      speed ? `setpts=${speed}*PTS` : null,
      `fps=${FPS}`,
    ].filter(Boolean).join(',');
    ff(['-i', s.clip, '-vf', vf, '-t', d, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', seg]);
  } else {
    // still: a slow push toward wherever the subject actually is
    const fx = s.focus?.x ?? 0.5, fy = s.focus?.y ?? 0.45;
    const frames = Math.round(s.dur * FPS);
    const zoom = `min(1.001+0.00045*on,1.14)`;
    const vf = [
      `scale=${W * 4}:${H * 4}`,
      `zoompan=z='${zoom}':d=${frames}:x='iw*${fx.toFixed(3)}-(iw/zoom/2)':y='ih*${fy.toFixed(3)}-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    ].join(',');
    ff(['-loop', '1', '-i', s.image, '-vf', vf, '-t', d, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', seg]);
  }
  s.seg = seg;
  process.stdout.write(`  ${s.index}${s.clip ? '*' : ' '}`);
}
console.log('\n  (* = animated)');

// ── captions, title and closing line, as one subtitle track ────────────────
const esc = (t) => t.replace(/\n/g, '\\N').replace(/[{}]/g, '');
const tc = (t) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
const ass = [
  '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', '',
  '[V4+ Styles]',
  'Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
  'Style: Cap,DejaVu Sans,54,&H00FFFFFF,&H00101010,&H90000000,0,0,1,3,2,2,120,120,190,1',
  'Style: Title,DejaVu Serif,104,&H00F2E4C8,&H00101010,&H00000000,1,0,1,4,3,5,80,80,0,1',
  'Style: Kicker,DejaVu Sans,40,&H00C9B48A,&H00101010,&H00000000,0,1,1,3,2,5,80,80,0,1',
  'Style: End,DejaVu Serif,60,&H00F2E4C8,&H00101010,&H00000000,0,1,1,3,2,5,120,120,0,1', '',
  '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
];

// title over the opening shot, then it clears out of the way
ass.push(`Dialogue: 0,${tc(0.25)},${tc(3.0)},Kicker,,0,0,0,,{\\fad(400,400)\\pos(${W / 2},${H * 0.4})}${esc(story.titleCard.kicker.toUpperCase())}`);
ass.push(`Dialogue: 0,${tc(0.45)},${tc(3.2)},Title,,0,0,0,,{\\fad(500,500)\\pos(${W / 2},${H * 0.48})}${esc(story.titleCard.lines.join('\\N'))}`);

// one lower third per sentence
for (const s of shots) {
  ass.push(`Dialogue: 0,${tc(s.voice.start)},${tc(s.voice.end + 0.35)},Cap,,0,0,0,,{\\fad(220,220)}${esc(s.narration)}`);
}

// the closing line sits alone over the last shot
const closeAt = story.narration.seconds + 0.35;
ass.push(`Dialogue: 0,${tc(closeAt)},${tc(closeAt + TAIL - 0.1)},End,,0,0,0,,{\\fad(450,450)\\pos(${W / 2},${H * 0.5})}${esc(story.closingLine)}`);

const assFile = path.join(dir, 'captions.ass');
fs.writeFileSync(assFile, ass.join('\n'));

// ── concat, burn, mux ──────────────────────────────────────────────────────
const list = path.join(dir, 'seg', 'list.txt');
fs.writeFileSync(list, shots.map((s) => `file '${path.resolve(s.seg)}'`).join('\n'));
const silent = path.join(dir, 'silent.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

ff(['-i', silent, '-i', story.mix,
    '-vf', `subtitles=${assFile}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);

fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
const size = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`\n${story.title} -> ${out}  (${size} MB)`);
