// Image backend. Default provider is replicate/nano-banana, which keeps a
// character consistent when you hand it a reference sheet.
// Swap PROVIDER to use something else; the rest of the pipeline is unchanged.
import fs from 'node:fs';
import { need } from './env.mjs';
import * as inreels from './inreels.mjs';

// replicate = your own Replicate key. inreels = one inReels account for
// everything, billed in credits. The pipeline above this line is identical.
const PROVIDER = process.env.IMAGE_PROVIDER || 'replicate';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Raw base64 — what the vision API wants. */
export const b64 = (file) => fs.readFileSync(file).toString('base64');

/** A data: URI — what Replicate accepts as a reference image. */
export const dataUri = (file) => `data:image/jpeg;base64,${b64(file)}`;

/** google/nano-banana on Replicate. ~$0.039 an image. */
export async function nanoBanana(prompt, refs, aspect = '9:16') {
  const headers = { Authorization: `Bearer ${need('REPLICATE_API_KEY')}`, 'content-type': 'application/json' };
  const body = JSON.stringify({
    input: { prompt, output_format: 'jpg', aspect_ratio: aspect, ...(refs.length ? { image_input: refs } : {}) },
  });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.replicate.com/v1/models/google/nano-banana/predictions', {
      method: 'POST',
      headers: { ...headers, Prefer: 'wait=60' },
      body,
    });
    if (res.status === 429 && attempt < 5) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    let j = await res.json();
    const deadline = Date.now() + 4 * 60_000;
    while (j.status && !['succeeded', 'failed', 'canceled'].includes(j.status)) {
      if (Date.now() > deadline) throw new Error('nano-banana timed out');
      await sleep(2000);
      j = await (await fetch(j.urls.get, { headers })).json();
    }
    if (j.status !== 'succeeded') {
      if (attempt < 1) continue;
      throw new Error(`nano-banana ${j.status ?? res.status}: ${j.error ?? j.detail ?? 'no output'}`);
    }
    return Array.isArray(j.output) ? j.output[0] : j.output;
  }
}

// References cross the wire differently per backend: Replicate takes a data:
// URI inline, inReels takes a URL and so needs the file uploaded first. Upload
// is free but not instant, and a character sheet is referenced by every shot,
// so each file is uploaded once and remembered.
const uploaded = new Map();

/**
 * Paint one frame. Takes reference FILE PATHS, not encoded references, which is
 * what lets the two backends differ underneath without step 2 knowing.
 */
export async function paint(prompt, refFiles = [], aspect = '9:16') {
  if (PROVIDER === 'inreels') {
    const urls = [];
    for (const file of refFiles) {
      if (!uploaded.has(file)) uploaded.set(file, await inreels.uploadImage(file));
      urls.push(uploaded.get(file));
    }
    return inreels.generateImage(prompt, urls, aspect);
  }
  return nanoBanana(prompt, refFiles.map(dataUri), aspect);
}

export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
