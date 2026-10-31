---
name: ad-creative
description: Produce static ad creatives — hook, angle, and rendered image — for a product or landing page, using the inReels MCP server. Use when asked to make ads, ad creatives, Meta/Instagram/TikTok ad images, or to test creative angles for a product.
---

# Ad creative

Turn a product into ad creatives that a buyer could actually run: a stated angle,
a hook written to be read in under a second, and a rendered image sized for the
placement.

## Requirements

The inReels MCP server must be connected. Check with `get_account` — if it fails,
the user needs to add the connector:

```
claude mcp add --transport http --scope user inreels https://www.inreels.ai/api/mcp
```

Then set an API key from https://www.inreels.ai/dashboard/settings/api-keys.

## Method

### 1. Get the angle before the image

Do not generate anything yet. Ads fail on the angle far more often than on the
render, and an image made before the angle is settled is a wasted credit.

From the product (URL, description, or images the user gave you) establish:

- **Who it is for**, specifically. "Busy people" is not a who.
- **The friction** they feel today, in their words, not the brand's.
- **The angle** — the single claim this creative makes. One per creative.
- **The hook** — 3 to 7 words, readable at a glance in a feed.

If the user gave you a landing page, read it first. The page's own headline is
usually the weakest available angle, because it was written to satisfy everyone.
Look at what the page's objection-handling and FAQ reveal about the real
hesitation, and aim there.

State the angle and hook back to the user before spending anything. One round of
correction here is worth three regenerations.

### 2. Price it

```
quote { "media": "image", "image": { "prompt": "<your prompt>", "aspect_ratio": "9:16" } }
```

The number returned is exactly what the generation charges. Report it if the user
has not already approved a spend.

### 3. Choose the model deliberately

Call `list_models` and pick on what the creative needs:

- **`nano-banana`** — the default. Good general renderer, accepts up to 3
  reference images, so this is the one to use when the real product must appear.
- **`nano-banana-pro`** — when the creative carries text or needs detail to hold
  up at full size.
- **`flux-schnell`** — cheapest. Use it to test several angles quickly before
  committing to a final render.
- **`flux-kontext-pro`** — editing. Requires exactly one reference image, and
  edits it rather than inventing a new scene.

If the user supplied product photos, pass them as `ref_urls` so the product in
the ad is the real product. An invented stand-in is the fastest way to make a
creative unusable.

### 4. Render

```
generate_image {
  "prompt": "<scene, framing, lighting, where the product sits, where text goes>",
  "aspect_ratio": "9:16",
  "model": "nano-banana",
  "ref_urls": ["https://…/product.jpg"]
}
```

This returns a `run_id` immediately. Then:

```
get_run_status { "run_id": "…", "wait": true }
```

`wait: true` blocks up to 45 seconds and usually returns a finished image in one
call. Never give the user a URL before the run reports `completed`.

### 5. Vary one thing at a time

When the user wants options, change exactly one variable per creative — the
angle, or the framing, or the product placement — and say which. Four images that
differ in everything teach nothing about what worked.

## Prompting for ads specifically

What actually moves ad performance, in rough order:

- **Leave room for text.** Decide where the hook will sit and keep that area
  uncluttered. State it in the prompt: "lower third clear for text overlay".
- **Native over polished.** Feed ads that look like studio work read as ads and
  get scrolled. Phone-camera framing, ordinary light, and a real surface beat a
  seamless gradient.
- **Product legible at thumbnail size.** If it is unrecognisable at 100px wide,
  the creative does not work, however good it looks full size.
- **One subject.** Two competing focal points halves both.

## Spending rules

- `quote` before `generate_image` whenever the user has not pre-approved.
- Failed runs are refunded in full, so a failure is not a loss — but a
  *successful* render of the wrong angle is.
- Do not loop. If two renders in a row miss, the prompt is wrong, not unlucky;
  go back to the angle and say so.
