// inReels backend — one account instead of three provider keys.
//
// Everything here speaks the REST surface at /api/v1/<tool>, which is the same
// tool set the MCP server exposes, so a skill driven by an agent over MCP and a
// skill driven by these scripts hit identical code on the server.
//
//   INREELS_API_KEY=ir_live_…     from inreels.ai/dashboard/settings/api-keys
//
// Two things differ from calling Replicate or fal directly, and both are why
// this needed real code rather than a line in a table:
//
//   References are URLs, not data: URIs. A local character sheet has to be
//   uploaded first — upload_image is free and returns a URL the generators
//   accept.
//
//   Generation is a run, not a response. Every call returns a run_id
//   immediately; get_run_status with wait:true blocks up to 45s, which usually
//   finishes an image in one call and never finishes a video, so video polls
//   across several.
import fs from 'node:fs';
import { need } from './env.mjs';

const BASE = process.env.INREELS_BASE_URL || 'https://www.inreels.ai';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(tool, body) {
  const res = await fetch(`${BASE}/api/v1/${tool}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${need('INREELS_API_KEY')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`inreels ${tool} ${res.status}: ${text.slice(0, 200)}`);
  }
  // A tool can fail inside a 200 — the surface reports tool errors in the body.
  if (!res.ok || json.error) {
    throw new Error(`inreels ${tool} ${res.status}: ${json.message ?? json.error ?? text.slice(0, 200)}`);
  }
  return json;
}

export const account = () => call('get_account');

/** Local file -> an inReels URL the generators accept. Free. */
export async function uploadImage(file) {
  const { url } = await call('upload_image', {
    base64: fs.readFileSync(file).toString('base64'),
    content_type: 'image/jpeg',
  });
  if (!url) throw new Error('upload_image returned no url');
  return url;
}

/**
 * Poll a run to completion. `wait: true` holds the connection up to 45s, so an
 * image usually lands on the first call; a video takes several minutes and
 * simply needs more calls.
 */
async function finish(runId, { timeoutMs = 12 * 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const run = await call('get_run_status', { run_id: runId, wait: true });
    if (run.status === 'completed') return run;
    if (run.status === 'failed') throw new Error(`run ${runId} failed: ${run.error ?? 'no reason given'}`);
    if (Date.now() > deadline) throw new Error(`run ${runId} timed out after ${Math.round(timeoutMs / 1000)}s`);
    await sleep(3000);
  }
}

/** Same shape as nanoBanana() so step 2 does not care which backend is live. */
export async function generateImage(prompt, refUrls = [], aspect = '9:16') {
  const { run_id } = await call('generate_image', {
    prompt,
    aspect_ratio: aspect,
    output_format: 'jpg',
    ...(refUrls.length ? { ref_urls: refUrls } : {}),
  });
  const run = await finish(run_id, { timeoutMs: 5 * 60_000 });
  const url = run.url ?? run.output_url;
  if (!url) throw new Error(`image run ${run_id} completed with no url`);
  return url;
}

export async function generateVideo({ prompt, imageUrl, model, seconds, aspect = '9:16', negativePrompt }) {
  const { run_id } = await call('generate_video', {
    model,
    prompt,
    duration: seconds,
    aspect_ratio: aspect,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    generate_audio: false,
  });
  const run = await finish(run_id);
  const url = run.url ?? run.output_url;
  if (!url) throw new Error(`video run ${run_id} completed with no url`);
  return url;
}

/**
 * Speech. The run carries `words` when the model produced timings — that is
 * what step 3 needs to cut captions and effects to the syllable. If it comes
 * back without them the caller has to fall back to local whisper; this returns
 * what it got rather than pretending.
 */
// inReels voices are named slugs ("soothing-narrator"), a different namespace
// from ElevenLabs' raw ids. list_voices gives the 40 available; passing an
// ElevenLabs id here is rejected.
export const DEFAULT_VOICE = 'soothing-narrator';

export const listVoices = () => call('list_voices');

export async function generateSpeech({ text, voiceId, model }) {
  const { run_id } = await call('generate_speech', {
    text,
    voice_id: voiceId || DEFAULT_VOICE,
    ...(model ? { model } : {}),
  });
  const run = await finish(run_id, { timeoutMs: 5 * 60_000 });
  const url = run.url ?? run.output_url;
  if (!url) throw new Error(`speech run ${run_id} completed with no url`);
  return { url, words: run.words ?? null, seconds: run.duration_seconds ?? null };
}

/**
 * A sound effect or a music bed.
 *
 * `kind: 'music'` switches models: effects run 1-22s, music 10-300s and
 * instrumental by default so it sits under a voice. Out-of-range lengths are
 * rejected rather than clamped, so check the range before asking.
 */
export async function generateSound({ prompt, seconds, kind, instrumental }) {
  const { run_id } = await call('generate_sound', {
    prompt,
    ...(seconds ? { seconds } : {}),
    ...(kind ? { kind } : {}),
    ...(instrumental === false ? { instrumental: false } : {}),
  });
  const run = await finish(run_id, { timeoutMs: 5 * 60_000 });
  const url = run.url ?? run.output_url;
  if (!url) throw new Error(`sound run ${run_id} completed with no url`);
  return { url, seconds: run.duration_seconds ?? null };
}

/** What a call will cost, charging nothing. */
export const quote = (body) => call('quote', body);
