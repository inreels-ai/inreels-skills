#!/usr/bin/env node
/**
 * Step 6 — cut the ad.
 *
 * A story film cuts to the narration: a shot holds for as long as its sentence
 * takes to say. An ad does the opposite. The cut rhythm IS the format, so every
 * shot holds for the `seconds` written in the beat map and the voice has to fit
 * inside that. Measured off a real broadcast spot:
 *
 *   setup     6 cuts accelerating 1.2s → 0.3s      the problem
 *   beat      ONE hold of ~4.9s                    the character lands it
 *   montage   15 cuts, some as short as 0.07s      the transformation
 *   payoff    one hold of ~3.1s                    calm after the noise
 *   hero      the pack, alone                      what the ad is for
 *   endcard   brand + tagline
 *
 * Camera moves scale with the cut: a 0.1s frame gets none, a 4s hold gets a
 * real push. A Ken Burns move on a 3-frame cut just reads as a glitch.
 *
 *   node scripts/6-render.mjs --ad work/ad.json --dir work --out work/ad.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const dir = args.dir ?? 'work';
const adPath = args.ad ?? path.join(dir, 'ad.json');
const ad = JSON.parse(fs.readFileSync(adPath, 'utf8'));
const out = args.out ?? path.join(dir, 'ad.mp4');
const W = 1080, H = 1920, FPS = 30;
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);

fs.mkdirSync(path.join(dir, 'seg'), { recursive: true });

// ── every shot holds for exactly what the beat map says ────────────────────
let t = 0;
for (const s of ad.shots) { s.from = t; s.dur = s.seconds; t += s.seconds; }
const total = t;

for (const s of ad.shots) {
  const seg = path.join(dir, 'seg', `${String(s.index).padStart(2, '0')}.mp4`);
  const d = s.dur.toFixed(3);
  if (!args.resegment && fs.existsSync(seg)) { s.seg = seg; process.stdout.write(`  ${s.index}${s.clip ? '*' : ' '}`); continue; }

  if (s.clip && fs.existsSync(s.clip)) {
    const cs = s.clipSeconds ?? 5;
    const speed = s.dur > cs ? (s.dur / cs).toFixed(4) : null;
    const vf = [
      `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`,
      speed ? `setpts=${speed}*PTS` : null, `fps=${FPS}`,
    ].filter(Boolean).join(',');
    ff(['-i', s.clip, '-vf', vf, '-t', d, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', seg]);
  } else {
    // A still. The push is proportional to how long the shot is on screen —
    // below about 0.6s there is no room for a move, so it holds dead still.
    const fx = s.focus?.x ?? 0.5, fy = s.focus?.y ?? 0.45;
    const frames = Math.max(1, Math.round(s.dur * FPS));
    const travel = s.dur < 0.6 ? 0 : Math.min(0.16, 0.035 * s.dur);
    const vf = [
      `scale=${W * 4}:${H * 4}`,
      `zoompan=z='min(1.001+${(travel / frames).toFixed(6)}*on,${(1 + travel).toFixed(3)})':d=${frames}:x='iw*${fx.toFixed(3)}-(iw/zoom/2)':y='ih*${fy.toFixed(3)}-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    ].join(',');
    ff(['-loop', '1', '-i', s.image, '-vf', vf, '-t', d, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', seg]);
  }
  s.seg = seg;
  process.stdout.write(`  ${s.index}${s.clip ? '*' : ' '}`);
}
console.log('\n  (* = animated)');

// ── the tagline over the end card, and nothing else ────────────────────────
// An ad is watched muted, but per-shot subtitles over a 0.1s montage cut are
// strobing noise. The words that matter go where the picture stops moving.
const esc = (t) => t.replace(/\n/g, '\\N').replace(/[{}]/g, '');
const tc = (x) => {
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
const endcard = ad.shots.find((s) => s.movement === 'endcard');
const hero = ad.shots.find((s) => s.movement === 'hero');

const ass = [
  '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', '',
  '[V4+ Styles]',
  'Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
  'Style: Claim,DejaVu Sans,62,&H00FFFFFF,&H00202020,&H90000000,1,0,1,4,2,2,110,110,240,1',
  'Style: Tag,DejaVu Sans,74,&H00FFFFFF,&H00202020,&H00000000,1,0,1,4,3,5,100,100,0,1', '',
  '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
];
if (hero && ad.product?.claim)
  ass.push(`Dialogue: 0,${tc(hero.from + 0.15)},${tc(hero.from + hero.dur)},Claim,,0,0,0,,{\\fad(200,200)}${esc(ad.product.claim)}`);
if (endcard)
  ass.push(`Dialogue: 0,${tc(endcard.from + 0.2)},${tc(endcard.from + endcard.dur)},Tag,,0,0,0,,{\\fad(350,250)\\pos(${W / 2},${H * 0.62})}${esc(ad.tagline)}`);

const assFile = path.join(dir, 'captions.ass');
fs.writeFileSync(assFile, ass.join('\n'));

// ── concat, burn, mux ──────────────────────────────────────────────────────
const list = path.join(dir, 'seg', 'list.txt');
fs.writeFileSync(list, ad.shots.map((s) => `file '${path.resolve(s.seg)}'`).join('\n'));
const silent = path.join(dir, 'silent.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

ff(['-i', silent, '-i', ad.mix,
    '-vf', `subtitles=${assFile}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);

fs.writeFileSync(adPath, JSON.stringify(ad, null, 2));
const size = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`\n${ad.brand} -> ${out}  (${total.toFixed(1)}s, ${size} MB)`);
