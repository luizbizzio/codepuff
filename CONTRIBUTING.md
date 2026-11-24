# Contributing

Thanks for looking. CodePuff is small on purpose: no runtime dependencies, no build step, no network.

- **Set up**: Node 20+. `npm test` runs the whole suite. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the tools.
- **Before a pull request**: `npm test` passes; if you touched `hooks/` also `npm run check:mod` (needs the `claude` CLI); if you
  changed a character, its animations or the palette, run `npm run art:hashes` and say so, because the art fingerprints in
  `test/fixtures` are meant to change only on purpose.
- **Keep the promises**: statistics are counted, never guessed (an outcome that cannot be read is *unknown*); nothing about a
  prompt, a command, a path or a tool's output is ever stored; the pet reacts only to real events.
- **Adding a character**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), "Adding a character". Original art only, please.
- **Bugs**: open an issue with the host (Claude Code or Codex) and its version, your OS, and what the pet showed against what you
  expected. `codepuff doctor` prints the details that help.

By contributing you agree your work is licensed under the [Apache License 2.0](LICENSE). Please follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
