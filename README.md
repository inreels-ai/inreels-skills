# inReels Agent Skills

Open skills for making ads, UGC video and faceless shorts from an AI agent,
built on the [inReels MCP server](https://www.inreels.ai/api/mcp).

The skills are MIT licensed and free. The rendering service they call is paid.

## Install

Point your agent at the install instructions and let it do the work:

```
Install the inReels skills: https://raw.githubusercontent.com/inreels-ai/inreels-skills/main/install.md
```

Or by hand:

```bash
# 1. Add the MCP server
claude mcp add --transport http --scope user inreels https://www.inreels.ai/api/mcp

# 2. Copy the skills you want
git clone https://github.com/inreels-ai/inreels-skills
cp -r inreels-skills/skills/* ~/.claude/skills/
```

Then run `/mcp`, pick `inreels` and sign in from the browser. Or create a key
at <https://www.inreels.ai/dashboard/settings/api-keys> and set it as the
server's bearer token.

Cursor, Codex, ChatGPT and Muse are all supported —
see <https://www.inreels.ai/connect>.

## The skills

| Skill | What it does |
|---|---|
| [`ugc-ad`](skills/ugc-ad/SKILL.md) | Product image + creator + spoken script → rendered UGC video ad, with native audio |
| [`ad-creative`](skills/ad-creative/SKILL.md) | Angle → hook → rendered static ad creative, sized for the placement |
| [`faceless-video`](skills/faceless-video/SKILL.md) | Retention-shaped script → scenes, narration, captions → rendered MP4 |

Each one states its method, names the failure modes it has actually seen, and
is honest about what it does not do.

## What the MCP server exposes

17 tools across two layers.

**Capabilities** return a finished deliverable and choose the model for you:

- `create_ad_video` — a finished ad from a product image, with native audio.
  Add a creator and it becomes a UGC ad.
- `create_faceless_video` — script to scenes to narration to captions to MP4.
- `quote_ad_video`, `quote_faceless_video` — exact price first.

**Primitives** render one asset and expose the full parameter surface:

- `generate_image`, `generate_video`, `generate_speech`
- `quote` — exact price of any primitive call, charging nothing.

**Discovery and plumbing**, all free:

- `list_models`, `list_voices`, `list_styles`, `list_actors`
- `get_run_status`, `list_runs`, `get_account`
- `upload_image`, `refresh_asset_url`

## Conventions worth knowing

**Nothing blocks.** Every generating tool returns a `run_id` immediately,
because a model that usually takes 20 seconds sometimes takes 180, and a host
agent that waits that long has stalled a conversation. Poll with
`get_run_status { wait: true }`, which blocks up to 45 seconds.

**Video has two stages.** The scenes are built, then the MP4 is rendered —
roughly 5–10 minutes end to end. A run reports `completed` only once the file
exists. A `watch_url` appears before `output_url` does; it is a preview page,
not the deliverable, and handing it to a user as the finished video is the most
common mistake an agent makes here.

**Quote before you spend.** The price is a pure function of the validated
request, so `quote` and the real call cannot disagree.

**Failed runs refund in full.** A provider rejecting our request shape is our
defect, not the caller's input.

**Models are validated against live provider schemas.** Every option the server
exposes is checked against what the provider actually publishes, so an agent
cannot be handed a parameter combination that 422s. This exists because it once
did: a lowercase `768p` where the provider wanted `768P` failed every generation
on the default model until a customer reported it.

**Unlisted ids are rejected, not substituted.** A model, voice, style or music
id that is not in the list comes back as an error rather than quietly becoming
something else.

## Contributing

Skills are plain Markdown with YAML frontmatter — `name` and `description`, then
the method. A good one is specific about craft and specific about what fails.
PRs welcome.

## License

MIT for the skills in this repository. The inReels API is a separate paid
service under its own terms.
