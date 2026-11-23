// Copies the Claude Code plugin (a mirror of the repository's plugin files) into a folder Claude Code loads
// mods from, so a change can be tried in a live session without installing anything.
// Usage: node scripts/dev-sync.mjs <target folder>
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(process.argv[2] ?? '')
if (!process.argv[2]) { console.error('Usage: node scripts/dev-sync.mjs <target folder>'); process.exit(2) }

for (const part of ['.claude-plugin/plugin.json', 'hooks', 'types', 'src/core', 'src/claude']) {
  const to = join(target, part)
  rmSync(to, { recursive: true, force: true })
  mkdirSync(dirname(to), { recursive: true })
  cpSync(join(root, part), to, { recursive: true })
}
console.log('synced to', target)
