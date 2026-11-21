#!/usr/bin/env node
/**
 * Step 0 — check the beat map before anyone spends money on it.
 *
 * In a story film the narration decides how long a shot holds. In an ad it is
 * the other way round: the cut rhythm is the format, and the voice has to fit
 * inside it. So the thing to validate here is the TIMING, not the prose.
 *
 *   node scripts/0-validate.mjs --ad work/ad.json
 */
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const ad = JSON.parse(fs.readFileSync(args.ad ?? 'work/ad.json', 'utf8'));

const MOVEMENTS = ['setup', 'beat', 'montage', 'payoff', 'hero', 'endcard'];
const WORDS_PER_SECOND = 2.6; // ad reads are faster than story narration

const problems = [];
const warn = [];
const at = (m) => ad.shots.filter((s) => s.movement === m);
const total = ad.shots.reduce((t, s) => t + (s.seconds ?? 0), 0);

// ── the movements, in order ────────────────────────────────────────────────
const order = ad.shots.map((s) => s.movement);
for (const m of MOVEMENTS) if (!order.includes(m)) problems.push(`no "${m}" shot — the six movements are ${MOVEMENTS.join(' → ')}.`);
let seen = -1;
for (const [i, m] of order.entries()) {
  const rank = MOVEMENTS.indexOf(m);
  if (rank === -1) { problems.push(`shot ${i + 1} has movement "${m}", which is not one of ${MOVEMENTS.join(', ')}.`); continue; }
  if (rank < seen) problems.push(`shot ${i + 1} is "${m}" after a later movement — the six run in order and never interleave.`);
  seen = Math.max(seen, rank);
}

// ── the rhythm, which IS the format ────────────────────────────────────────
const setup = at('setup');
if (setup.length < 4) warn.push(`${setup.length} setup shots; the reference ad used 6, accelerating 1.2s → 0.3s.`);
const accelerating = setup.every((s, i) => i === 0 || s.seconds <= setup[i - 1].seconds + 0.01);
if (setup.length > 2 && !accelerating) warn.push('the setup does not accelerate — each cut should be the same length or shorter than the last.');

const beat = at('beat');
if (beat.length > 1) problems.push(`${beat.length} "beat" shots; there is exactly one — the single long hold the whole ad pivots on.`);
if (beat[0] && beat[0].seconds < 2.5) problems.push(`the beat holds ${beat[0].seconds}s; it needs 2.5s or more or it is just another cut.`);

const montage = at('montage');
if (montage.length < 6) problems.push(`${montage.length} montage shots; the burst needs 6 or more to read as a burst.`);
for (const s of montage) if (s.seconds > 0.6) problems.push(`montage shot ${s.index} holds ${s.seconds}s — montage cuts are 0.07s to 0.5s.`);
if (montage.length && montage.every((s) => s.seconds === montage[0].seconds))
  warn.push('every montage cut is the same length; vary them or it reads mechanical.');

const hero = at('hero');
if (hero.some((s) => s.seconds < 1.2)) warn.push('the product hero is under 1.2s — this is the shot the whole ad is for.');

// ── two looks, used on purpose ─────────────────────────────────────────────
for (const s of ad.shots) {
  if (!ad.looks?.[s.look]) problems.push(`shot ${s.index} asks for look "${s.look}", which is not in looks{}.`);
  if (!s.seconds) problems.push(`shot ${s.index} has no "seconds" — in an ad every shot is timed by hand.`);
  for (const name of s.characters ?? [])
    if (!ad.characters.some((c) => c.name === name))
      problems.push(`shot ${s.index} names "${name}", who has no locked look in characters[].`);
}
const looksUsed = new Set(ad.shots.map((s) => s.look));
if (looksUsed.size < 2) warn.push('only one look is used — the intercut between clay and photoreal macro is the whole trick.');

// ── the voice has to fit inside the cut, not the other way round ───────────
const words = (ad.vo ?? '').trim().split(/\s+/).filter(Boolean).length;
const room = total - (at('endcard')[0]?.seconds ?? 0);
const maxWords = Math.round(room * WORDS_PER_SECOND);
if (words > maxWords) problems.push(`the voiceover is ${words} words; ${room.toFixed(1)}s of picture holds ${maxWords}. Cut ${words - maxWords}.`);

// ── the product ────────────────────────────────────────────────────────────
for (const field of ['brand', 'tagline'])
  if (!ad[field]) problems.push(`ad.${field} is missing.`);
if (!ad.product?.pack || ad.product.pack.length < 30)
  problems.push('product.pack needs a real description of the packaging — colours, shape, what is printed on it.');
if (!hero.length) problems.push('no hero shot, so the pack is never seen on its own.');

const moving = ad.shots.filter((s) => s.motionScore >= 2).length;
if (moving > 5) warn.push(`${moving} shots score 2+ on motion; animating more than about 4 costs a lot and montage cuts are too short to show it.`);
for (const s of montage) if (s.motionScore >= 2)
  warn.push(`montage shot ${s.index} is marked for motion but holds ${s.seconds}s — nobody will see it. Spend the clip on the beat or the payoff.`);

console.log(`\n${ad.brand ?? '(no brand)'} — ${total.toFixed(1)}s, ${ad.shots.length} shots, ${words}/${maxWords} words of voice\n`);
for (const m of MOVEMENTS) {
  const g = at(m);
  if (!g.length) continue;
  console.log(`  ${m.padEnd(8)} ${String(g.length).padStart(2)} shots  ${g.reduce((t, s) => t + s.seconds, 0).toFixed(1).padStart(5)}s   ${g.map((s) => s.seconds).join(' ')}`);
}
console.log('');
for (const w of warn) console.log(`  warn  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s). Fix the beat map before spending.\n`);
  process.exit(1);
}
console.log('\nready. Show the user the beat map and get a yes before step 2.\n');
