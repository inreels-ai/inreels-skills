#!/usr/bin/env node
/**
 * Step 4 — animate only the shots that beg to move.
 *
 * Water, fire, weather, a creature, a gesture. Three or four moving shots in
 * eight looks BETTER than animating everything — and costs a quarter as much.
 * Everything else stays a still with a slow camera push, which reads as
 * deliberate rather than cheap.
 *
 *   node scripts/4-motion.mjs --story work/story.json --dir work --count 3
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, need } from './lib/env.mjs';
import * as inreels from './lib/inreels.mjs';
import { download, dataUri } from './lib/images.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
loadEnv(args.env);

// Two interchangeable motion backends. --provider replicate needs no file
// upload (it takes a data: URI), so it is the simpler one to start with.
const PROVIDER = process.env.MOTION_PROVIDER || 'fal';
// On the inReels path the model is named rather than hard-coded. Seedance mini
// is the cheapest that holds a stop-motion look, at 3 credits per 5s.
const INREELS_MODEL = process.env.INREELS_MOTION_MODEL || 'seedance-2.0-mini-frames';
const MODEL = 'fal-ai/kling-video/v3/standard/image-to-video';
const REPLICATE_MODEL = process.env.REPLICATE_MOTION_MODEL || 'wan-video/wan-2.5-i2v';
const USD_PER_SEC = 0.084;
// An ad carries two looks, so the instruction that holds a frame together has
// to know which one it is looking at. Telling a photoreal macro insert to keep
// its "painterly animated-film look" is how a close-up of real suds turns into
// a cartoon halfway through the clip.
const keepLook = (shot) =>
  shot.look === 'macro'
    ? 'Keep the photographic look exactly: real materials, real light, real depth of field. No stylisation, no illustration, no new objects, and any product packaging keeps its exact shape, colours and printed text.'
    : 'Keep the stop-motion plasticine look exactly: the same moulded clay surfaces, thumbprints and matte sheen. No style change, no new objects or characters, faces stay the same.';

// The default negative list bans "photorealistic" and "text", which is right
// for a story film and wrong twice over here: the macro inserts ARE meant to be
// photoreal, and the pack is meant to carry its brand name.
const negativeFor = (shot) => {
  const base = ['blur', 'distortion', 'low quality', 'deformed', 'morphing', 'extra limbs'];
  if (shot.look !== 'macro') base.push('photorealistic');
  const packShot = shot.movement === 'hero' || shot.movement === 'endcard' || shot.product === true;
  if (!packShot) base.push('text');
  else base.push('changing text', 'misspelled text', 'warping label');
  return base.join(', ');
};

const dir = args.dir ?? 'work';
const storyPath = args.story ?? path.join(dir, 'story.json');
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const count = Number(args.count ?? 3);
// Only fal needs this. Requiring it eagerly broke the other backends at
// import time for a key they never use.
const key = PROVIDER === 'fal' ? need('FAL_KEY') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(dir, 'clips'), { recursive: true });

/** fal needs a URL for the start frame; its own storage is the simplest one. */
async function uploadToFal(file) {
  const body = fs.readFileSync(file);
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ content_type: 'image/jpeg', file_name: path.basename(file) }),
  });
  if (!init.ok) throw new Error(`fal upload init ${init.status}: ${(await init.text()).slice(0, 200)}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body });
  if (!put.ok) throw new Error(`fal upload ${put.status}`);
  return file_url;
}

/** Wan 2.5 image-to-video on Replicate — same job, different door. */
async function animateReplicate(shot, seconds) {
  const headers = { Authorization: `Bearer ${need('REPLICATE_API_KEY')}`, 'content-type': 'application/json' };
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'wait=60' },
    body: JSON.stringify({
      input: {
        prompt: `${shot.motionPrompt} ${keepLook(shot)}`,
        image: dataUri(shot.image),
        negative_prompt: negativeFor(shot),
        duration: seconds,
        resolution: '720p',
        // our prompt is already exact; letting the model rewrite it drifts the style
        enable_prompt_expansion: false,
      },
    }),
  });
  let j = await res.json();
  if (!res.ok) throw new Error(`replicate ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const deadline = Date.now() + 12 * 60_000;
  while (j.status && !['succeeded', 'failed', 'canceled'].includes(j.status)) {
    if (Date.now() > deadline) throw new Error(`kling timed out on shot ${shot.index}`);
    await sleep(5000);
    j = await (await fetch(j.urls.get, { headers })).json();
  }
  if (j.status !== 'succeeded') throw new Error(`kling ${j.status}: ${j.error ?? 'no output'}`);
  return Array.isArray(j.output) ? j.output[0] : j.output;
}

async function animate(shot, seconds, startUrl) {
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: `${shot.motionPrompt} ${keepLook(shot)}`,
      start_image_url: startUrl,
      negative_prompt: negativeFor(shot),
      cfg_scale: 0.5,
      generate_audio: false,
      aspect_ratio: '9:16',
      duration: String(seconds),
    }),
  });
  if (!submit.ok) throw new Error(`kling submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  // Poll the URLs fal hands back. The queue lives under the model FAMILY
  // (fal-ai/kling-video/requests/<id>), not the full variant path, so building
  // the URL from MODEL 404s with an empty body.
  const queued = await submit.json();
  const statusUrl = queued.status_url ?? `${queued.response_url}/status`;
  const resultUrl = queued.response_url;
  const deadline = Date.now() + 12 * 60_000;
  for (;;) {
    await sleep(6000);
    const st = await (await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } })).json();
    if (st.status === 'COMPLETED') break;
    if (Date.now() > deadline) throw new Error(`kling timed out on shot ${shot.index}`);
  }
  const res = await (await fetch(resultUrl, { headers: { Authorization: `Key ${key}` } })).json();
  const url = res?.video?.url;
  if (!url) throw new Error(`kling returned no video for shot ${shot.index}`);
  return url;
}

// Two ways to choose what moves.
//
//   default  the top `count` shots by motionScore — cheap, and right for a
//            story film where most frames are a held image anyway.
//   --full   everything long enough to read as movement. Stop-motion is
//            supposed to move: a still clay frame is a photograph of a
//            puppet, not a puppet. Montage cuts are excluded regardless,
//            because nobody perceives motion in three frames.
const MIN_MOTION_SECONDS = Number(args.minSeconds ?? 0.6);
// `--full` is a bare flag, so the parser stores it as undefined. Test for the
// KEY, not the value: `args.full !== undefined` is false for a flag with no
// argument, which silently fell back to the default three shots.
const full = 'full' in args;

// Never animate the pack. Image-to-video models erode printed text across a
// clip: a hero shot that starts as "Lifts mud in one wash" ends as "Lifte nod
// lo ore wash", and that is the one frame the whole ad exists for. Broadcast
// locks off the beauty shot for exactly this reason. --motionPack overrides.
const isPack = (s) => s.movement === 'hero' || s.movement === 'endcard' || s.product === true;
const packMoves = 'motionPack' in args;

const picked = full
  ? story.shots
      .filter((s) => s.motionPrompt && (s.seconds ?? Infinity) >= MIN_MOTION_SECONDS)
      .filter((s) => packMoves || !isPack(s))
      .map((s) => s.index)
  : [...story.shots]
      .filter((s) => s.motionScore > 0)
      .sort((a, b) => b.motionScore - a.motionScore || a.index - b.index)
      .slice(0, count)
      .map((s) => s.index);

const skipped = full
  ? story.shots.filter((s) => (s.seconds ?? Infinity) >= MIN_MOTION_SECONDS && !s.motionPrompt).map((s) => s.index)
  : [];

console.log(
  full
    ? `full motion: animating ${picked.length} shots (${picked.join(', ')}) — cuts under ${MIN_MOTION_SECONDS}s stay stills`
    : `animating shots ${picked.join(', ')} — the rest stay stills with a camera move`
);
if (skipped.length) console.log(`  note  shots ${skipped.join(', ')} are long enough to move but have no motionPrompt — staying stills`);
if (full && !packMoves) {
  const held = story.shots.filter(isPack).map((s) => s.index);
  if (held.length) console.log(`  note  pack shots ${held.join(', ')} stay stills so the printed name cannot drift`);
}
console.log('');

let spent = 0;
for (const shot of story.shots) {
  if (!picked.includes(shot.index)) continue;
  const out = path.join(dir, 'clips', `${String(shot.index).padStart(2, '0')}.mp4`);
  if (fs.existsSync(out)) { shot.clip = out; continue; }

  const held = (shot.voice?.end ?? 0) - (shot.voice?.start ?? 0);
  const seconds = held > 6.5 ? 10 : 5;
  try {
    const url =
      PROVIDER === 'inreels'
        ? await inreels.generateVideo({
            model: INREELS_MODEL,
            prompt: `${shot.motionPrompt} ${keepLook(shot)}`,
            imageUrl: await inreels.uploadImage(shot.image),
            seconds,
            negativePrompt: negativeFor(shot),
          })
        : PROVIDER === 'replicate'
          ? await animateReplicate(shot, seconds)
          : await animate(shot, seconds, await uploadToFal(shot.image));
    await download(url, out);
    shot.clip = out;
    shot.clipSeconds = seconds;
    spent += seconds * USD_PER_SEC;
    console.log(`  ${shot.index}. ${seconds}s  ${shot.motionPrompt}`);
  } catch (e) {
    // a failed clip is not fatal: the shot stays a still with its camera move
    shot.motionSkipped = true;
    console.log(`  ${shot.index}. FAILED (${e.message}) — staying a still`);
  }
  fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
}

fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
console.log(`\n~$${spent.toFixed(2)} on motion`);
