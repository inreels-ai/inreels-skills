---
name: hook-writing
description: Write the first two seconds of a video ad or short — the line that decides whether anyone sees the rest. Use when writing an ad script, a faceless video script, or when an existing video is getting views but no watch time.
---

# Hook writing

The first two seconds decide the ad. Everything else in the script is
negotiable; this is not. Use this before `ugc-ad`, `product-demo-ad` or
`faceless-video` — they all assume the hook is already good.

This skill spends nothing. It is craft, not a tool call.

## What a hook actually is

A hook opens a gap the viewer needs closed. It is not a summary of the video,
and it is not the brand saying hello.

```
NOT a hook                        A hook
─────────────────────────────────────────────────────────
"Introducing NutriPro"            "I stopped buying smoothies"
"Today we look at the Mona Lisa"  "The Mona Lisa is not the original"
"Our serum has niacinamide"       "My dermatologist told me to stop"
```

The left column tells the viewer what they are about to get. Once they have it,
they can leave. The right column makes leaving cost something.

## Five shapes that work

Pick one. Do not stack two — a hook that does two jobs does neither.

1. **The reversal.** State the thing the viewer believes, then break it.
   "Expensive moisturiser was making my skin worse."
2. **The number that seems wrong.** Specific, checkable, slightly implausible.
   "I made 40 ads last month for $12."
3. **The stake before the subject.** Say what is at risk, name the topic after.
   "This mistake cost me the whole launch."
4. **The mid-action open.** Start inside the moment, no setup.
   "— and this is the third one that broke this week."
5. **The confession.** A real admission earns attention cheaply.
   "I almost returned this."

## Rules

- **Under 8 words if spoken.** You have two seconds at ~2 words per second.
- **Visual and line must not say the same thing.** If the shot shows the
  product and the line names the product, the viewer has learned nothing in the
  most expensive two seconds you own.
- **No brand name in the hook.** The viewer did not come for your brand. Name
  it once they are in.
- **No question the viewer can answer "no" to.** "Want better skin?" — no. A
  closed question is an exit.
- **Write it last, place it first.** Write the body, find the single most
  surprising sentence in it, and move that to the front.

## Testing hooks instead of guessing

One hook is an opinion. Three hooks is a test. This is the main reason
`create_ad_video` takes a `variations` count — same product, same creator,
different openings.

```
quote_ad_video { "product_image_url": "…", "script": "…", "variations": 3 }
```

Write three hooks of **different shapes** from the list above, not three
rewordings of one. Reworded hooks produce three ads that lose together and
teach you nothing.

## What fails

- **A hook that is a brand statement.** The most common failure by a distance.
- **A hook the body does not pay off.** Opening a gap and not closing it is
  worse than a flat ad — it reads as bait and the comments say so.
- **A hook written to be clever.** Clever costs a beat of comprehension, and
  you do not have a spare beat.
- **The same hook in every variation.** You have then tested nothing.
