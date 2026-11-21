---
name: scary-story-video
description: Make a scary story, true-crime or unsolved-mystery short — script, scenes, narration, captions, rendered MP4 — using the inReels MCP server. Use when asked for a horror short, creepy story, true crime video, unsolved mystery or a nighttime-atmosphere faceless video.
---

# Scary story video

The highest-retention faceless format, and the least forgiving. A horror short
that is not frightening is just a slideshow with a low voice.

Built on `create_faceless_video`. Read `faceless-video` first for the pipeline;
this skill is the craft that makes the genre work.

## The ids this genre actually uses

From `list_styles` — call it yourself, these are rejected if mistyped:

```
niche          scary-stories · true-crime · unsolved-mysteries
visual_style   cinematic-noir · cinematic-moonlight · emotive-anime-nighttone
music          dark-cinematic · blade-runner
```

`cinematic-noir` for crime and rain. `cinematic-moonlight` for isolation and
outdoors. `emotive-anime-nighttone` when the story is about a person's dread
rather than an event — animation lets you avoid uncanny faces entirely.

## Method

### 1. The hook is a fact, stated flatly

Horror hooks do not announce horror. The flat delivery of a wrong detail does
more than any adjective.

```
weak    "Here's the TERRIFYING story of the Dyatlov Pass incident"
strong  "They cut their way out of the tent. From the inside."
```

No "you won't believe", no "this will give you chills". Telling the viewer how
to feel gives them the option to disagree. See the `hook-writing` skill.

### 2. Withhold, then pay

The genre runs on an open gap. Structure:

- **0–2s** the wrong detail. One sentence, no context.
- **2–8s** the context that makes it worse.
- **body** escalate by revealing, one fact per scene. Each one should make the
  previous fact more disturbing in retrospect.
- **close** the resolution — or the explicit absence of one. "Nobody has ever
  explained it" is a legitimate ending in this genre and the only one where it
  is.

Roughly **two words per second**. A 45-second short is about 90 words.

### 3. Write cold

The genre's failure mode is over-writing. Cut every one of these:

- Adjectives doing emotional work: *terrifying, horrifying, chilling, eerie*.
  State the fact; the fact is the horror.
- Hedges: *allegedly, some say, many believe*. They are a disclaimer, and a
  disclaimer tells the viewer not to be afraid.
- Rhetorical questions mid-body: *But what really happened that night?* This is
  padding and it reads as padding.

Vary sentence length deliberately. Short sentence. Then a longer one that lets
the dread sit before the next short one lands.

### 4. Pick a narrator, not a voice

`list_voices` gives style and category. A true-crime narrator and a campfire
horror narrator are different performances — measured and documentary for
crime, closer and quieter for supernatural. The default `soothing-narrator` is
wrong for both.

### 5. Scene images carry the dread

Never show the thing. Show what is around it.

```
weak    "a ghost standing in a doorway"
strong  "an open doorway at the end of a hall, lit from behind, nothing in it"
```

Empty rooms, objects left mid-use, weather, the back of a head. Generated
figures and faces break the spell — they look generated, and a viewer who
notices the generation stops being afraid.

### 6. Show the script, then render

```
quote_faceless_video { "script": "<the script>", "visual_style": "cinematic-noir" }
```

```
create_faceless_video {
  "script": "<approved>",
  "visual_style": "cinematic-noir",
  "voice_id": "<from list_voices>",
  "music_id": "dark-cinematic",
  "aspect_ratio": "9:16"
}
```

Five to ten minutes, two stages. Poll `get_run_status { wait: true }`. Hand over
`output_url` only at `completed` — `watch_url` is a preview page, not the file.

## Two things to get right before publishing

- **Real crimes involve real people.** For true crime, keep to documented
  public facts, do not name uncharged suspects, and do not invent dialogue for
  real victims. Reach for `unsolved-mysteries` or fiction when the facts are
  thin.
- **Platforms restrict graphic content.** Implication travels further than
  depiction anyway, and it also stays monetisable.

## What fails

- **Adjectives instead of facts.** The defining failure of the genre.
- **Showing the monster.** Dread is anticipation; a reveal ends it.
- **A twist the body did not earn.** Plant it, then pay it.
- **A moral.** Resolve the question; do not explain the lesson.
- **The default bright visual style.** Atmosphere is half the format.

## Spending rules

- Show the script and the quote before the first spending call.
- Credits are charged on completion by the pipeline, not at submit.
- Failed runs cost nothing.
