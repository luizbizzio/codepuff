# Status of CodePuff 1.0.0

Version 1.0.0 means the engine, the Claude Code mod, the terminal app and the installers are complete, documented and tested.
It does **not** mean everything was verified everywhere: this page says exactly what was checked, where, and what was not.
No GitHub release or tag has been created.

## Verified

| Area | How | Result |
| --- | --- | --- |
| Engine, statistics, pet states, storage, CLI, installer | `npm test`: 198 tests, no dependencies (the mod has 7 more, run by `claude plugin test`) | pass |
| Eight characters, hi-res pixel art | Tests render every character through 10 states with all subagent helpers, check detail (tones, pixel counts), faces, recoloring, SVG size under the host's limit, narrow-terminal fitting; and contact sheets were looked at | pass |
| Robustness | `npm run fuzz` (scripts/fuzz.mjs): 30,000 random hook payloads, 30,000 random prompts through the insult judge (plus a corpus of 54 realistic prompts, checked by hand), 20,000 random saved files, a 20,000-step stream of events, commands and settings through the controller, and 3,000 odd picture requests; and all 632 pictures the pet can draw parsed as strict XML in Chrome (scripts are in the scratch notes, not the repository) | no failures after the fixes |
| Concurrent writers | 6 OS processes x 40 events on one session; 4 processes across sessions and agents | no lost update, no temp files left |
| Date logic | fixed-offset zones, a simulated DST change, midnight crossing, leap day, streak survival after reload | pass |
| Corruption and migration | damaged session / pet files, hand-edited and future-version records, hostile backups, path-like ids; a version-1 pet (the single "puff") migrates to Puff Alpha keeping its identity | quarantined, repaired or migrated |
| Privacy | prompts, commands, tokens, file paths and errors never reach a record or the error log (tested with sentinel strings) | pass |
| **Claude Code (static)** | `claude plugin validate .` on Claude Code 2.1.330 | pass |
| **Claude Code (engine)** | `claude plugin test .` on 2.1.330: the mod raises the host's real `classic.*` events, persists through a fake host file system, mounts the pane **and the compact band above the prompt** on the terminal and desktop surfaces, presses tabs/buttons, submits the name field | 4 of 4 pass |
| **Claude Code (live session)** | An earlier build of the mod, copied into this desktop session's dev-mods folder, was loaded by the host (2.1.330) and wrote `pet.json` and this session's record in `~/.codepuff` (session id, project, a prompt, a running turn, a tool in flight, the **local** calendar day) | live hook events, `$.env`, `$.fs`, `$.session.id()` and the sandbox's time zone work |
| **Claude Code (marketplace install)** | In a throwaway config folder (`CLAUDE_CONFIG_DIR`, so the owner's own setup was not touched): `claude plugin marketplace add luizbizzio/codepuff`, then `claude plugin install codepuff@codepuff` from the public repository; then `claude plugin validate` and `claude plugin test` on the **installed copy** | installed (user scope, enabled); every file is there (hooks, views, sounds, sprites, icon); validation passes; the mod tests pass on the installed copy |
| **Codex (marketplace install)** | In a throwaway `CODEX_HOME`: `codex plugin marketplace add luizbizzio/codepuff`, then `codex plugin add codepuff@codepuff`; then the installed plugin's own hook command (from its `codex/hooks.json`) run the way Codex runs it, with `PLUGIN_ROOT` set | installed and enabled; the hook command answers `{}` and writes the record |
| **Codex (real host)** | `node scripts/live-codex.mjs` against the real Codex (CLI 0.171.0-alpha.13.2, the desktop app's own binary), three runs, ephemeral, temp project, hooks injected for the run only; one run asked for `apply_patch` and a shell command, the others for two shell commands | the host delivered `SessionStart`, `UserPromptSubmit`, `PreModelRequest`, `PostModelRequest`, `PreToolUse` (with `tool_name: "Bash"`, `tool_input.command`, `tool_use_id`), `Stop`, `SessionEnd`; CodePuff recorded the prompt, the turn and the tool calls. **It never delivered `PostToolUse`**, for a shell command or for `apply_patch` (see below) |
| Codex model failure | In an earlier run the model request failed (the account's usage limit): the pet shows *The model request failed*; the error text is not stored | pass |
| Codex plugin hook command | The exact command in `codex/hooks.json` run through `cmd.exe`, PowerShell and a POSIX shell with only `PLUGIN_ROOT` set; also with a missing folder (answers `{}`, exit 0) | pass |
| Codex installer | Merge/uninstall against temp `hooks.json` files: keeps the user's hooks, backs up, idempotent, refuses invalid JSON, uninstall restores the original | pass |
| Terminal app | The rewritten app (four views, hi-res pet shrunk to the pane) was started in a real terminal (Windows PowerShell, the app's Terminal panel) and drew the Puff Mage with its label, numbers and key help. The earlier version reacted live to real hook payloads (*No agent connected*, *Working on a response*, *Running tests*) | renders; live reaction seen on the earlier version |
| Overhead | `scripts/bench.mjs` | see [PERFORMANCE.md](PERFORMANCE.md) |

## Not verified

* **Toasts and tooltips in the live window.** The sounds were confirmed audible by the owner on the Windows desktop app (played through PowerShell's `System.Media.SoundPlayer`). The toasts and the SVG `<title>` tooltips (on the pet, the ring, the hearts in the pane, the chart bars) have not been confirmed. The plan-reset sounds read the limits from `$.session.usage()` (a window that reset shows a later reset time or a much lower share used); they are tested with made-up readings, not with a real reset.
* **How the mod looks in a live Claude Code window.** The owner ran builds of the mod in the Claude Code desktop app through the
  dev-mods folder and sent screenshots of the compact band (pet, status block, ring, hearts) and of the Statistics page, and
  fixed what they showed; every later change to these was checked by tests and in Chrome, not seen again in the window. What
  nobody has confirmed in the window: the hover hop, the tooltips and the toasts. A live session with the mod **installed from the
  marketplace** (as opposed to the dev-mods copy) has not been run: the install was checked in a throwaway config (Verified, above).
* **Keyboard use of the terminal app** (Customize arrows, name entry, import, confirmations): the key handling was not driven by a real
  keyboard in this build's checks; only its first screen and the Statistics view were read.
* **Codex tool completions.** In the real Codex checked (0.171.0-alpha.13.2), `PreToolUse` arrives for every tool call but `PostToolUse` never does, so
  CodePuff cannot know how a Codex tool call ended. It counts each call when the turn ends, with an *unknown* outcome (so tool calls, and the
  categories, are right; succeeded/failed, test results and commits are not available for Codex, and the pet shows the tool while it runs but
  has no success or failure to celebrate). If a later Codex sends `PostToolUse`, the real outcome is used and nothing is counted twice
  (tested). `PermissionRequest` and subagent events were not triggered in these runs.
* `codepuff install claude` through the `claude` CLI.
* macOS and Linux run only in CI (the test suite on Node 20 and 22, passing on all three systems); the mod itself was only ever run on Windows 11 (Node 26 locally). Nobody has run the mod or the sounds on macOS or Linux.
* Terminals without truecolor or half-block characters, and a screen reader.
* The six sprite characters are the reference sheets' artwork shrunk to pixel art and checked by eye on close-ups and
  contact sheets (several states); the faces are redrawn by the engine (so every expression exists), so
  they are simpler than the sheets' own faces, and the sprites have no separate hands. Alpha and Claude are drawn in
  code. The hover hop is plain CSS in an interactive `Svg`; it was checked in Chrome only, not in the Claude Code window.

## Known limitations

* **Plan usage (the tired state)** reads `$.session.usage()`; it is covered by controller tests with made-up figures, and has not been seen with a real account's figures. Off a subscription the host reports no limits and the pet is never tired.

* **Claude Code's Mods API is early access** and moves between releases; the mod is pinned to what 2.1.330 declares.
* **The Claude mod cannot append, rename, lock or delete files** (it only reads, lists and overwrites), so "reset
  statistics" empties files instead of deleting them, and other sessions' files are read only. Codex hook processes
  use locks and atomic renames.
* **Codex cannot show a native pet or a band from a plugin.** CodePuff offers the terminal app, not an embedded pet.
* **A terminal band is text only.** The compact band above the prompt draws the mini pet as a picture on the desktop
  app and as a small text face (`^_^`, `o_o`, `>_<`) in a terminal, where an image would not fit one row.
* **Hosted Codex tools** (web search) produce no hook events, so the pet does not react to them.
* **The per-session lock is best effort under extreme load.** If a hook cannot get the lock within 5 s it applies its
  event anyway (every write is atomic, so a file is never torn; the worst case is one overwritten update). During this
  build one concurrency test failed once with the machine saturated by the parallel test suite, at the old 1.5 s wait;
  the wait is now 5 s and the suite passed three full runs in a row afterwards.
* **Resumed sessions** keep one record only if the host keeps the same session id on resume (the Claude Code
  `--resume` behaviour was not observed live); otherwise a resumed chat counts as a new session.
* **Estimated agent time** is the time a turn was running with gaps over 10 minutes dropped; it is an estimate.
* **Another process's activity appears in the Claude pane** only when it is next redrawn (an event of this session, a
  click, or the 10-second refresh while the pane is visible); the terminal app polls every second.
* Test and commit detection reads the command line, so a test run hidden behind a script (`./ci.sh`) or `make` target
  with another name is not recognized.
* The hook starts a Node process per Codex event (about 35 to 60 ms of CPU beyond Node's own start-up). It is async, so
  Codex does not wait for it.

## What to improve after the MVP

1. Look at the live band and pane in the desktop app and a terminal, in both styles; tune sizes and layout.
2. Observe a live Codex tool run; adjust any payload shape that differs.
3. Hand-polish the art further against the sheets: more fur, curls, fins, props at the same detail as the characters
   (the globe and clipboard are still on the coarser 36x28 grid), and idle variations per character.
4. Bundle the hook into one file to cut its start-up, and offer an optional long-lived local daemon.
5. Record a compact rollup for sessions older than a year so a lifetime of data stays a few hundred KB.
6. A Claude Code `classic` command-hook fallback for hosts without the Mods API (the Node hook already understands the payloads).
7. Verified macOS and Linux CI; an accessibility audit; a static HTML report exported to a file (no server) for sharing statistics.
8. Publish to npm and the Claude Code and Codex marketplaces once the checks above are complete (no release has been made).

