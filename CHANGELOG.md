# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [0.1.0] - preview, not released

The first public preview. No release or tag has been created yet.

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
- One local history for both agents (`~/.codepuff`), with export, import and reset; counters only.

### Known
- Codex 0.171 does not report when a tool finishes, so Codex tool calls are counted with an unknown outcome.
- See [docs/STATUS.md](docs/STATUS.md) for everything that was and was not verified.
