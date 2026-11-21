---
name: character-consistency
description: Keep the same person, or the same product, looking identical across several generated video clips. Use when building a multi-clip ad or story where a character must not change face, or when a product label keeps mutating between shots.
---

# Character consistency

Generated clips drift. Ask the same model for the same person twice and you get
cousins. This is the method that actually holds identity across a sequence, and
it costs one extra image generation, not a custom model.

## The problem, precisely

Each clip is generated independently. A text prompt — however detailed — does
not pin a face. "A woman in her late twenties with shoulder-length brown hair"
describes thousands of people and you will meet several of them.

## The method: chain the frames

```
clip 1  ─ generate ─► extract last frame ─► upload_image
                                                 │
clip 2  ◄─ generate from that frame as the first frame
                                                 │
clip 3  ◄─ …and so on
```

Identity holds perfectly, because clip 2 does not re-invent the person — it
starts from a picture of them.

### 1. Make clip 1

Any text-to-video model. This one establishes the person, the wardrobe and the
room, so spend your prompt effort here.

```
generate_video { "model": "seedance-2.0-t2v", "prompt": "…", "duration": 5 }
```

### 2. Take a frame out of it

Download the MP4 and pull a frame with ffmpeg — late in the clip, where the
pose has settled:

```bash
ffmpeg -ss 4.5 -i clip1.mp4 -frames:v 1 frame1.png
```

### 3. Put it back in as the first frame

```
upload_image { "image_base64": "…" }
```

```
generate_video {
  "model": "seedance-2.0-frames",
  "image_url": "<the uploaded frame>",
  "prompt": "<what happens next>",
  "duration": 5
}
```

The `*-frames` models take the image as the literal first frame. `seedance-2.0-frames`
is the quality option; `seedance-2.0-fast-frames` is cheaper and silent, which
is fine for B-roll where nobody speaks.

## The trap: the first frame anchors the expression

This is the part that surprises people, and it cost us a render to learn.

If clip 1 ends on a tearful face and clip 2's prompt asks for a suspicious
squint, **you get a tearful squint**. The first frame does not just pin the
identity — it pins the emotion and the pose, and the prompt cannot override it.

To change expression or posture between clips:

```
frame from clip 1 ──► generate_image (new expression, frame as reference)
                              │
                              └──► generate_video  *-frames  from THAT
```

You are generating a new keyframe of the same person wearing the new
expression, then animating it. One extra image call, and the sequence works.

## The same trick holds a product label

Product text mutates between shots unless it is in a reference image. Generate
each shot's keyframe with `generate_image` using **one** product photo as the
reference, then animate the keyframes. We have run four shots this way with the
label correct in all four.

Rules that made the difference:

- **One product photo as reference, not several.** Two photos give the model
  objects to juggle — bottles vanish, hands swap.
- **Say the product stays in the same hand for the whole clip.**
- **One simple motion per clip** — tilt to camera, pat onto cheek. Not a
  sequence.

## When not to bother

If you want a finished ad rather than a sequence you assemble yourself, use
`create_ad_video` — it handles the creator and product internally and returns
one rendered MP4. This skill is for multi-clip work where you are cutting the
clips together in your own editor.

## What fails

- **Re-describing the person in text for each clip.** This is the thing that
  does not work, and it is everyone's first attempt.
- **Extracting a frame mid-blink or mid-word.** Scrub for a clean one.
- **Expecting the prompt to beat the first frame.** It does not. Make a new
  keyframe.
- **Several reference images at once.** Fewer references, more consistency.

## Spending rules

- Every `generate_video` and `generate_image` call spends credits. `quote`
  first — it charges nothing and returns exactly what the call will cost.
- A 4-clip sequence is 4 video calls plus the keyframes. Price the whole
  sequence before the first one.
- Failed runs refund in full.
