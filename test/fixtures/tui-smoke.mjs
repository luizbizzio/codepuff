// Draws the terminal app's Statistics view once from a temporary data folder and exits (used by test/tui.test.js).
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleHook } from '../../src/node/hook.js'
import { openStore } from '../../src/node/store.js'
import { runTui } from '../../src/node/tui.js'

const store = openStore(mkdtempSync(join(tmpdir(), 'codepuff-tui-')))
const now = Date.now()
const event = (name, extra) => JSON.stringify({ session_id: 's1', cwd: '/p/app', hook_event_name: name, ...extra })
handleHook('codex', event('UserPromptSubmit', { prompt: 'hi' }), { store, now })
for (let i = 0; i < 4; i++) handleHook('codex', event('PostToolUse', { tool_name: i % 2 ? 'Bash' : 'Read', tool_input: { command: 'ls', file_path: '/p/a' }, tool_use_id: 't' + i, tool_response: 'ok' }), { store, now: now + i })
Object.defineProperty(process.stdout, 'isTTY', { value: true })
process.stdout.columns = 100
process.stdout.rows = 40
setTimeout(() => process.exit(0), 600)
await runTui(store, { tab: 1, host: process.argv[2] })
