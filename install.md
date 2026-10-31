# Install the inReels skills

Instructions for an AI coding agent. If a human is reading this, the same steps
work by hand.

Ask the user before installing anything.

## 1. Add the MCP server

```bash
claude mcp add --transport http --scope user inreels https://www.inreels.ai/api/mcp
```

Then tell the user to run `/mcp`, pick `inreels`, and complete the browser
sign-in. OAuth 2.1 with dynamic client registration — nothing to configure on
either side.

If their client cannot do OAuth, they create a key at
<https://www.inreels.ai/dashboard/settings/api-keys> and it goes in an
`Authorization: Bearer ir_live_…` header instead.

For Cursor, Codex, ChatGPT or Muse, the per-client steps are at
<https://www.inreels.ai/connect>.

## 2. Install the skills

```bash
git clone --depth 1 https://github.com/inreels-ai/inreels-skills /tmp/inreels-skills
cp -r /tmp/inreels-skills/skills/* ~/.claude/skills/
rm -rf /tmp/inreels-skills
```

For Cursor or Codex, copy into that client's skills directory instead.

Install all three, or only the ones the user wants:

| Skill | Use it when they ask for |
|---|---|
| `ugc-ad` | a UGC ad, creator ad, testimonial, talking-head product video |
| `ad-creative` | static ad images, Meta/Instagram/TikTok creatives, angle testing |
| `faceless-video` | a faceless short, narrated video, documentary reel, brainrot |

## 3. Check it works

```
get_account
```

Returns the plan and credit balance. If it fails with `unauthorized`, the
sign-in did not complete.

Read-only tools cost nothing, so this is safe to run as a check:

```
list_models
list_actors
```

## What to tell the user afterwards

- Generating tools spend credits. `quote` first — the number it returns is
  exactly what the call charges.
- Failed runs are refunded in full.
- Video takes 5–10 minutes and reports `completed` only when the MP4 exists.
- `create_ad_video` needs a paid plan.
