# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [1.1.0]

Achievements, rewards and a pet with more to do. [docs/STATUS.md](docs/STATUS.md) says what was verified and what was not.

### Added
- **Achievements.** A tab of its own with eleven cards, one for each thing that is counted (tasks, days in a row, prompts, passing test runs, commits, files changed, lines added in commits, active days, hours of work, helpers called, projects). Each is a pixel-art medal that levels up (bronze, silver, gold, diamond) with a progress bar, and **every one of the 33 levels unlocks something**: 17 accessories, 9 color palettes (the rest of the colors are free) or 7 band frames. What a pet had reached before is unlocked quietly, without a pile of messages.
- **Accessories** (flower, bow, glasses, cap, party hat, top hat, sunglasses, crown, halo, beret, chef hat, monocle, bunny ears, pirate hat, cowboy hat, Viking helmet, graduation cap), worn on every character in every state, placed on the dome of each head and on its eyes. `/codepuff accessory`, `codepuff set accessory`.
- **Band Frame.** The chosen frame (rainbow, pixel, neon, gold, ocean, sunset, aurora) goes around the compact band and the pet card. `/codepuff frame`, `codepuff set frame`.
- **Pet card.** An animated SVG with the pet, its name, how long you have been together, the streak, the hearts and a few totals (no project names, paths or prompts): the 📸 button at the right of the tabs, `/codepuff card`, `codepuff card`.
- **New states.** Bored, a coffee break and a nap when nothing happens for a while; greetings for the time of day (morning, afternoon, evening, late night) when a session starts or you come back after hours; a stretch.
- **Break reminder** (off by default), adjustable: from 15 minutes to 8 hours, and how long a pause counts as a break. `/codepuff breaks`, `/codepuff breakrest`.
- **Plan limits and the session cost.** The 5-hour and weekly limits as a thin strip under the band (always both by default; `/codepuff plan`), with the time to reset ("6d 9h" from a day on); the session's estimated cost (the host's own `/cost`, never shown as zero or as the bill) in the band and in the statistics.
- **A status line that says something**: the pet and what it is doing, then the context used, the 5-hour and weekly limits and the cost.
- **Mood in 14 languages.** Insults aimed at the assistant, harsh criticism of the work and thanks are now read in every language the pet speaks (not only English and Portuguese), with more ways to say thanks and a thanks that is negated ("not perfect") not counted. [docs/MOOD-REVIEW.md](docs/MOOD-REVIEW.md) lists every word for native speakers to check.
- A **Settings** tab (what the plugin does) apart from **Customize** (how the pet looks); the four tabs are one emoji each, and each page is titled with its name. A *Subagents* tile in the statistics.
- The terminal app and the command line follow: what the pet wears, the frame and the locked palettes (`codepuff set accessory|frame|palette`, `codepuff card`).

### Changed
- The statistics tiles are two to a row, all the same size, with the pet's line at the top.
- The compact band keeps one layout at every size and scales the text, the air and the hearts down together, so the small and medium sizes are really shorter.
- Picking an accessory no longer takes a fraction of a second to measure the band (the box of a pet that wears something is the box without it, grown).
- Six of the older color palettes (sunset, lemon, ocean, berry, ember, graphite) are now earned with achievements; original, sky, marshmallow, mint and lavender are free. A custom color is always free.

### Fixed
- The compact band could not be made shorter than the text beside the pet.
- The frame on the band no longer moves the picture (the band fills the width with or without it).

## [1.0.0]

The first stable version: everything from the 0.1.0 preview, plus the changes below. [docs/STATUS.md](docs/STATUS.md) says exactly what was verified where.

### Added
- **Languages.** Everything CodePuff says is translated into 14 languages (English, Portuguese (Brazil), Spanish, French, German, Italian, Dutch, Polish, Turkish, Russian, Japanese, Korean, Simplified and Traditional Chinese) and the language of the computer is picked automatically. Change it in Customize, with `/codepuff language <code>` or `codepuff set language <code>`; it is saved with the pet and shared by Claude Code and Codex. Numbers, dates, durations and plural forms follow each language, and the terminal app counts text in terminal cells so Japanese, Korean and Chinese line up.

- `codepuff setup`: one command (`npx github:luizbizzio/codepuff setup`) that installs the plugin in Claude Code and in Codex, whichever are found, through their own command lines; idempotent, with `--only` and `--dry-run`.
- README rewritten as the GitHub front page, with a banner and real screenshots (`scripts/branding.mjs` builds the banner).

### Changed
- First-run defaults: Classic, large compact band, status line on, quiet sounds (pop, tada, chime, chime) at low volume, calm motion.
- The long waits no longer repeat one short loop: `thinking` is a ten-second loop (ideas up-right and up-left, a blink, a look down, an "aha") with a quirk of its own for each character, and the work states (typing, running, searching, testing, git, MCP, web, delegating, planning) play three rounds with a blink, a glance and a pleased smile.

### Fixed
- Penny's right eye lost its shine on her dark curls in the thinking face; focus eyes always keep one pixel of shine, and her gaze no longer turns onto the curls.
- `codepuff stats | head` no longer crashes with EPIPE; the hook ignores a closed pipe; `stats` refuses an unknown scope or agent; `doctor` and `install claude` no longer trigger Node's shell deprecation warning on Windows.
- A regular expression for `npx` flags that could backtrack exponentially (CodeQL js/redos).
- In Claude Code, a tool call still running always showed the generic "running" pet: its `PreToolUse` event arrives as a tool-call envelope (`tool`, not `tool_name`), so the tool was read as unknown. Reading, searching, editing, testing, git, web, delegating, planning and MCP now show while the call is in flight, not only as the last action afterwards.

## [0.1.0] - preview, not released

The first public preview.

### Added
- Eight pixel-art characters (Alpha, Classic, Foxy, Bot, Slime, Mage, Penny, Claude), any of them in any palette, each with its own
  way of idling and waiting, a part that moves on its own (a tail, an antenna, a star, a fin, a curl) for five of them, and a
  floating `404` for Foxy's errors.
- Twenty pet states driven by real events (reading, searching, coding, running, git, MCP, testing, web, delegating, planning,
  thinking, success, error, investigating, waiting, permission, finished, tired, sad, disconnected) and one-shot reactions
  (petted, giggle, delighted, hurt).
- Claude Code mod: a compact band above the prompt (pet, status block, streak, prompts, hearts, plan bars, task ring), a
  pane with statistics and customization, `/codepuff`, an optional status line, sounds (question, finish, 5-hour and weekly
  reset), toasts for milestones, three motion levels, three band sizes.
- Statistics by platform (Claude Code, Codex, Combined) and period (this session, 7 days, 30 days, all time), as tiles, a chart and
  bars, with every number one button away.
- Hearts: the pet's affection for the user, shared by both agents and kept between sessions; it can be turned off.
- Codex support: command hooks, an installer, and a keyboard-driven terminal app (`codepuff pet`).
- `codepuff doctor` recognizes the Codex plugin, Codex hooks and the Claude Code plugin, and `install codex` refuses an npx cache copy and a second install next to the plugin (events would be counted twice).
- One local history for both agents (`~/.codepuff`), with export, import and reset; counters only.

### Known
- Codex 0.171 does not report when a tool finishes, so Codex tool calls are counted with an unknown outcome.
- See [docs/STATUS.md](docs/STATUS.md) for everything that was and was not verified.
