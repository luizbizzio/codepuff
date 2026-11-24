# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
