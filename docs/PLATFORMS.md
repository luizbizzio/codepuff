# Platforms: what each agent exposes

Research done for this build (Claude Code 2.1.330; Codex CLI 0.171.0-alpha.13 / Codex desktop 26.1117; Codex
documentation as of November 2026). The two platforms are **not** equivalent, and CodePuff does not pretend they are.

## Claude Code: the Mods API

An early-access API: a plugin whose `hooks/hooks.json` names a module exporting `register(on)`. It runs in the host's
own module environment (no DOM, no Node) and reaches everything through `$`.

| Need | What exists | Used |
| --- | --- | --- |
| Session identity | `$.session.id()`, and `session_id` in every hook payload. | yes |
| User prompts | `classic.UserPromptSubmit` (real prompts; `prompt.submit` also exists but includes slash commands and meta prompts). | `classic.UserPromptSubmit` |
| Tool activity | `classic.PreToolUse`, `classic.PostToolUse`, `classic.PostToolUseFailure` (with `tool_response`, `error`, `is_interrupt`, `duration_ms`), and the mod-native `tool.call`. | classic events |
| Tests, errors, commits | Not provided. Derived: the command text is classified in memory; success vs failure is split by the host; commits via `$.process.run` + `git show`. | yes |
| Permission waits | `classic.PermissionRequest`, `classic.PermissionDenied`. | yes |
| Subagents | `classic.SubagentStart` / `SubagentStop`; `agent_id` marks events from inside a subagent. | yes |
| Turns | `turn.start`, `turn.complete` (answer / aborted / error / refusal), `classic.Stop`, `classic.StopFailure`. | yes |
| Persistent UI | `$.ui.open` panes (docked, inline, and a small `widget` form on the desktop app), `AbovePrompt` bands, `$.ui.status`, toasts. | the compact `AbovePrompt` band, a pane, an optional status line |
| Graphics | `Svg` (desktop, VS Code, mobile; CSS and SMIL animation work), `Raster` (terminal cell grid, repainted without a redraw by `$.ui.blit`), `Image` (terminal, kitty/iTerm2). | `Svg` and `Raster` |
| Storage | `$.store` (per plugin, 4 MiB), `$.fs` (read, write, list, stat: **no append, rename, lock or delete**), `$.state` (session). | `$.fs` in a shared folder |
| Commands | `$.command.register` + `command.run`. | `/codepuff` |

Constraints worth knowing: a hooks module may not assign or pass `$` around (every call is spelled `$.noun.method`
at its call site), `on()` event names must be literals, and `claude plugin validate` enforces both. The API is
early access and moves between releases; the declaration file the engine writes is the authority.

## OpenAI Codex

| Need | What exists | Used |
| --- | --- | --- |
| Hooks | 14 command-hook events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, `Stop`, `PreModelRequest`, `PostModelRequest`, `Interrupt`, `SessionEnd`. Payloads are JSON on stdin (`session_id`, `turn_id`, `cwd`, `tool_name`, `tool_use_id`, `tool_input`, `tool_response`, ...). | 12 of them |
| Where hooks go | `~/.codex/hooks.json`, `.codex/hooks.json` in trusted projects, `[hooks]` in `config.toml`, or a plugin's `hooks/hooks.json` (or the path its manifest names). | user `hooks.json`; plugin bundle |
| Trust | Non-managed hooks do **not** run until the user reviews and trusts them (`/hooks` in the CLI; *Review hooks* / *Settings → Hooks* in the app). Changing a hook changes its hash. | CodePuff never edits trust |
| Blocking | Sync hooks block the step they hook; `"async": true` hooks run in the background (up to 8 per session) and cannot affect the agent. `SessionEnd` is always sync. | async where possible |
| Tool coverage | `Bash`, unified exec, `apply_patch` (also matched as `Edit` / `Write`), MCP tools, other local function tools. **Not** hosted tools such as web search. `PreToolUse`/`PostToolUse` are "a useful guardrail, not a complete enforcement boundary". | |
| Plugin UI | None in the CLI, desktop app or IDE extension. Plugin UI is MCP Apps (an iframe) in **ChatGPT**; the IDE extension has no plugins. | not possible |
| Pets | Codex has built-in animated pets (floating overlay in the desktop app; a terminal pet in iTerm2 / kitty / Sixel terminals). The docs describe no plugin or hook API for them. | not touched |
| Environment | Plugin hooks get `PLUGIN_ROOT` / `PLUGIN_DATA` (and `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA`) as environment variables. | read in the plugin command |

Consequences for CodePuff on Codex: it can *observe* everything it needs, but it cannot draw inside Codex. It
provides the terminal app (`codepuff pet`: pet, statistics, customization and data, drawn with ANSI half-block
characters, works in any truecolor terminal). It deliberately starts no web server. Hosted tools (web search) produce no hook events, so the pet
does not react to them in Codex. The shell exit code is not documented for `tool_response`, so CodePuff reads several
shapes and reports *unknown* when it cannot find one.

## What only Claude Code can do

* Draw the pet *inside* the host (pane / widget / status line), with press and input handling.
* Split success from failure itself (separate hooks), so `Succeeded / failed` is exact there.
* Raise `turn.start` / `turn.complete`, and tell an interrupted turn from a finished one without a hook for it.

## What only Codex adds

* `PreModelRequest` / `PostModelRequest`: a precise "model request in flight" signal, and real model failures (CodePuff
  shows a failed request, for example an exhausted usage limit, as a failure and counts it).
* `Interrupt` and `SessionEnd` events (the latter after 30 minutes idle or on close).
* `PermissionRequest` with the tool and command that needs approval (CodePuff reads only that a wait began).

## Windows first, portable by design

Paths are handled with forward slashes and `path` joins; the data folder is `~/.codepuff` everywhere; locks are
directories (create-or-fail works on every file system); the hook command uses `node` from `PATH` and works through
`cmd.exe`, PowerShell and POSIX shells (tested through cmd.exe and PowerShell here). macOS and Linux are covered by the
CI matrix in `.github/workflows/ci.yml` but were **not run** on this machine.
