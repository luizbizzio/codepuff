<div align="center">

# 🫧 CodePuff

### A coding pet that lives next to your AI agent.

It reads when your agent reads, types when it edits, squints while tests run, cheers only when a check **really** passed,
and winces when something **really** failed. For **Claude Code** and **OpenAI Codex**, one pet and one history for both.

[![CI](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml/badge.svg)](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-7253b9.svg)](CHANGELOG.md)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg)](https://nodejs.org)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![Local only](https://img.shields.io/badge/privacy-100%25%20local-informational.svg)](#privacy)

[**Install**](#install) · [**Meet the pets**](#meet-the-pets) · [**What it does**](#what-it-does) · [**Privacy**](#privacy) · [**FAQ**](#faq) · [**Docs**](#documentation)

<br>

<img src="docs/images/characters.png" alt="The eight CodePuff characters: idle, coding, success and error" width="760">

</div>

<br>

## Why a pet?

Agents work for minutes at a time, and a blinking cursor tells you nothing. CodePuff turns the agent's real events into something
you can read **at a glance**, and keeps a friendly record of your work while it does.

- **Honest, not decorative.** Every animation comes from a real event. No success dance unless a test run exited with code 0; no
  error face unless a tool actually failed. If CodePuff cannot know something (see [Codex](#claude-code-and-codex)), it says so
  instead of guessing.
- **Alive on long waits.** Thinking, reading, searching, typing, testing, delegating... each has its own scene, and long waits keep
  changing (a glance, a blink, a bright idea, and each character's own quirk), so it never looks frozen.
- **Yours.** Eight characters, ten palettes (or your own colors), a name, quiet sounds, three motion levels.
- **Private.** Everything stays on your computer. Only counters are stored, never your prompts, code or paths.
- **Light.** Zero dependencies. No account, no server, no telemetry, no model calls.

## Install

Nothing to build and nothing to configure.

### Claude Code

Type these two lines in Claude Code, then start a new session:

```text
/plugin marketplace add luizbizzio/codepuff
/plugin install codepuff@codepuff
```

(Desktop app: **+** next to the prompt → **Plugins** → **Add marketplace**.) The pet appears above the prompt, and `/codepuff` opens
its pane with your statistics and customization.

### Codex

```text
codex plugin marketplace add luizbizzio/codepuff
codex plugin add codepuff@codepuff
```

Then let Codex trust the hooks (it never runs new hooks without asking): `/hooks` in the CLI, *Review hooks* in the desktop app.
Codex has no plugin screen to draw on, so watch your pet in the terminal app next to it (needs [Node.js](https://nodejs.org) 20+; it runs
straight from GitHub, nothing is installed or built):

```text
npx github:luizbizzio/codepuff pet
```

### Check it

```text
npx github:luizbizzio/codepuff doctor
```

It tells you whether CodePuff is installed in Claude Code and in Codex, and what to do if it is not. Other routes (from a clone),
updating, uninstalling and troubleshooting: [docs/INSTALL.md](docs/INSTALL.md).

## Meet the pets

Every character is hi-res pixel art with shading, highlights and a full set of expressions, and each has its own way of idling,
thinking and waiting. Any of them wears any palette.

| | Character | Personality |
| --- | --- | --- |
| 🟣 | **Classic** *(default)* | A fluffy code cloud with headphones. Bounces when it is happy. |
| 🌱 | **Alpha** | The original CodePuff: a round, soft puff with a sprout. Waves hello. |
| 🦊 | **Foxy** | A curious explorer with goggles. Sniffs around; floats a **404** over its head when something fails. |
| 🤖 | **Bot** | A tidy little robot with a screen face. Scans left and right, status light blinking. |
| 🟢 | **Slime** | A glossy, bouncy code slime with a lucky star. Wobbles. |
| 🧙 | **Mage** | A tiny programming wizard with a book of spells. Sparks while it thinks. |
| 🐡 | **Penny** | A deep-sea puffer with curly dark hair. Floats and sways her fin. |
| 🟧 | **Claude** | A boxy orange critter (an unofficial fan design). Shuffles its feet. |

## What it does

### It shows what the agent is really doing

| You see | It means |
| --- | --- |
| 💭 a thought cloud: a light bulb, then a turning gear | the agent is working on a response |
| 📖 a book, its eyes sweeping the lines · 🔍 a magnifier | reading or searching |
| 💻 a laptop with floating `</>` · ⌨️ a shell with a spinner | editing code · running a command |
| 🌿 a commit graph · 🔌 a plug sliding into a socket | a git command · a tool from an MCP server |
| 🧪 goggles and a bubbling flask | a test run is in flight |
| ✨ sparkles | a test run **confirmed passed**, or a commit was made |
| ❗ a red badge (and Foxy's 404) | something **really** failed |
| 🟡 a yellow badge, hands up | the agent needs **you** (an approval or a question) |
| 🎊 confetti, then a happy face | the turn is done; it waits for your next prompt |
| 😴 half-closed eyes, a sweat drop | your plan's limit is nearly used up |

When subagents run, small helpers appear. With several sessions open, one fixed rule decides which one the pet shows, and the label
always says which agent and project it is.

### The compact band (Claude Code)

A band above the prompt with the whole pet, your streak, this session's prompts, its hearts, a status block that changes color with
what is happening, bars for your plan's 5-hour and weekly limits (once half used), and a ring showing how this session's tasks went.
Three sizes. Click the pet to pet it; it hops when you point at it.

### Statistics that are counted, never guessed

Prompts, turns, tool calls (succeeded and failed), files changed, tests run, commits, lines added and deleted, agent time, streaks,
and a daily chart, by **platform** (Claude Code, Codex or both) and **period** (this session, 7 days, 30 days, all time). Round
numbers (the 100th task, a 7-day streak...) get a celebration, once each.

### Hearts

The pet has one to five hearts for you, kept between sessions. Be kind and it beams; be abusive to the assistant and the hearts drop,
and it gets sad. Swearing at a bug is fine; harsh feedback only makes it flinch. The text of a prompt is looked at in memory to tell
the difference, then dropped: only a number is kept. You can turn this off in one click.

### Sounds

Short, original sounds when the agent **asks you something**, when a turn **finishes**, and when your **5-hour** or **weekly** limit
**resets**. Pick a sound for each (or none) and a volume. They start quiet.

## Claude Code and Codex

One pet, one set of settings and one history, shared by both. What differs is what each host lets a plugin do:

| | Claude Code | Codex |
| --- | --- | --- |
| Pet and band above the prompt, pane, status line, sounds, toasts | ✅ | ➖ Codex has no plugin screen |
| Terminal app (`codepuff pet`): pet, statistics, customization | ✅ | ✅ |
| Prompts, turns, tool calls, sessions, time | ✅ | ✅ |
| Tool results (passed / failed), test results, commits | ✅ | ⚠️ not reported by the Codex build checked, so those calls are counted with an *unknown* outcome |
| Plan limits (tired pet, reset sounds) | ✅ | ➖ |

CodePuff keeps its word here: nothing is shown for Codex that Codex did not report. If a later Codex sends tool completions, they
are used automatically. The details, and what was verified on which system, are in [docs/STATUS.md](docs/STATUS.md).

## Privacy

Everything stays on your computer, in one folder (`~/.codepuff`). No account, no server, no model calls, no telemetry. Only
**counters** are stored: never your prompts, code, commands, file paths or tool output (tested with sentinel strings). The single
place a prompt is read is the hearts: its text is judged in memory, then dropped. Switch that off (*Hearts react to my messages* in
Customize, or `/codepuff mood off`) and nothing is read at all. Export, import, reset or delete your data any time with
`codepuff data`. See [SECURITY.md](SECURITY.md).

## FAQ

**Does it slow my agent down?** No. The hook is a tiny Node process that writes one small file; measured numbers are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

**Does it send anything anywhere?** No. There is no network code.

**Can I use it with both Claude Code and Codex?** Yes, that is the point: they share the pet and the statistics. Install in Codex
**one way only** (the plugin *or* `codepuff install codex`), or every event is counted twice. `codepuff doctor` warns you if you did.

**It says "waiting for an agent" in the terminal app.** The agent has not run a hook yet: for Codex, trust the hooks (`/hooks`), then
send a prompt.

**How do I get a different pet?** `/codepuff` → **Customize** (or `/codepuff character fox`, or `codepuff set character fox`).

**Is it affiliated with Anthropic or OpenAI?** No. It is an independent project. "Claude" is an unofficial fan design.

## Documentation

| | |
| --- | --- |
| [Install](docs/INSTALL.md) | Other ways to install, updating, troubleshooting |
| [Features](docs/FEATURES.md) | Every state, surface, setting (with its default) and statistic, and the commands |
| [Architecture](docs/ARCHITECTURE.md) | How it is built, the data model, concurrency, adding a character |
| [Platforms](docs/PLATFORMS.md) | What Claude Code and Codex expose, and what only one of them can do |
| [Status](docs/STATUS.md) | What was verified where, known limitations, what comes next |
| [Performance](docs/PERFORMANCE.md) | Measured overhead, and how |
| [Development](docs/DEVELOPMENT.md) | Tests, tools, CI, the art and sound pipelines |
| [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) | |

## About version 1.0

1.0.0 means the engine, the Claude Code mod, the terminal app and the installers are complete, documented and covered by tests
(on Windows, macOS and Linux in CI). It does **not** mean everything was verified everywhere: the Claude Code mod has only been
run by hand on Windows, and the Codex support works within what the Codex hooks report. [docs/STATUS.md](docs/STATUS.md) lists
exactly what was and was not checked.

## Contributing

Bug reports, ideas and new characters are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). A character is pixel art plus a few lines
of description; the engine gives it every expression and animation (see Architecture, "Adding a character").

## License

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). CodePuff is independent and not affiliated with Anthropic or
OpenAI. Alpha is drawn in code, "Claude" is an unofficial fan design, and the six other characters are pixel-art conversions of
images the project owner created with an AI image generator (see [NOTICE](NOTICE)).

<div align="center">

Made with 🫧 by [Luiz Bizzio](https://github.com/luizbizzio)

</div>
