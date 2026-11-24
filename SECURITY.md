# Security

CodePuff runs next to your coding agent, so what it can see and do is deliberately narrow.

- **It never changes what the agent does.** Every hook answers with the host's own answer or `{}`; it denies, rewrites and blocks
  nothing, and a failure inside it is swallowed.
- **It makes no network request and calls no model.** Its only processes are `git show` (to read a commit it just saw) and, on
  Windows, PowerShell's sound player for a short clip from its own folder.
- **It stores counters only**: never prompts, code, commands, file paths or tool output. The text of a prompt is read in memory
  for the hearts and dropped. Everything is in `~/.codepuff` (or `CODEPUFF_HOME`).
- **It never edits Codex's trust state.** You approve the hooks yourself.

**Reporting a vulnerability**: please use GitHub's private
[security advisory](https://github.com/luizbizzio/codepuff/security/advisories/new) instead of a public issue. There is one
maintainer, so a reply may take a few days.
