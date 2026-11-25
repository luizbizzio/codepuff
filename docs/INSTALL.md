# Install

The short version is in the [README](../README.md). This page has the other ways, and what to do when something does not work.

## The easiest way

```text
npx github:luizbizzio/codepuff setup
```

Installs CodePuff in Claude Code and in Codex, whichever it finds, by running their own plugin commands (the ones in the table below). Options: `--only claude` or `--only codex`, and `--dry-run` to see what it would run. What is already installed is left alone, and it never adds the plugin next to Codex hooks (events would be counted twice). It installs from the GitHub marketplace, never from a local folder.

## The usual way

| | Claude Code | Codex |
| --- | --- | --- |
| Install | `/plugin marketplace add luizbizzio/codepuff` then `/plugin install codepuff@codepuff` | `codex plugin marketplace add luizbizzio/codepuff` then `codex plugin add codepuff@codepuff` |
| Then | start a new session | trust the hooks: *Review hooks* in the desktop app (click **Trust all**) or `/hooks` in the CLI |
| See the pet | above the prompt, and `/codepuff` | `npx github:luizbizzio/codepuff pet` in a split or a second tab (Node.js 20+) |
| Update | `/plugin marketplace update codepuff`, then update the plugin | `codex plugin marketplace upgrade codepuff` |
| Remove | `/plugin uninstall codepuff@codepuff` | `codex plugin remove codepuff` |

Install CodePuff in Codex **one way only**. If it is installed as a plugin and also as hooks in `hooks.json`, every event would be counted twice;
`codepuff install codex` refuses to add the hooks next to the plugin, and `codepuff doctor` warns if both are there.

## Check it

```text
npx github:luizbizzio/codepuff doctor
```

It reads, and changes nothing: whether Node is new enough, where your data is, the pet, the statistics, whether git is found, whether CodePuff is
installed in Codex (as a plugin or as hooks) and in Claude Code, and the last hook errors, if any.

## From a clone (for developers, or if you prefer hooks to a plugin)

Nothing is built: the repository is the program.

```text
git clone https://github.com/luizbizzio/codepuff
node codepuff/bin/codepuff.js install codex       # adds hooks to your user hooks.json (after saving a backup)
node codepuff/bin/codepuff.js pet
claude --plugin-dir codepuff                       # tries the Claude Code mod without installing it
```

`install codex` points the hooks at that folder, so keep the clone where it is (it refuses a copy that npx unpacked into a temporary cache, which
would be cleaned up later). `codepuff uninstall codex` removes only CodePuff's hooks and keeps yours.

## Where things are

- Your pet, settings and statistics: `~/.codepuff` (set `CODEPUFF_HOME` to move it). Shared by Claude Code and Codex.
- The Claude Code plugin: where Claude Code keeps plugins (`~/.claude/plugins`). The Codex plugin: `~/.codex/plugins`.

## When something does not work

| What you see | What to try |
| --- | --- |
| No pet above the prompt in Claude Code | Start a **new** session after installing. `/plugin` should list `codepuff` as enabled. The band can also be switched off: `/codepuff band on`. |
| `/codepuff` is not found | The plugin is not enabled: `/plugin install codepuff@codepuff`. |
| The Codex terminal app says "waiting for an agent" | Codex has not run a hook yet: trust the hooks (`/hooks`), then send a prompt. `npx github:luizbizzio/codepuff doctor` shows whether they are installed. |
| Numbers look doubled in Codex | CodePuff is installed twice (plugin and hooks): keep one. |
| No sound | Sounds play on the Claude Code desktop app on Windows through PowerShell; check `/codepuff sound question chime` and `/codepuff volume high`, and that the system volume is up. |
| Codex shows tool calls but no successes or failures | Expected: the Codex build checked does not report when a tool finishes ([STATUS](STATUS.md)). |
| Anything else | `npx github:luizbizzio/codepuff doctor`, then open an issue with its output. |
