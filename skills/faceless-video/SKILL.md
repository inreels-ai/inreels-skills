---
name: faceless-video
description: Make a faceless short — script, scene images, narration, captions, rendered MP4 — using the inReels MCP server. Use when asked for a faceless video, narrated short, documentary-style reel, brainrot or voiceover-over-visuals piece for TikTok/Reels/Shorts.
---

# Faceless video

Produce a finished faceless short: a script written for retention, one image per
scene with a consistent look, single-take narration, captions, and a rendered
MP4 the user can upload.

## Requirements

inReels MCP connected. Verify with `get_account`.

```
claude mcp add --transport http --scope user inreels https://www.inreels.ai/api/mcp
```

## Two routes, and when to take each

**`create_faceless_video`** does the whole pipeline in one call and returns a
rendered MP4. Take this route by default.

**The primitives** (`generate_image` + `generate_speech`) give you per-scene
control, and you assemble elsewhere. Take this route only when the user wants
to art-direct individual scenes, reuse the assets in their own editor, or
iterate on one image without re-rendering the film.

Do not take the primitive route because it feels more thorough. It costs more
calls, produces no MP4, and the capability applies the same craft rules.

## Method

### 1. Script first, and write it for the first two seconds

Nothing else matters if the opening fails. Write the hook before the topic
outline, not after.

A hook earns attention by creating an unresolved gap — a claim that cannot be
true, a number that seems wrong, a stake stated before the subject. It does not
earn attention by announcing the topic. "Today we're looking at the Mona Lisa"
is a title, not a hook.

Then structure:

- **0–2s** the hook. One sentence. No preamble, no "welcome back".
- **2–8s** the stake — why this is worth 40 more seconds.
- **body** one idea per scene, each advancing the question the hook opened.
- **close** resolve it. A faceless short that ends on a shrug loses the rewatch.

Length is set by the script, at roughly **two words per second** of finished
video. A 45-second short is about 90 words. Write to that; do not write long and
trim, because trimmed scripts lose their rhythm.

### 2. Show the script before spending

Faceless videos are the most expensive thing on the surface and the script
decides everything downstream. Put the script in front of the user and get a yes
before you call a generating tool.

Price it at the same time:

```
quote_faceless_video { "script": "<the script>", "visual_style": "<id>" }
```

`list_styles` gives the valid visual style, music and niche ids. An unlisted id
is rejected, not substituted.

### 3. Render it

```
create_faceless_video {
  "script": "<the approved script>",
  "visual_style": "<from list_styles>",
  "voice_id": "<from list_voices>",
  "music_id": "<from list_styles>",
  "aspect_ratio": "9:16"
}
```

Pick the voice deliberately — `list_voices` gives style and category, and a
documentary piece and a true-crime piece do not share a narrator.

Scene count is derived from the script. Do not try to set a duration that
contradicts the words you wrote.

### 4. Poll, and say what is happening

This takes **5 to 10 minutes**, in two stages: the scenes and narration are
built first, then the MP4 is rendered. Poll with:

```
get_run_status { "run_id": "…", "wait": true }
```

Each call blocks up to 45 seconds, so expect to call it repeatedly. While it
runs you will see `watch_url` appear before `output_url` does.

**Do not hand the user `watch_url` as the finished thing.** It is a preview page
that exists before the file does. The run reports `completed` only when
`output_url` is a real MP4 — that is what you give them. Until then, tell them
it is still rendering and roughly how long is left.

### 5. Hand over

Give them the MP4 URL, and the watch page beside it as a preview link. Mention
that signed URLs expire; `refresh_asset_url` mints a new one.

## The primitive route

Only when the user wants per-scene control.

One visual idea per scene, 3 to 6 seconds each. Write the narration line and the
image prompt separately — the narration is heard, the image is seen, and a
prompt that reads like a line of narration produces literal, illustrative images
that feel like clip art.

Decide the visual treatment **once**, up front, and repeat it verbatim in every
scene prompt: the medium, the palette, the light, the camera distance. Scene
images drift otherwise, and drift is what makes a faceless short look assembled
rather than made.

Quote one representative scene and multiply before generating ten.

```
generate_image { "prompt": "<treatment> — <this scene>", "aspect_ratio": "9:16" }
```

Submit every scene first, collect the run ids, then poll each one. Submitting
the batch before polling is considerably faster than one at a time.

Generate narration as **one call for the whole script**, not per scene. A single
take has continuous pacing; stitched per-scene takes have audible seams at every
cut.

```
generate_speech { "text": "<the full script>", "voice_id": "<id>" }
```

Then tell the user plainly that this route produces assets, not a video, and
where to assemble them: <https://www.inreels.ai/dashboard>.

## Avoiding slop

What makes faceless content feel machine-made, and what to do instead:

- **Narration that states what the image shows.** Say something the image does
  not. Image and voice should add up to more than either.
- **Every sentence the same length.** Vary it. Short sentence. Then a longer one
  that carries the actual argument and gives the ear somewhere to go.
- **Hedging.** "Many believe", "some would say", "it is often considered" — cut
  every one. Commit to the claim or drop it.
- **A moral at the end.** Resolve the hook; do not explain the lesson.
- **Stock-photo prompts.** "A businessman looking at charts" is slop by
  construction. Name a specific moment instead.

## Spending rules

- Show the script and the quote before the first spending call.
- Credits for a capability are charged by the pipeline on completion, not at
  submit. A run that fails costs nothing.
- If the user corrects the look after seeing the result, change the visual style
  and re-render rather than arguing for the one you made.
