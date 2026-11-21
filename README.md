# inReels Agent Skills

Open skills for making ads, UGC video and faceless shorts from an AI agent,
built on the [inReels MCP server](https://www.inreels.ai/api/mcp).
MIT licensed and free; the rendering service they call is paid.

## Install

One step in Claude Code — the MCP server and every skill together:

```
/plugin install inreels --marketplace inreels-ai/inreels-skills
```

Then run `/mcp`, pick `inreels` and sign in from the browser. There is no key
to paste: the server speaks OAuth.

Other clients, and doing it by hand, are covered in
[`plugin/README.md`](plugin/README.md) and [`install.md`](install.md).
Per-client steps live at <https://www.inreels.ai/connect>.

## What is where

| Path | What it holds |
|---|---|
| [`plugin/`](plugin) | The published plugin: the MCP server and the eight Markdown craft skills. This is the folder the directory installs. |
| [`dev-skills/`](dev-skills) | `animated-short` and `claymation-ad`. These two ship their own render scripts and need `ffmpeg`, so they are installed by copying the folder rather than through the plugin. |
| [`install.md`](install.md) | Instructions written for an AI coding agent to follow. |

## The skills

See [`plugin/README.md`](plugin/README.md) for what each one does and the
method behind it.
