---
name: ugc-ad
description: Make a UGC-style video ad from a product image — creator, spoken script, native audio, rendered MP4 — using the inReels MCP server. Use when asked for a UGC ad, creator ad, testimonial ad, talking-head product video, or a video ad for Meta/TikTok/Instagram.
---

# UGC ad

A person holding your product, talking to camera, in a video that looks like it
was filmed on a phone. The thing that actually sells on Meta and TikTok.

## Requirements

inReels MCP connected. Verify with `get_account`.

```
claude mcp add --transport http --scope user inreels https://www.inreels.ai/api/mcp
```

`create_ad_video` needs a paid plan. If the user is on free, say so before
writing a script rather than after.

## You need a product image first

The ad is built around it — this is not optional and there is no text-only path.

- The user gives you an image URL → use it.
- The user gives you a file or a pasted image → `upload_image` with base64, and
  use the URL it returns.
- The user gives you only a product page → ask for the image. Do not generate a
  fake product; the whole point is that their actual product appears.

If the image is cluttered, lit badly, or the packaging is unreadable, say so
now. Every frame of the ad inherits it.

## Method

### 1. Angle before script

One ad makes one claim. Establish, from the product and whatever the user told
you:

- **Who it is for**, specifically. "Busy people" is not a who.
- **The friction** they feel today, in their words, not the brand's.
- **The angle** — the single claim this ad makes.

A landing page's own headline is usually the weakest available angle, because it
was written to satisfy everyone. Its FAQ and objection-handling tell you more
about the real hesitation. Aim there.

### 2. Write to the word budget, or don't write at all

The script sets the length, and the budget is tight:

| Length | Words |
|---|---|
| 5s | up to 10 |
| 10s | up to 20 |
| 15s | up to 30 |

Over budget and the line gets clipped mid-sentence — the model does not speak
faster to fit. **Cut words rather than hoping.**

If you cannot make the claim in the budget, do not submit a long script. Either
go up a length, or omit `script` entirely and pass a `brief` instead, which lets
the model write its own line to fit.

A UGC line is spoken, not written. Contractions, one idea, no brand voice. "I
stopped buying the expensive one" beats "Discover our premium formulation".

### 3. Pick the creator

`list_actors` returns the roster. Pass `creator_actor_id` for one of ours, or
`creator_image_url` for the user's own photo.

Omit both and you get a product-led ad — no person, just the product in motion.
That is the right choice for a product that demonstrates itself, and for
categories where a presenter reads as an advert.

### 4. Quote, then render

```
quote_ad_video { "product_image_url": "…", "script": "…", "variations": 3 }
```

```
create_ad_video {
  "product_image_url": "…",
  "creator_actor_id": "<from list_actors>",
  "script": "<within budget>",
  "look": "natural",
  "aspect_ratio": "9:16",
  "variations": 3
}
```

`look`: `natural` reads as real UGC and is the default worth keeping;
`raw_iphone` is deliberately rough; `commercial` is polished and stops looking
like UGC, which is usually the opposite of what was asked for.

**Ask for variations.** Ads are tested in sets, not shipped one at a time. Three
angles beat one angle rendered beautifully. Each variation is charged
separately, so quote the set and say the total before submitting.

### 5. Poll and hand over

```
get_run_status { "run_id": "…", "wait": true }
```

Minutes, not seconds. Keep polling until `completed`, then give the user the
MP4 URLs. Never hand over a URL from a run that has not reported `completed`.

Signed URLs expire — `refresh_asset_url` mints a new one.

## What makes these fail

- **Script over budget.** The single most common failure. Count the words.
- **A hook that is a brand statement.** The first two seconds decide the ad.
  Open on the friction or the result, never on the company.
- **A product image the viewer cannot read.** If the label is illegible at
  thumbnail size it is illegible in the feed.
- **One variation.** You cannot tell what works from one ad.
- **Asking for a face when the product is the story.** Omit the creator.

## Spending rules

- `create_ad_video` spends credits and needs a paid plan.
- Quote before you spend; the quote is exactly what the call charges.
- Failed runs refund in full.
- Credits are charged on completion by the pipeline, not at submit.
