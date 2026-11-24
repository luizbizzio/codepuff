// Runs every test file (test/*.test.js) with Node's test runner. It lists the files itself, because `node --test "test/*.test.js"`
// only expands the pattern from Node 21 on, and this project supports Node 20.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'test')
const files = readdirSync(dir).filter(name => name.endsWith('.test.js')).sort().map(name => join(dir, name))
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: { ...process.env, CODEPUFF_LANG: 'en' } })
process.exit(result.status ?? 1)
