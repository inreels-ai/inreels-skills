#!/usr/bin/env node
/**
 * Step 2 — character sheets, then every shot painted with those sheets as
 * references, each frame vision-QC'd and repainted once if it is flawed.
 *
 * The character sheet is the whole trick: without it the hero changes face
 * between shots, which is the single most recognisable AI-video failure.
 *
 *   node scripts/2-images.mjs --story work/story.json --dir work
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './lib/env.mjs';
import { visionJSON } from './lib/llm.mjs';
import { nanoBanana, download, dataUri, b64 } from './lib/images.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── character sheets ────────────────────────────────────────────────────────
for (const c of story.characters) {
  const file = path.join(dir, `char-${slug(c.name)}.jpg`);
  if (fs.existsSync(file)) { c.sheet = file; continue; }
  const prompt = `Character model sheet for an animated film: ${c.name}, ${c.role}. ${c.look}. Three views of the SAME character side by side on a plain light warm-grey background: full-body front view, full-body three-quarter view, and a large head-and-shoulders close-up. Neutral standing pose, consistent proportions, identical colours and clothing in every view, even soft light, no scenery, no text, no labels, no captions. Style: ${story.style}.`;
  console.log(`sheet: ${c.name}`);
  c.sheet = await download(await nanoBanana(prompt, [], '16:9'), file);
}

// ── one prompt per shot, characters bound to their sheets by position ───────
function shotPrompt(shot, fix) {
  const chars = story.characters.filter((c) => shot.characters.includes(c.name) && c.sheet);
  const refs = chars
    .map((c, i) => `Image ${i + 1} is the character reference for ${c.name}: keep ${c.name}'s face, design, clothing and colours exactly the same (${c.look}); ignore its layout, panels and background.`)
    .join(' ');
  return {
    chars,
    prompt: `Full-bleed vertical cinematic ${shot.type} shot filling the entire frame edge to edge, no border, no letterbox bars, no panels: ${shot.visual} ${refs}${fix ? ` IMPORTANT: ${fix}` : ''} Any signs, screens, posters or neon are abstract glowing shapes with no letters or symbols. Style: ${story.style}.`,
  };
}

const QC_SYSTEM = `You are the continuity and quality supervisor on an animated short. You get the character reference sheets first (if any), then ONE painted frame (the LAST image) to judge. Be strict about real, visible flaws a viewer would notice; do not nitpick style.`;

async function qc(shot, frameFile, chars) {
  const user = `${chars.length ? `The first ${chars.length} image(s) are the reference sheets for: ${chars.map((c) => c.name).join(', ')}. ` : ''}The LAST image is the frame to judge.
Shot brief (${shot.type}): ${shot.visual}
Characters that should appear: ${shot.characters.join(', ') || 'none'}
Locked looks: ${story.characters.map((c) => `${c.name}: ${c.look}`).join(' | ')}

Fail the frame (pass=false) ONLY for any of:
1. a border, frame, letterbox bars, panels, split-screen or collage layout
2. duplicated objects or characters that should be single, extra limbs, broken anatomy
3. any text, letters, numbers, captions, signatures or watermark (pseudo-letters on signs count)
4. a listed character who does not match their reference, or an unlisted named character clearly present
5. the key subject of the brief is missing or unreadable
Do NOT fail for pose, expression, placement, small prop differences, or anything the brief does not ask for.

Also give "focus": where the main subject's centre sits (x, y as fractions 0-1) — the camera pushes toward it.
JSON: { "pass": true|false, "flaws": ["…"], "fix": "one sentence for the painter (empty if pass)", "focus": { "x": 0.5, "y": 0.45 } }`;

  return visionJSON({
    system: QC_SYSTEM,
    user,
    images: [...chars.map((c) => b64(c.sheet)), b64(frameFile)],
  });
}

// ── paint, QC, repaint once ─────────────────────────────────────────────────
let spent = 0;
// --only 7 repaints one shot; --fix "..." adds a note the painter must obey.
const only = args.only ? args.only.split(',').map(Number) : null;

for (const shot of story.shots) {
  if (only && !only.includes(shot.index)) continue;
  const file = path.join(dir, 'shots', `${String(shot.index).padStart(2, '0')}.jpg`);
  if (!only && fs.existsSync(file) && shot.qc?.pass) continue;

  const { prompt, chars } = shotPrompt(shot, args.fix);
  await download(await nanoBanana(prompt, chars.map((c) => dataUri(c.sheet)), '9:16'), file);
  spent += 0.039;

  let verdict = await qc(shot, file, chars);
  if (!verdict.pass) {
    console.log(`  ${shot.index}: ${verdict.flaws.join('; ')} — repainting once`);
    const retry = shotPrompt(shot, verdict.fix);
    const alt = file.replace('.jpg', '-b.jpg');
    await download(await nanoBanana(retry.prompt, chars.map((c) => dataUri(c.sheet)), '9:16'), alt);
    spent += 0.039;
    const second = await qc(shot, alt, chars);
    // keep the better of the two
    if (second.pass || second.flaws.length < verdict.flaws.length) {
      fs.renameSync(alt, file);
      verdict = second;
    } else {
      fs.unlinkSync(alt);
    }
  }
  shot.qc = { pass: verdict.pass, flaws: verdict.flaws, attempts: verdict.pass ? 1 : 2 };
  shot.focus = verdict.focus;
  shot.image = file;
  console.log(`  ${shot.index}. [${shot.type}] ${verdict.pass ? 'ok' : 'kept with flaws: ' + verdict.flaws.join('; ')}`);
  fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
}

fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
console.log(`\n${story.shots.length} shots painted · ~$${spent.toFixed(2)} on images`);
