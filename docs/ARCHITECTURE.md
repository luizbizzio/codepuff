# Architecture

CodePuff is one shared engine with thin per-host adapters. The engine is plain JavaScript (ES modules, no build
step, no dependencies) and the part that must run inside Claude Code's module sandbox (`src/core`, `src/claude`) uses
no Node APIs at all.

```text
             Claude Code                                  OpenAI Codex
   hooks/register.tsx  (the mod)                  command hooks  -> bin/codepuff.js hook codex
        |  classic.* + turn.* events                    |  JSON payload on stdin
        v                                               v
   src/claude/controller.js                       src/node/hook.js
        |                                               |
        +---------------> src/core/normalize.js <-------+      host payload -> content-free event
                                  |
                          src/core/session.js                  the ONE function that changes a record
                                  |
                  one JSON record per (agent, session)         src/node/store.js (Node)  /  $.fs (mod)
                                  |
        +-------------------------+--------------------------+
        |                         |                          |
 src/core/aggregate.js     src/core/petstate.js       src/core/render/*  +  src/core/art/*
 (statistics, streaks)     (state + priority rule)    (SVG, terminal cells, ANSI)
        |                         |                          |
   CLI / terminal app / Claude pane and band  <---------------+
```

## Layers

| Path | Role | Node-free |
| --- | --- | --- |
| `src/core/classify.js` | What a tool call *is* (category, activity, test, commit) and what a finished command *did* (exit code). | yes |
| `src/core/normalize.js` | Host payload to a small event. Both hosts use Claude-style payloads, so one function serves both; host differences live in one switch. | yes |
| `src/core/session.js` | The reducer: `reduce(record, event)`. | yes |
| `src/core/records.js`, `backup.js`, `settings.js` | Validation, migration, the backup format, the pet document. | yes |
| `src/core/aggregate.js`, `days.js`, `format.js` | Statistics over records, local-calendar helpers, display rows. | yes |
| `src/core/petstate.js` | `stateOf(record, now)` and `focus(records, now)`. | yes |
| `src/core/art/*`, `render/raster.js` | The hi-res pixel canvas (72x56), shaded shapes, the eight characters, faces, props, the 3D extrusion, animation loops; SVG / terminal cells / ANSI output. | yes |
| `src/claude/controller.js` | Everything the Claude mod does behind an `io` interface (so it is testable without Claude Code). | yes |
| `hooks/register.tsx` | The mod: binds the host's `$` to the controller and draws the pane. | (host) |
| `src/node/*` | Store with locks and atomic writes, git, the hook process, CLI, the terminal app, installer, doctor. There is no web server. | no |

## Events to animation

1. The host reports something real (a prompt was submitted, a tool started or finished, a permission is needed, a
   turn ended, a subagent started).
2. `normalize` turns it into an event holding only a category, an activity, an outcome, opaque ids and the project
   folder name. Prompt text, commands, paths and outputs are read in memory to classify and are never kept.
3. `reduce` updates the session record: per-day counters (the statistics) and a small `live` block (what is in flight,
   when the last failure or success happened, how many subagents run).
4. `stateOf(record, now)` derives the pet's state from `live` and the current time. Time-limited states (a celebration
   lasts 4 s, a failure 6 s, "finished" 5 s) end by themselves; the renderer is asked to look again at that moment.
5. The state selects an animation loop (data: poses and durations). SVG output turns it into CSS keyframes so the
   host animates it with no scripts; terminals step frames only when the next frame is due.

Nothing is invented: there is no timer that makes the pet "busy", and `thinking` only means a turn is running with
no tool call in flight. Reactions that depend on observing something unobservable do not exist.

### The priority rule

Inside a session: permission wait, then a failure (6 s), then a confirmed success (4 s), then "finished" (5 s), then
the tool in flight, then a running turn, then waiting for the next prompt (2 min), then rest. A newer tool call
overrides an older failure or success. Across sessions: permission > failure > live work > success > finished >
waiting > idle; ties go to the session heard from most recently, then the agent name, then the session id. The
result is a pure function of the records and the clock, so it is deterministic and tested.

## Data and concurrency

```text
~/.codepuff/
  pet.json                      identity, name, character, colors, prefs (version 1)
  sessions/claude/<id>.json     one record per session (version 1)
  sessions/codex/<id>.json
  locks/  exports/  errors.log
```

* **Statistics are never stored as shared counters.** A record is the unit of storage, owned by whoever observes that
  session. Lifetime numbers are *sums over records* (and "last 7 days" is a sum over per-day buckets inside each
  record). Nothing global can be corrupted or double counted.
* **Claude Code**: the mod is the only writer of its session's file (it can only read, list and overwrite files; it
  cannot append, rename, lock or delete), so no coordination is needed. Writes are debounced and flushed at turn end.
* **Codex**: each hook is a separate process, and some run in parallel. `applyEvent` takes a per-session directory
  lock (waits up to 5 s; stale locks are broken after 15 s), reads, reduces and replaces the file atomically (temp file + rename).
  Tested with six concurrent processes writing 240 events to one session: no update lost.
* A completed tool call carries the host's `tool_use_id`; a completion delivered twice is counted once. A tool end
  arriving before its start (parallel hooks) never leaves a tool "running" forever.
* A resumed session keeps its record (same host session id). Commits are keyed by hash across all sessions.
* Reads never lock: every file is replaced atomically. Readers cache by modification time, so listing 500 sessions
  parses only the files that changed.
* **Corruption**: a record or pet file that does not parse is moved aside as `*.corrupt-<time>`; a record with bad
  fields is repaired field by field (`records.js`); nothing a file contains is executed or trusted. Imports go
  through the same validation.
* **Versions**: both documents carry `v`. Unknown newer versions are read for the fields understood; migrations
  live in `migrateRecord` and `migratePet`.

### What is stored

Counters per local day (prompts, turns, tool calls by category, succeeded/failed/unknown, tests, files, commits,
subagents, permission requests, model failures, agent time), a bounded list of commits (hash, line counts), the
project's folder name and an opaque project id, hashed file ids (only to count *distinct* files), the last 48 tool
call ids (to ignore duplicates), and the small `live` block. Never: prompts, code, commands, paths, tool outputs, error
text.

## Statistics, precisely

* **Prompt**: one `UserPromptSubmit`. Subagent prompts are excluded (the host marks them with an agent id).
* **Turn completed**: one `Stop` of the main agent. Interrupted or failed turns are counted separately.
* **Tool call**: one completed call. Category from the tool's name; a shell command is also classified by what it runs.
* **Succeeded / failed / unknown**: Claude Code splits success and failure itself. For Codex a shell command's exit
  code is read from the result; if none can be read the call is *unknown*. Other Codex tools count as completed unless
  the result says it failed. `grep`/`diff`-style exit code 1 means "no match", not a failure. A call the user
  interrupted or refused is *unknown*, never a failure.
* **Tests**: recognized runners (npm/pnpm/yarn/bun test, jest, vitest, mocha, pytest, unittest, go, cargo, dotnet, mvn,
  gradle, deno, make test, rspec, phpunit and more). *Passed* needs a readable exit code of 0 and no pipeline hiding it.
* **Commits**: after a successful `git commit` command, HEAD is read once with `git show --numstat`, and counted only if
  it is a fresh commit (made within 10 minutes); the hash is stored so no session counts it twice. Commits that cannot
  be read are shown as "not verifiable", never as numbers. Lines are the committed diff only: not working-tree
  changes, not "generated" lines, and not every commit in the repository.
* **Files changed**: distinct files per session and day, from edit tools only.
* **Streaks** use the local calendar date at the time of each prompt (`days.js`; the date is computed from the offset
  *at that instant*, so DST never shifts a day) and are computed from stored data, so they survive restarts.

## Adding a character

1. Describe it in `src/core/art/chars.js` with `define({ id, pivot, ground, hand, shapes, details, face, anchors })`: a
   list of shaded shapes (`ell`, `rrect`, `poly`, each with a five-tone ramp such as `BODY` or `ACC`), a few
   hand-placed details, a face (eye set, eye and mouth positions, cheeks) and the anchors that props are placed
   against. All coordinates are on the 36x28 *design grid*; the scene draws them at twice that resolution. A character
   can also write its own `draw` (see `claude.js`).
2. Add its name, description and default colors to `defaults.js`, register it in `registry.js`, and it is part of
   `CHARACTERS` (derived from `defaults.js`; a test checks that the registry, the settings and the palettes agree).

Because drawings use *roles* and not colors, recoloring, the pixel and 3D styles, the SVG and terminal renderers,
every animation state, props and helpers work immediately.

### Pixel and 3D

The 3D style is not a second drawing. The same frame is drawn flat and then extruded (`solid.js`): every solid pixel is
copied back and to the right, lit on top surfaces and shaded on right-hand sides (the palette derives a top and a side
tone for every role). Eyes, mouths and effects stay flat on the front, and one-pixel features (antennas, thin arms) are
not extruded, so they never turn into streaks.

### Resolution

The scene is 72x56 pixels (`K = 2` times the 36x28 design grid). Bodies are shaded shapes lit from the upper left, so
the shading follows the form; faces are drawn from ellipses and arcs (two shines per eye, cheeks, brows, mouths);
props and badges (`props.js`) are built the same way. In a terminal the picture is averaged down to fit the pane
(`fitFactor`), so a narrow pane shows a smaller pet and a wide one shows every pixel.
