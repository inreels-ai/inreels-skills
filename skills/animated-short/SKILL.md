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

| Step | Default (keys) | No-key option |
|---|---|---|
| images | Replicate `google/nano-banana` | inReels MCP `generate_image` |
| motion | Replicate `wan-video/wan-2.5-i2v`, or fal Kling | inReels MCP `generate_video` |
| voice | ElevenLabs (word timestamps) | inReels MCP `generate_speech` + local whisper |
| sound | ElevenLabs sound-generation | skip, or your own files |
| render | ffmpeg, local | ffmpeg, local |

ffmpeg is required either way. The inReels route needs one account instead of
three keys, and `generate_speech` does not return word timings — step 3 falls
back to whisper locally for those.

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
  palette.
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

## Series

For episode two, keep the same `characters` block verbatim and write a new
story around it. The locked `look` strings and the same reference sheets give
you the same character in a new film.
