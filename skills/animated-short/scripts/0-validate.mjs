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
const maxWords = Math.round(seconds * WORDS_PER_SECOND);

const problems = [];
const warn = [];

const words = story.shots.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
if (words > maxWords) problems.push(`narration is ${words} words; the cap for ${seconds}s is ${maxWords}. Cut ${words - maxWords}.`);

for (const s of story.shots) {
  const sentences = s.narration.trim().split(/[.!?]+\s+/).filter(Boolean).length;
  if (sentences > 2) problems.push(`shot ${s.index} has ${sentences} sentences; one is the rule, two if they are short.`);
  for (const name of s.characters ?? [])
    if (!story.characters.some((c) => c.name === name))
      problems.push(`shot ${s.index} names "${name}", who has no locked look in characters[].`);
  if (/\b(no|not|without|un\w+ed)\b/i.test(s.visual) && /light|lit|glow/i.test(s.visual))
    warn.push(`shot ${s.index}: the visual negates something visible — models paint what you negate. Describe what IS.`);
}

for (const c of story.characters ?? [])
  if (!c.look || c.look.length < 40)
    problems.push(`character "${c.name}" needs a fuller locked look (face, hair, clothing colours, a prop).`);

const moving = story.shots.filter((s) => s.motionScore >= 2).length;
if (moving === 0) warn.push('no shot scores 2+ on motion, so the film will be all stills. That is fine, but deliberate?');
if (moving > 5) warn.push(`${moving} shots score 2+; animating more than about 4 costs a lot and looks worse.`);

const types = new Set(story.shots.map((s) => s.type));
if (types.size < 4) warn.push(`only ${types.size} distinct shot types — vary them like a director would.`);

for (const field of ['title', 'twist', 'closingLine', 'style'])
  if (!story[field]) problems.push(`story.${field} is missing.`);

console.log(`\n${story.title ?? '(untitled)'} — ${words}/${maxWords} words, ${story.shots.length} shots, ${moving} worth animating\n`);
for (const w of warn) console.log(`  warn  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s). Fix the story before spending.\n`);
  process.exit(1);
}
console.log('\nready. Show the user the story and get a yes before step 2.\n');
