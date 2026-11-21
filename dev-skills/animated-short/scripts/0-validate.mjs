#!/usr/bin/env node
/**
 * Step 0 — check the story you just wrote before anyone spends money on it.
 *
 * The word cap is the one rule that cannot be left to judgement: every writer,
 * human or model, drifts long, and a long script makes a long, loose film.
 *
 *   node scripts/0-validate.mjs --story work/story.json --seconds 33
 */
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const WORDS_PER_SECOND = 2.1;
const story = JSON.parse(fs.readFileSync(args.story ?? 'work/story.json', 'utf8'));
const seconds = Number(args.seconds ?? story.meta?.seconds ?? 33);

const problems = [];
const warn = [];

// A dialogue spends part of its running time on the silence between turns, and
// that silence is not optional — an exchange with no beat between lines reads
// as one person talking to themselves. So the words have less room than a
// narration of the same length.
const dialogue = story.shots.some((s) => s.speaker);
const LEAD_IN = 0.6;
const pauses = dialogue
  ? LEAD_IN + story.shots.slice(0, -1).reduce((t, s, i) => t + (story.shots[i + 1].speaker === s.speaker ? 0.22 : 0.45), 0)
  : LEAD_IN;
const maxWords = Math.round((seconds - pauses) * WORDS_PER_SECOND);

const words = story.shots.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
if (words > maxWords)
  problems.push(
    `script is ${words} words; the cap for ${seconds}s is ${maxWords}` +
    `${dialogue ? ` (${pauses.toFixed(1)}s of it is the pauses between turns)` : ''}. Cut ${words - maxWords}.`
  );

for (const s of story.shots) {
  const sentences = s.narration.trim().split(/[.!?]+\s+/).filter(Boolean).length;
  if (sentences > 2) problems.push(`shot ${s.index} has ${sentences} sentences; one is the rule, two if they are short.`);
  for (const name of s.characters ?? [])
    if (!story.characters.some((c) => c.name === name))
      problems.push(`shot ${s.index} names "${name}", who has no locked look in characters[].`);
  if (/\b(squeak|squeal|scrape|scratch|hiss|static|screech|grind|feedback)\b/i.test(s.sfx ?? ''))
    warn.push(`shot ${s.index}: "${s.sfx}" is an abrasive effect and sits in the same band as speech — it reads as noise under narration. Pick a rounder sound.`);
  // Only when the negation is actually attached to the visible thing. Scanning
  // the whole sentence flagged "entirely unbothered" in a lit booth, which is
  // a mood, not a negated object, and a warning nobody trusts gets ignored.
  const negated = s.visual.match(/\b(no|not|without|un\w+ed)\b(?:\s+\w+){0,3}\s+\w*(light|lit|lamp|glow|flame|beam|screen)\w*\b/i);
  if (negated)
    warn.push(`shot ${s.index}: "${negated[0]}" negates something visible — models paint what you negate. Describe what IS.`);
}

for (const c of story.characters ?? [])
  if (!c.look || c.look.length < 40)
    problems.push(`character "${c.name}" needs a fuller locked look (face, hair, clothing colours, a prop).`);

if (dialogue) {
  const speakers = [...new Set(story.shots.map((s) => s.speaker).filter(Boolean))];
  for (const s of story.shots)
    if (!s.speaker) problems.push(`shot ${s.index} has no "speaker", but this is a dialogue — every line needs one.`);
  for (const name of speakers) {
    const c = story.characters?.find((x) => x.name === name);
    if (!c) warn.push(`"${name}" speaks but is not in characters[] — it will read in the narrator voice. Typo?`);
    else if (!c.voice) problems.push(`character "${name}" speaks but has no "voice" (an ElevenLabs voice id).`);
  }
  if (speakers.length < 2) warn.push(`only "${speakers[0]}" speaks — that is a narration with extra steps, not a dialogue.`);
  const voices = story.characters?.filter((c) => c.voice).map((c) => c.voice) ?? [];
  if (new Set(voices).size < voices.length) problems.push('two characters share a voice id — the audience cannot tell them apart.');
  let run = 1;
  for (let i = 1; i < story.shots.length; i++) {
    run = story.shots[i].speaker === story.shots[i - 1].speaker ? run + 1 : 1;
    if (run === 3) warn.push(`${story.shots[i].speaker} holds the floor for 3 shots straight — an exchange should trade more often.`);
  }
}

const moving = story.shots.filter((s) => s.motionScore >= 2).length;
if (moving === 0) warn.push('no shot scores 2+ on motion, so the film will be all stills. That is fine, but deliberate?');
if (moving > 5) warn.push(`${moving} shots score 2+; animating more than about 4 costs a lot and looks worse.`);

const types = new Set(story.shots.map((s) => s.type));
if (types.size < 4) warn.push(`only ${types.size} distinct shot types — vary them like a director would.`);

for (const field of ['title', 'twist', 'closingLine', 'style'])
  if (!story[field]) problems.push(`story.${field} is missing.`);

console.log(`\n${story.title ?? '(untitled)'} — ${dialogue ? 'dialogue' : 'narration'}, ${words}/${maxWords} words, ${story.shots.length} shots, ${moving} worth animating\n`);
for (const w of warn) console.log(`  warn  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s). Fix the story before spending.\n`);
  process.exit(1);
}
console.log('\nready. Show the user the story and get a yes before step 2.\n');
