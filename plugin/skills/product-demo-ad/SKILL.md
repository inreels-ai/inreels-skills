---
name: product-demo-ad
description: Make a product-led video ad with no presenter — the product doing its job, in motion, with native audio. Use when asked for a product video, demo ad, product-only ad, or when a product is visual enough that a talking creator gets in the way.
---

# Product demo ad

No face. The product does the work, the camera stays close, and the viewer sees
the thing happen. For a product that demonstrates itself this beats a creator
ad, and it costs the same.

## When to take this over `ugc-ad`

```
product-demo-ad          ugc-ad
──────────────────────────────────────────────
it visibly DOES something it needs vouching for
the result is on screen   the result is internal
B2B / tools / hardware    beauty / supplements / apparel
no likeness questions     a face builds the trust
```

A blender, a cleaning spray, a label maker, a software UI: demo. A vitamin, a
mattress, a course: creator.

## Requirements

inReels MCP connected — `get_account` to verify. `create_ad_video` needs a paid
plan.

A product image is required. Omit `creator_actor_id` and `creator_image_url`
and you get the product-led ad.

## Method

### 1. Find the one action worth watching

The ad is built around a single physical thing happening. Name it before you
write a word of script:

- cup onto the base → press → it blends
- cap off → pump → rub in, and the texture changes
- the strip peels and the surface is clean behind it

**An appliance that stays off is a dead ad.** We have rendered this and it is
boring in exactly the way you expect. If the product has an on state, turn it
on. If it has a before and after, show both in one continuous move.

### 2. Write for the action, not over it

Narration explains what is not visible. The screen handles what is.

| Length | Words |
|---|---|
| 5s | up to 10 |
| 10s | up to 20 |
| 15s | up to 30 |

Over budget and the line gets clipped mid-sentence — the model does not speak
faster to fit. Cut words rather than hoping.

Often the best product demo has no narration at all: the sound of the thing
working, and one line of text at the end. If you want that, say so in the
`brief` and keep the script short or absent.

### 3. One product, one surface

The model juggles objects badly. Hold the scene down:

- Exactly one of the product in frame, never a duplicate.
- Only props the action needs. Nothing arrives that was not there at the start
  — a surprise second cup or a straw appearing from nowhere is the giveaway
  that this was generated.
- The product stays in one place or one hand through the move.

### 4. Quote, then render

```
quote_ad_video { "product_image_url": "…", "script": "…", "variations": 3 }
```

```
create_ad_video {
  "product_image_url": "…",
  "script": "<within budget, or omit for brief>",
  "brief": "<the action, if you are letting the model write the line>",
  "look": "natural",
  "aspect_ratio": "9:16",
  "variations": 3
}
```

`look`: `commercial` is the one case where it earns its place — a product-led
ad is allowed to look produced. `natural` still reads as more trustworthy on
Meta. Test both if the budget allows; that is what `variations` is for.

### 5. Poll and hand over

```
get_run_status { "run_id": "…", "wait": true }
```

Five to ten minutes. `watch_url` appears before the MP4 does — it is a preview
page, not the deliverable. Hand over `output_url`, and only once the run reports
`completed`.

## What makes these fail

- **The product never does anything.** The single biggest one. Static product
  on a turntable is a stock video, not an ad.
- **A cluttered product image.** Every frame inherits it. If the label is
  illegible at thumbnail size, the ad is illegible in the feed.
- **Describing the product by brand name.** On-screen brand text comes out
  misspelled. Describe shape, colour and parts instead.
- **Narration that reads the screen aloud.** Say what the picture cannot.
- **Too much action in a short take.** A 5s ad holds one move. Asking for three
  gets you cuts you did not want.

## Spending rules

- `create_ad_video` spends credits and needs a paid plan.
- `quote_ad_video` first; the quote is exactly what the call charges.
- Each variation is charged separately — quote the set and state the total.
- Failed runs refund in full.
