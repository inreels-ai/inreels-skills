#!/usr/bin/env node
/**
 * Step 2 — character sheets, a pack shot, then every frame painted and QC'd.
 *
 * Two differences from a story film:
 *
 *   Two looks.   Each shot names `look`, and the clay characters and the
 *                photoreal macro inserts are painted from different strings.
 *                The intercut between them is the whole format.
 *   Text allowed — but only on the pack. Every other frame is still held to
 *                the no-letters rule, because invented lettering is the
 *                clearest tell there is.
 *
 *   node scripts/2-images.mjs --ad work/ad.json --dir work
 *   node scripts/2-images.mjs --only 7 --fix "the sponge is dry" --dir work
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './lib/env.mjs';
import { visionJSON } from './lib/llm.mjs';
import { paint, download, b64 } from './lib/images.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

const dir = args.dir ?? 'work';
const adPath = args.ad ?? path.join(dir, 'ad.json');
const ad = JSON.parse(fs.readFileSync(adPath, 'utf8'));
fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lookOf = (shot) => ad.looks[shot.look];
// The pack is the one place letters belong. Everywhere else they are a defect.
const packShot = (shot) => shot.movement === 'hero' || shot.movement === 'endcard' || shot.product === true;

// ── character sheets, always in the clay look ──────────────────────────────
for (const c of ad.characters ?? []) {
  const file = path.join(dir, `char-${slug(c.name)}.jpg`);
  if (fs.existsSync(file)) { c.sheet = file; continue; }
  const prompt = `Character model sheet for a stop-motion commercial: ${c.name}, ${c.role}. ${c.look} Three views of the SAME character side by side on a plain light warm-grey background: full-body front view, full-body three-quarter view, and a large head-and-shoulders close-up. Neutral standing pose, consistent proportions, identical colours and clothing in every view, even soft light, no scenery, no text, no labels, no captions. Style: ${ad.looks.clay}`;
  console.log(`sheet: ${c.name}`);
  c.sheet = await download(await paint(prompt, [], '16:9'), file);
}

// ── the pack, painted once and reused as a reference everywhere it appears ─
const packFile = path.join(dir, 'pack.jpg');
if (!fs.existsSync(packFile)) {
  const prompt = `Product packaging shot on a plain neutral light-grey background, centred, filling most of the frame, lit evenly with soft studio light: ${ad.product.pack} The brand name "${ad.brand}" is printed on the front of the pack in large clear bold letters, spelled exactly "${ad.brand}"${ad.product.claim ? `, with the smaller line "${ad.product.claim}" beneath it, spelled exactly` : ''}. Crisp commercial product photography, sharp focus, no hands, no people, no extra packs, no shelf, no background scenery.`;
  console.log('pack shot');
  await download(await paint(prompt, [], '1:1'), packFile);
}
ad.product.sheet = packFile;

// ── one prompt per shot ────────────────────────────────────────────────────
function shotPrompt(shot, fix) {
  const chars = (ad.characters ?? []).filter((c) => (shot.characters ?? []).includes(c.name) && c.sheet);
  const refs = chars.map((c, i) =>
    `Image ${i + 1} is the character reference for ${c.name}: keep ${c.name}'s face, design, clothing and colours exactly the same (${c.look}); ignore its layout, panels and background.`);
  const images = chars.map((c) => c.sheet);
  if (packShot(shot)) {
    refs.push(`Image ${images.length + 1} is the product pack: reproduce it exactly — same shape, same colours, same artwork, and the brand name spelled exactly "${ad.brand}".`);
    images.push(packFile);
  }
  const lettering = packShot(shot)
    ? `The only letters anywhere in the frame are the ones printed on the product pack itself.`
    : `Any signs, screens, labels or packaging in frame are plain and unmarked — no letters, numbers or symbols anywhere.`;
  return {
    chars, images,
    prompt: `Full-bleed vertical ${shot.type} filling the entire frame edge to edge, no border, no letterbox bars, no panels: ${shot.visual} ${refs.join(' ')}${fix ? ` IMPORTANT: ${fix}` : ''} ${lettering} Style: ${lookOf(shot)}`,
  };
}

const QC_SYSTEM = `You are the quality supervisor on a stop-motion television commercial. You get the reference images first (character sheets, and the product pack where it appears), then ONE painted frame (the LAST image) to judge. Be strict about real, visible flaws a viewer would notice; do not nitpick style.`;

const QC_ON = !!process.env.CLAUDE_API_KEY;
let qcWarned = false;

async function qc(shot, frameFile, chars) {
  if (!QC_ON) {
    if (!qcWarned) { qcWarned = true; console.log('  note  no CLAUDE_API_KEY — painting without the vision check. Look at the frames yourself.'); }
    return { pass: true, flaws: [], fix: '', focus: { x: 0.5, y: 0.45 } };
  }
  const refs = [...chars.map((c) => b64(c.sheet)), ...(packShot(shot) ? [b64(packFile)] : [])];
  const user = `${refs.length ? `The first ${refs.length} image(s) are references. ` : ''}The LAST image is the frame to judge.
Shot brief (${shot.type}, ${shot.movement}): ${shot.visual}
Characters that should appear: ${(shot.characters ?? []).join(', ') || 'none'}
Locked looks: ${(ad.characters ?? []).map((c) => `${c.name}: ${c.look}`).join(' | ') || 'none'}
Look for this shot: ${shot.look}

Fail the frame (pass=false) ONLY for any of:
1. a border, frame, letterbox bars, panels, split-screen or collage layout
2. duplicated objects or characters that should be single, extra limbs, broken anatomy
3. ${packShot(shot)
    ? `the brand name on the pack is not spelled exactly "${ad.brand}", or the pack does not match its reference, or there are letters anywhere OTHER than on the pack`
    : `any text, letters, numbers, captions, signatures or watermark (pseudo-letters on signs count)`}
4. a listed character who does not match their reference, or an unlisted named character clearly present
5. the key subject of the brief is missing or unreadable
6. the frame is in the wrong look: "${shot.look}" shots must read as ${shot.look === 'clay' ? 'moulded plasticine on a miniature set' : 'a real photograph, not animation'}
Do NOT fail for pose, expression, placement, small prop differences, or anything the brief does not ask for.

Also give "focus": where the main subject's centre sits (x, y as fractions 0-1).
JSON: { "pass": true|false, "flaws": ["…"], "fix": "one sentence for the painter (empty if pass)", "focus": { "x": 0.5, "y": 0.45 } }`;

  return visionJSON({ system: QC_SYSTEM, user, images: [...refs, b64(frameFile)] });
}

// ── paint, QC, repaint once ─────────────────────────────────────────────────
let spent = 0.039; // the pack
const only = args.only ? args.only.split(',').map(Number) : null;

for (const shot of ad.shots) {
  if (only && !only.includes(shot.index)) continue;
  const file = path.join(dir, 'shots', `${String(shot.index).padStart(2, '0')}.jpg`);
  if (!only && fs.existsSync(file) && shot.qc?.pass) continue;

  const { prompt, chars, images } = shotPrompt(shot, args.fix);
  await download(await paint(prompt, images, '9:16'), file);
  spent += 0.039;

  let verdict = await qc(shot, file, chars);
  if (!verdict.pass) {
    console.log(`  ${shot.index}: ${verdict.flaws.join('; ')} — repainting once`);
    const retry = shotPrompt(shot, verdict.fix);
    const alt = file.replace('.jpg', '-b.jpg');
    await download(await paint(retry.prompt, retry.images, '9:16'), alt);
    spent += 0.039;
    const second = await qc(shot, alt, chars);
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
  console.log(`  ${String(shot.index).padStart(2)}. [${shot.movement}/${shot.look}] ${verdict.pass ? 'ok' : 'kept with flaws: ' + verdict.flaws.join('; ')}`);
  fs.writeFileSync(adPath, JSON.stringify(ad, null, 2));
}

fs.writeFileSync(adPath, JSON.stringify(ad, null, 2));
console.log(`\n${ad.shots.length} shots painted · ~$${spent.toFixed(2)} on images`);
