# Development

CodePuff has **no runtime dependencies** and no build step: plain JavaScript (ES modules) and one TypeScript/JSX file pair for the
Claude Code mod (`hooks/`). Node 20+.

## Layout

| Folder | What is in it |
| --- | --- |
| `src/core` | The engine shared by every surface: events, statistics, pet states, art, rendering. No Node APIs. |
| `src/claude` | What the Claude Code mod does, behind an `io` interface so it can be tested without Claude Code. |
| `src/node` | Node-only code: the CLI, the Codex hook, the terminal app, the installer, the file store. |
| `hooks` | The Claude Code mod: `register.tsx` binds the host, `views.tsx` draws. |
| `codex`, `.codex-plugin`, `.agents` | The Codex plugin bundle (hooks and manifests; `codex/hooks.json` is generated). |
| `assets/sounds` | The sound clips (generated). |
| `test` | The tests. |
| `scripts` | Developer tools (below). |

## Tests

```text
npm test                    # the whole suite, on Node's own runner (no dependencies)
npm run check:mod           # claude plugin validate . && claude plugin test .   (needs the claude CLI)
npm run fuzz                # random garbage into the engine and the mod's controller; prints NO FAILURES or each failure
npm run art:hashes          # rewrites test/fixtures/art-hashes.json after a change to the art that was meant
```

CI runs `npm test` on Linux, Windows and macOS with Node 20 and 22, checks that `codex/hooks.json` is up to date, and runs the
mod checks where the `claude` CLI exists. `test/lint.test.js` guards mistakes only the real window shows (a `Box` sized in
pixels, an interactive `Svg` without a size). The art fingerprints fail when a character changes without anyone meaning it to.

## Tools (`scripts/`)

| Script | What it does |
| --- | --- |
| `dev-sync.mjs <folder>` | Copies the mod into a Claude Code dev-mods folder so a change can be tried in a live session |
| `preview.mjs [scale] [character]` | Contact sheets of the characters and states (`out/`) |
| `look.mjs <character> [scale] [states]` | One character, a few states, enlarged |
| `stage-box.mjs` | Measures the one frame every character is drawn in |
| `bench.mjs` | Measures the overhead (see [PERFORMANCE.md](PERFORMANCE.md)) |
| `live-codex.mjs [path to codex]` | ONE tiny real Codex run with the hooks attached; prints what Codex sent and what CodePuff made of it (uses a little Codex usage) |
| `seed-demo.mjs` | Fills a temporary data folder with believable activity (for screenshots) |
| `make-sounds.mjs` | Synthesizes the sound clips (`assets/sounds`) |
| `make-icon.mjs` | Draws the plugin icon |
| `gen-codex-hooks.mjs` | Regenerates `codex/hooks.json` |
| `sprites/*.py` | The sprite pipeline (needs Python with Pillow and numpy; see [ARCHITECTURE.md](ARCHITECTURE.md), "Adding a character") |

## Working on the mod

Claude Code's Mods API is early access and the mod is pinned to what the installed version declares. Edit, then
`node scripts/dev-sync.mjs <dev-mods folder>/codepuff` and start a new turn. `claude plugin validate .` reports what the engine
will refuse. Two rules come from the host: a hooks module never passes `$` around (every call is spelled `$.noun.method`), and
`on()` event names are literals.

## Releasing

Nothing is released yet. Before a release: `npm test` and `npm run check:mod` pass, [STATUS.md](STATUS.md) is true, the install
through the marketplace has been tried on a clean profile, and [CHANGELOG.md](../CHANGELOG.md) has the entry.
