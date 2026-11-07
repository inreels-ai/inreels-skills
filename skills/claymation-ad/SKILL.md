---
name: claymation-ad
description: Make a stop-motion claymation television commercial — Aardman-style clay characters intercut with photoreal macro inserts, a product hero and a brand end card, cut to a real broadcast beat map. Use when asked for a claymation ad, a stop-motion commercial, a funny character-led product ad, a TV-style spot for TikTok/Reels/Shorts, or an Aardman/Wallace-and-Gromit style advert.
---

# Claymation ad

A clay character has a problem. The product fixes it. Twenty-six seconds,
vertical, cut like a real broadcast spot.

You write the beat map yourself, in conversation, and show it to the user
before anything is spent. The scripts do the mechanical half.

## What makes this format, and not just "an animated video"

Two things, and if you drop either one it stops reading as a commercial.

**1. The cut rhythm.** A story film cuts to the narration — each shot holds as
long as its sentence takes to say. An ad is the opposite: the rhythm is fixed
first and the voice has to fit inside it. Six movements, measured off a real
broadcast spot:

```
 movement   shots   length                      what it does
 ────────────────────────────────────────────────────────────────────
 setup        6     1.2s → 0.3s, accelerating   the problem piles up
 beat         1     4.9s, one long hold         the character lands it
 montage     15     0.07s – 0.5s                the transformation
 payoff       1     3.1s                        calm after the noise
 hero         1     1.5s+                       the pack, alone
 endcard      1     2.5s                        brand + tagline
```

The acceleration into the montage and the sudden stillness after it are the
whole feel. Even cuts throughout read as a slideshow.

**2. Two looks, intercut.** Clay characters, then a photoreal macro insert of
the real material — suds on a plate, fibres in a cloth, the sponge going in.
Clay alone looks like a cartoon; macro alone looks like stock footage. Cutting
between them is what makes a clay world feel like it has real dirt in it.

```json
"looks": {
  "clay":  "Stop-motion claymation shot on a real miniature set: …",
  "macro": "Macro product photography, real materials, shallow depth of field, …"
}
```

Each shot names one. The setup and montage lean macro; the beat and payoff are
clay; the hero is the pack itself.

## Before you start

```bash
cd skills/claymation-ad
cp .env.example .env     # then fill in the keys for the backend you chose
```

| Step | Your own keys | One inReels account |
|---|---|---|
| images | Replicate `google/nano-banana` | `IMAGE_PROVIDER=inreels` |
| motion | fal Kling, or Replicate `wan-2.5-i2v` | `MOTION_PROVIDER=inreels` |
| voice | ElevenLabs | `VOICE_PROVIDER=inreels` |
| vision QC | Anthropic `CLAUDE_API_KEY` | Anthropic `CLAUDE_API_KEY` |
| sound effects | ElevenLabs | `SOUND_PROVIDER=inreels` |
| render | ffmpeg, local | ffmpeg, local |

The inReels column is tested, not aspirational — the whole pipeline has been
run through it. It replaces two provider accounts with one billed in credits,
but not quite all: the vision check needs an Anthropic key whichever backend
paints the frames. `SOUND_PROVIDER=inreels` is newer than the rest and has not
had a whole ad through it; drop that line and keep an ElevenLabs key if it
gives you trouble. Without
`CLAUDE_API_KEY` step 2 paints without checking its own work and says so,
rather than failing after you have paid for the frame.

```bash
INREELS_API_KEY=ir_live_…      # inreels.ai/dashboard/settings/api-keys
IMAGE_PROVIDER=inreels
MOTION_PROVIDER=inreels
VOICE_PROVIDER=inreels
SOUND_PROVIDER=inreels
INREELS_MOTION_MODEL=seedance-2.0-mini-frames   # 3 credits per 5s
```

For this format in particular, Seedance mini is the one to reach for: it is
about a quarter the price of Kling and holds comic timing better, which is what
a clay performance lives on. On inReels voices are named slugs
(`allison-millennial`), not ElevenLabs ids — `list_voices` gives the forty.

ffmpeg is required either way.

## Method

### 1. Write the beat map — you, not a script

The user gives you a product. Write `work/ad.json` yourself.

- **Time every shot by hand.** `seconds` on each one. This is the format; do
  not leave it to be derived.
- **The problem must be visible in shot 1.** Not a logo, not a title — the
  mess.
- **One joke, landed on the beat shot.** That single long hold is the only
  place a performance fits.
- **The montage is materials, not story.** Suds, fibre, water, shine. Nobody
  reads a montage cut; they feel it.
- **Every character gets a locked `look`** — face, ears, nose, clothing
  colours. Clay faces carry broad expressions well and subtle ones badly, so
  write big emotions.
- **Describe what IS, never what is not.** "The plate is clean and shining"
  works; "the plate is not dirty any more" paints a dirty plate.
- **Write `product.pack` properly** — colours, shape, what is printed on it.
  It is painted once and used as a reference everywhere the pack appears.
- **The voice fits the picture, not the reverse.** ~2.6 words a second, and
  the end card is not talked over.

Then check the rhythm in code, because your own timings will drift:

```bash
node scripts/0-validate.mjs --ad work/ad.json
```

It prints the beat map as a table and fails on a montage cut that is too long,
a missing movement, a beat hold under 2.5s, a setup that does not accelerate,
and a voiceover too long for the picture.

### 2. Show the user, and wait

Print the beat table, the joke, the pack line and the tagline. Ask for a yes.
Nothing has been spent yet.

Never skip this.

### 3. Run the pipeline

```bash
node scripts/2-images.mjs --ad work/ad.json --dir work            # pack, sheets, shots, QC
node scripts/3-voice.mjs  --ad work/ad.json --dir work            # VO + the timeline
node scripts/4-motion.mjs --story work/ad.json --dir work --count 3
node scripts/5-sound.mjs  --story work/ad.json --dir work         # effects + mix
node scripts/6-render.mjs --ad work/ad.json --dir work --out work/ad.mp4
```

Steps 4 and 5 are the same scripts the `animated-short` skill uses, and they
take `--story` because they never learn this is an ad: step 3 stamps each shot
with the span it occupies, and that is the only thing they read.

To redo one shot:

```bash
node scripts/2-images.mjs --only 7 --fix "the sponge is soaked and foaming" --dir work
```

**Text.** Every frame is held to the no-letters rule except the pack, where the
brand name is required and checked by eye against the spelling you gave. This
is the one place an image model is allowed to write.

**Motion.** Two modes.

```bash
node scripts/4-motion.mjs --story work/ad.json --dir work --count 3   # the big beats
node scripts/4-motion.mjs --story work/ad.json --dir work --full      # everything that can move
```

`--full` animates every shot of 0.6s or more that has a `motionPrompt`.
Stop-motion is supposed to move, and a still clay frame reads as a photograph
of a puppet rather than a puppet, so for this format `--full` is usually worth
the money. It costs about $3 more.

Two things it will not animate, both deliberate:

- **Montage cuts.** Three frames is below the threshold where anyone perceives
  movement. The money is invisible.
- **The pack.** Image-to-video models erode printed text across a clip. Our
  hero shot began as "Lifts mud in one wash" and ended as "Lifte nod lo ore
  wash" — on the one frame the whole ad exists for. Broadcast locks off the
  beauty shot for exactly this reason. `--motionPack` overrides it if you want
  to try; check the last frame, not the first.

If you swap the motion backend, note that the look-lock and the negative
prompt are chosen per shot: a macro insert is told to stay photographic and is
NOT given `photorealistic` as a negative, and a pack shot is allowed lettering
while being told not to warp or misspell it. A single global negative list
fights the format in both directions.

### 4. Hand it over

Give them `work/ad.mp4`. Never auto-post it anywhere.

## What it costs

A 26s spot with 3 animated shots:

```
pack + sheets + ~25 shots + repaints   ~$1.20
voiceover                              ~$0.02
3 motion clips                         ~$1.26
  (or --full, 5 clips, ~$2.94)
ambience + effects                     ~$0.10
                                       ───────
                                        ~$2.60
```

All stills is about **$1.30**. Say the number before you spend it.

## What fails

- **Even cut lengths.** The single most common failure. It stops being an ad.
- **A montage that tells story.** It is texture. Story goes in the beat shot.
- **Animating the montage.** Four times the cost, invisible.
- **A pack described vaguely.** Then it changes between the hero and the end
  card, and the one frame the ad exists for is the one that looks fake.
- **Letters anywhere but the pack.** Invented lettering is the clearest tell
  there is.
- **Animating the pack.** The brand name degrades over the clip. Check the LAST
  frame of any shot you animate, never the first.
- **Talking over the end card.** Let the tagline land in silence.

## Styles

`looks.clay` and `looks.macro` are plain strings — swap either and the pipeline
is unchanged. The `animated-short` skill ships twelve tested look strings in
its `styles/` folder, each with a rendered proof image; the felt, crochet and
papercraft ones all work here in place of clay.

One rule before you write your own: a **physical medium** needs the texture
named, a counted palette, and a statement of what the medium is not. A
**photographic look** needs none of that — lens and lighting terms carry it.
