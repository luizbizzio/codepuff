// Regenerates codex/hooks.json (the hooks shipped inside the Codex plugin) from src/node/install.js.
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pluginHooksDocument } from '../src/node/install.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
writeFileSync(join(root, 'codex', 'hooks.json'), JSON.stringify(pluginHooksDocument(), null, 2) + '\n')
console.log('wrote codex/hooks.json')
