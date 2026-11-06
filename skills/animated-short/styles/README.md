# Style packs

One file per visual style. Each holds a **tested** style string — copy it
verbatim into `story.json`'s `style` field, where it is appended to every image
prompt.

Every string here was proven with a probe image before it was written down. If
you add one, probe it first (one image, ~$0.04) rather than writing a string
that reads well and renders badly.

| Pack | Reads as | Best for |
|---|---|---|
| [noir-painterly](noir-painterly.md) | storm-lit oil painting | drama, mystery, character stories |
| [ink-wash](ink-wash.md) | sumi-e on rice paper | myth, solitude, historical |
| [watercolour](watercolour.md) | loose pigment on cold-press | memory, gentle, explainers |
| [cartoon-explainer](cartoon-explainer.md) | flat bold vector | facts, how-things-work, kids |
| [paper-collage](paper-collage.md) | cut magazine + halftone | editorial explainers, data |
| [papercraft](papercraft.md) | real layered construction paper | whimsy, children's stories |
| [low-poly](low-poly.md) | PS1-era real-time 3D | retro, gaming, internet culture |

## Writing a new pack

Styles that are **painting techniques** land from one plain sentence of medium,
light and palette.

Styles that are a **physical medium or a render engine** do not, until the
string carries three things:

1. **The texture, by name** — "fibrous torn edges", "halftone newsprint",
   "texture warping".
2. **A tight, counted palette** — "six flat paper colours", "256-colour".
3. **What the medium is not** — "not painted, no gradients, no anti-aliasing".

That last one looks like it contradicts the rule in SKILL.md about never
describing what is absent. It does not, and the distinction matters:

```
negate an OBJECT     "its green light is out"   → paints a lit green light
negate a TECHNIQUE   "not painted, no gradients" → avoids painting
```

Object nouns attract. Technique words repel.

**The subject must suit the medium.** Collage reads as collage on an editorial
subject — a figure, a chart, arrows. The same string on a cinematic landscape
drifts back to illustration.
