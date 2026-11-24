# CodePuff

[![CI](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml/badge.svg)](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**A coding pet for Claude Code and OpenAI Codex.** It reacts to what your agent is *really* doing: it reads when the agent
reads, types when it edits, watches a little experiment while tests run, celebrates only after a check really passed, and
winces when something really failed. It keeps your statistics across sessions and both agents in **one local history**.

![The eight characters: idle, coding, success and error](docs/images/characters.png)

> **Preview `0.1.0`.** It works in the Claude Code desktop app on Windows and passes its tests on Windows, macOS and Linux;
> Codex support is experimental. What was verified where, and what was not, is listed honestly in [docs/STATUS.md](docs/STATUS.md).

## What you get

- **Eight characters** in hi-res pixel art (Alpha, Classic, Foxy, Bot, Slime, Mage, Penny, Claude), each with its own way of
  idling, waiting and reacting, and any of them in any palette.
- **A compact band above the prompt** in Claude Code: the pet, what it is doing, your streak, how your plan's limits are going,
  and how this session's tasks went.
- **A pane** with statistics (a platform, a period, tiles, a chart) and customization; **a terminal app** (`codepuff pet`) for
  Codex users.
- **Hearts**: the pet likes you more when you are kind to the assistant and less when you are abusive; it gets tired as your
  plan's limit runs out; it plays a sound when Claude asks you something, finishes, or your limits reset.
- **Statistics** that are counted, never guessed: prompts, tool calls, files, tests, commits, agent time.

More in [docs/FEATURES.md](docs/FEATURES.md).

## Install

Nothing to build, nothing to configure. Pick the agent you use (or both: they share one pet).

### Claude Code

Type these two lines in Claude Code:

```text
/plugin marketplace add luizbizzio/codepuff
/plugin install codepuff@codepuff
```

(In the desktop app: **+** next to the prompt → **Plugins** → **Add marketplace**.) Then start a new session. The pet appears above the
prompt, and `/codepuff` opens its pane.

### Codex

Run these two lines in a terminal:

```text
codex plugin marketplace add luizbizzio/codepuff
codex plugin add codepuff@codepuff
```

Then let Codex trust the hooks (it never runs new hooks without asking): in the CLI type `/hooks`; in the desktop app use *Review hooks*.

Codex cannot draw a pet inside itself, so to watch yours open the terminal app next to Codex (needs [Node.js](https://nodejs.org) 20 or newer;
it runs straight from GitHub, nothing is installed or built):

```text
npx github:luizbizzio/codepuff pet
```

### Check that it works

```text
npx github:luizbizzio/codepuff doctor
```

It says whether CodePuff is installed in Claude Code and in Codex, and what to do if not. More ways to install (from a clone, for developers),
updating, and troubleshooting: [docs/INSTALL.md](docs/INSTALL.md).

### First run

It works with no setup. You start with **Classic**, calm motion, the large compact band, the status line, quiet sounds (low volume), and hearts on. Change anything
in the pane (`/codepuff`, then **Customize**). **Claude Code and Codex share one pet and one set of settings** (one small file in `~/.codepuff`),
so what you change in one shows up in the other: [defaults and what is shared](docs/FEATURES.md#settings-the-defaults-and-what-is-shared).

### Uninstall

```text
/plugin uninstall codepuff@codepuff          (Claude Code)
codex plugin remove codepuff                 (Codex)
```

Uninstalling never deletes your statistics; `npx github:luizbizzio/codepuff data delete --yes` does, separately.

## Privacy

Everything stays on your computer, in one folder (`~/.codepuff`). No account, no server, no model calls, no telemetry. Only
counters are stored: never your prompts, code, commands, file paths or tool output. The one place a prompt is read is the
hearts: its text is looked at in memory to tell abuse from kindness, then dropped, and only a number is kept. You can turn that
off (*Hearts react to my messages* in Customize, or `/codepuff mood off`).

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

## License

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). CodePuff is independent and not affiliated with Anthropic or
OpenAI. Alpha is drawn in code, "Claude" is an unofficial fan design, and the six other characters are pixel-art conversions of
images the project owner created with an AI image generator (see [NOTICE](NOTICE)).
