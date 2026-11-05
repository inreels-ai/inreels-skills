---
name: ad-angle-testing
description: Produce a set of ads that test different claims against each other, rather than one ad. Use when asked for ad variations, A/B creative, a creative batch, or when a single ad is not performing and the next step is unclear.
---

# Ad angle testing

Ads are not shipped, they are tested. One ad is an opinion with a budget
attached. This skill turns a product into a set of ads that disagree with each
other usefully.

## The core idea

Most people vary the wrong thing. They render one ad four times with different
music and call it a test. That tests nothing, because the four ads make the
same claim — they win or lose together.

```
WRONG axis                 RIGHT axis
────────────────────────────────────────────────
different music            different claim
different creator          different audience
different colour grade     different friction
same promise               same product
```

Vary the **angle**: who it is for, and what it promises them.

## Method

### 1. Find three real angles

An angle is a who plus a friction plus a claim. Write them out before any tool
call:

```
A  busy parents · no time to cook breakfast · one minute, one cup
B  gym people   · protein shakes taste chalky · actually drinkable
C  small kitchen owners · no counter space   · it is the size of a mug
```

Three angles for the same product. Each one excludes the others — that is what
makes the test readable.

Where to find them: the product page's FAQ and its objection-handling tell you
the real hesitations. The headline tells you the weakest angle, because it was
written to satisfy everybody.

### 2. Write one hook per angle

Use the `hook-writing` skill. Different **shapes**, not rewordings — a reversal
for one, a number for another, a confession for the third. Three rephrasings of
one hook produce three ads that teach you nothing.

### 3. Quote the set, not the ad

```
quote_ad_video { "product_image_url": "…", "script": "<angle A>", "variations": 1 }
```

Each angle is its own call, because each has its own script. Multiply by three
and state the total to the user before you spend anything.

Use the `variations` parameter **within** an angle when you want the same claim
rendered more than once — different delivery of one script. Use separate calls
when the claim itself changes. They are different tests:

```
variations: 3     one claim, three executions   → which execution
3 separate calls  three claims                  → which claim
```

Find the claim first. Execution only matters once something is working.

### 4. Render them as a batch

Submit all three, collect the run ids, then poll. Submitting before polling is
considerably faster than one at a time.

```
create_ad_video { "product_image_url": "…", "script": "<A>", "look": "natural", "aspect_ratio": "9:16" }
create_ad_video { "product_image_url": "…", "script": "<B>", … }
create_ad_video { "product_image_url": "…", "script": "<C>", … }
```

Hold everything else constant — same product image, same creator, same look,
same length. A test with two variables has no result.

### 5. Hand over as a set, labelled

Give the user the three MP4s **with their angles written next to them**. An
unlabelled batch of three files is unusable a week later when the numbers come
in and nobody remembers which was which.

```
ad-A-busy-parents.mp4   "one minute, one cup"
ad-B-gym-taste.mp4      "actually drinkable"
ad-C-small-kitchen.mp4  "the size of a mug"
```

## Reading the result

Tell the user what to look at, because the platform will offer them twenty
numbers:

- **Hook rate** (3-second views ÷ impressions) judges the first two seconds.
  A low hook rate kills the angle, not the ad.
- **Hold rate** (watched to end) judges the body.
- **Cost per result** judges the offer, and is the slowest to read.

A losing angle with a strong hook rate is worth rewriting. A winning hook with
a bad hold rate means the body did not pay the hook off.

## What fails

- **Varying execution before finding the claim.** The most common waste.
- **Three angles that are the same angle.** "Fast", "quick" and "saves time"
  are one angle.
- **Changing the product image between variants.** Now you are testing the
  photo.
- **Stopping at one round.** The first set tells you which direction; the
  second set goes deeper in that direction.

## Spending rules

- Every call spends credits and `create_ad_video` needs a paid plan.
- Quote all three and state the total before the first render.
- Failed runs refund in full.
