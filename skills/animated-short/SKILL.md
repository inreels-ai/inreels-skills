---
name: animated-short
description: Make a finished animated short film from one line — story, consistent characters, shot plan, narration, sound and a rendered vertical MP4. Use when asked for an animated reel, a short film, a narrated story video, a cinematic short for TikTok/Reels/Shorts, or a series of episodes with a recurring character.
---

# Animated short

One line in, a finished vertical film out: a story with a twist, a character
who looks the same in every shot, narration, sound, captions and an MP4.

You write the story yourself, in conversation, and show it to the user before
anything is spent. The scripts do the mechanical half — image calls, motion,
voice, mixing, rendering.

## Before you start

```bash
cd skills/animated-short
cp .env.example .env     # then fill in the keys for the backend you chose
```

Backends — pick one, or mix them:

| Step | Your own keys | One inReels account |
|---|---|---|
| images | Replicate `google/nano-banana` | `IMAGE_PROVIDER=inreels` |
| motion | fal Kling, or Replicate `wan-2.5-i2v` | `MOTION_PROVIDER=inreels` |
| voice | ElevenLabs | `VOICE_PROVIDER=inreels` |
| vision QC | Anthropic `CLAUDE_API_KEY` | Anthropic `CLAUDE_API_KEY` |
| sound effects | ElevenLabs | `SOUND_PROVIDER=inreels` |
| render | ffmpeg, local | ffmpeg, local |

The inReels column replaces the three provider accounts with one, billed in
credits. Images, voice and motion have been run end to end on it — a whole
film was built that way. `SOUND_PROVIDER=inreels` is newer and has not had a
film through it yet; if it gives you trouble, drop that one line and keep an
ElevenLabs key for step 5.

One key stays separate either way: the vision check needs an Anthropic key
whichever backend paints the frames. Without `CLAUDE_API_KEY` step 2 paints
without checking its own work and says so, rather than failing after you have
paid for the frame.

```bash
INREELS_API_KEY=ir_live_…      # inreels.ai/dashboard/settings/api-keys
IMAGE_PROVIDER=inreels
MOTION_PROVIDER=inreels
VOICE_PROVIDER=inreels
SOUND_PROVIDER=inreels
INREELS_MOTION_MODEL=seedance-2.0-mini-frames   # 3 credits per 5s; list_models for the rest
```

Two things differ on that path. Voices are named slugs — `soothing-narrator`,
not an ElevenLabs id — so `--voice` takes a different kind of value; `list_voices`
gives the forty. And references are uploaded rather than inlined, which the
code handles, but it means the first shot using a character sheet is slower
than the rest.

ffmpeg is required either way.

## Method

### 1. Write the story — you, not a script

The user gives you one line. Write `work/story.json` yourself. This is the part
you are good at and it is also the part the user wants to argue with, so do it
in the conversation where they can.

Rules that decide whether the film works:

- **Narration is capped at ~2.1 words per second.** A 33s film is 69 words,
  and that is a hard ceiling — a long script makes a long, loose video. Count.
- **One sentence per shot.** Eight shots is a good default.
- **Shot 1 is a hook.** Begin inside the moment. No scene-setting preamble.
- **The twist must be showable.** Not an idea — a thing the camera can see.
  Write it literally into that shot's `visual`, because models default to
  vague and metaphorical.
- **One style string**, used verbatim in every image prompt. Medium, light,
  palette. Twelve tested ones are in [`styles/`](styles/) — copy one rather
  than inventing a string, and probe any new style with a single image before
  committing a film to it.
- **Every character gets a locked `look`** — face, hair, clothing colours,
  signature prop. This is what stops the hero changing face between shots.
- **Describe what IS, never what is not.** "Its lens is black and empty" works;
  "its green light is out" paints a green light. Negations summon the thing
  they negate. This cost us two repaints to learn.
- **Vary the shot types** like a director: establishing wide, medium, close-up,
  over-the-shoulder, low angle, reveal, epilogue.
- **`motionScore` 0–3, honestly.** Water, fire, weather, a creature, a gesture
  score 3. A still object scores 0. Only the top few get animated.

The JSON shape is in `examples/the-last-watch.story.json`. Copy it.

Then validate the cap in code, because your own word count will drift:

```bash
node scripts/0-validate.mjs --story work/story.json --seconds 33
```

### 2. Show the user, and wait

Print the title, the eight lines, the twist and the closing line. Ask for a
yes. Nothing has been spent at this point and everything downstream inherits
this script, so a rewrite here is free and a rewrite later is not.

Never skip this.

### 3. Run the pipeline

```bash
node scripts/2-images.mjs  --story work/story.json --dir work   # sheets, shots, QC
node scripts/3-voice.mjs   --story work/story.json --dir work   # narration + word timings
node scripts/4-motion.mjs  --story work/story.json --dir work --count 3
node scripts/5-sound.mjs   --story work/story.json --dir work   # effects + mix
node scripts/6-render.mjs  --story work/story.json --dir work --out work/film.mp4
```

Each step writes back into `story.json` and skips work already done, so a
failed run resumes instead of repeating. Roughly 10 minutes end to end.

**Step 2** paints a character reference sheet first, then every shot with that
sheet attached as a reference, then vision-QCs each frame against its own brief
and repaints once if it finds a border, text, a duplicate or the wrong
character. To redo one shot by hand:

```bash
node scripts/2-images.mjs --only 7 --fix "the lamp is completely dark" --dir work
```

**Step 4** animates only the highest-`motionScore` shots. Three moving shots in
eight looks better than animating everything, and costs a quarter as much. A
clip that fails is not fatal — that shot stays a still with a camera move.

**Step 6** cuts each shot to the length of its own sentence, pushes slowly into
stills toward wherever the subject actually is, and burns the title card,
lower-third captions and closing line. ffmpeg only.

### 4. Hand it over

Give them `work/film.mp4`. Never auto-post it anywhere.

## What it costs

A 33s film with 3 animated shots, at the default backends:

```
character sheet + 8 shots + repaints   ~$0.60
narration                              ~$0.02
3 motion clips (5s each)               ~$1.26
ambience + 8 effects                   ~$0.10
                                       ───────
                                        ~$2.00
```

All stills, no motion, is about **$0.70** and still looks good. Say the number
before you spend it.

## What fails

- **A script over the word cap.** The single most common failure. The film runs
  long and every shot drags.
- **No character sheet.** The hero's face changes between shots. This is the
  most recognisable AI-video tell there is.
- **A twist stated instead of shown.** If the payoff is "the lamp died", the
  frame must show a dead lamp.
- **Negations in image prompts.** See above — they paint the thing.
- **Animating everything.** Costs four times as much and looks worse, because
  shots with nothing to move wobble instead.
- **Narration that reads the picture aloud.** Say what the image cannot.
- **Skipping the user's yes.** They will want a different ending, and they will
  want it before you have paid for eight images.

## Styles

[`styles/`](styles/) holds a pack per visual style — noir painterly, ink wash,
watercolour, cartoon explainer, paper collage, papercraft, low poly, claymation,
crochet and yarn, felt diorama, feature 3D and ultra-realistic. Each is a proven
string, a rendered proof image, what it suits and where it breaks.

The pipeline is style-agnostic — the string is the only thing that changes — so
adding a style is a file, not code.

One rule worth knowing before you write your own: styles that are **painting
techniques** land from a plain description, while styles that are a **physical
medium or a render engine** need the texture named, a counted palette, and an
explicit statement of what the medium is not. `styles/README.md` explains why,
and why that does not contradict the no-negations rule above.

## Two voices

A film can be an exchange instead of a narration. Give every shot a `speaker`
and every speaking character a `voice`:

```json
"characters": [
  { "name": "Nell Harrow", "look": "...", "voice": "cgSgspJ2msm6clMCkdW9" },
  { "name": "Orrin Vance", "look": "...", "voice": "pqHfZKP75CvOlQylNhV4" }
],
"shots": [
  { "index": 1, "speaker": "Nell Harrow", "narration": "Gate's down. It's three in the morning.", ... },
  { "index": 2, "speaker": "Orrin Vance", "narration": "Gate's always down at three.", ... }
]
```

That is the whole switch. Step 3 sees `speaker`, reads each line as its own
take in that character's voice, and lays the takes on a timeline with a pause
between turns — 0.45s when the speaker changes, 0.22s when one carries on.
Steps 2, 4, 5 and 6 never learn which mode ran; they still read one
`narration.mp3` and one word-timed span per shot. Captions pick up the
speaker's first name automatically, which is what makes a two-hander readable
on a muted phone.

A speaker who is not in `characters[]` reads in the narrator voice, and the
script says so — that is how you write an unseen voice, and also how a typo
announces itself.

What changes in the writing:

- **The cap tightens.** Silence between turns is running time, so a 30s
  dialogue is about 55 words, not 63. `0-validate.mjs` works this out from
  your own turn pattern.
- **Trade often.** Three shots in a row from one mouth is a monologue cut into
  pieces; the validator warns at three.
- **Give them different voices, audibly.** Two middle-aged American men are
  one voice to a viewer scrolling past. Contrast age, accent or pitch.
- **Keep the twist in the picture**, not in a line. The reveal in
  `examples/the-night-gate.story.json` is the road ending in fog — the line
  over it is three words long.
- **Lines, not sentences.** "Not at this hour you don't" is a line. "Orrin
  explained that the hour was the problem" is narration wearing a name tag.

Cost is the same as narration: one TTS call per line instead of one per film,
and ElevenLabs bills by the character either way. Re-running step 3 only
re-reads the lines whose text or voice actually changed.

## Series

For episode two, keep the same `characters` block verbatim and write a new
story around it. The locked `look` strings and the same reference sheets give
you the same character in a new film.
