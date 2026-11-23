// Runs ONE tiny real Codex session with CodePuff's hooks attached, to check them against the real Codex.
//
//   node scripts/live-codex.mjs [path to codex] [--keep]
//
// What it does, and does not do:
//   - runs `codex exec --ephemeral` (no session files are kept) in a temporary project, read-only sandbox;
//   - injects the hooks with `-c hooks.*=...` for this one run: your ~/.codex files are not read or changed
//     (`--ignore-user-config`), and your CodePuff data folder is not used (CODEPUFF_HOME points at a temp folder);
//   - needs `--dangerously-bypass-hook-trust` for this run because the hooks are not installed (and so not trusted);
//   - uses a little of your Codex usage: one prompt asking for two shell commands;
//   - also writes every raw hook payload it receives to <temp>/capture.jsonl so real payload shapes can be looked at.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const codex = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) ?? 'codex'
const tmp = mkdtempSync(join(tmpdir(), 'codepuff-live-'))
const proj = join(tmp, 'proj')
const data = join(tmp, 'data')
mkdirSync(proj, { recursive: true })
const fwd = p => p.replaceAll('\\', '/')

writeFileSync(join(tmp, 'capture.cjs'), `let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{require('fs').appendFileSync(${JSON.stringify(fwd(join(tmp, 'capture.jsonl')))},d.replace(/\\r?\\n/g,' ')+'\\n');process.stdout.write('{}')})`)

const events = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'PreModelRequest', 'PostModelRequest', 'SubagentStart', 'SubagentStop', 'Stop', 'Interrupt', 'SessionEnd']
const handler = (command, extra = '') => `{type="command",command="${command.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}",timeout=10${extra}}`
const ours = `node "${fwd(join(root, 'bin', 'codepuff.js'))}" hook codex`
const capture = `node "${fwd(join(tmp, 'capture.cjs'))}"`
const args = ['exec', '--ephemeral', '--ignore-user-config', '--dangerously-bypass-hook-trust', '--skip-git-repo-check', '-s', 'read-only', '-C', proj, '--json']
// --async marks CodePuff's own handler as a background hook, to check that this Codex accepts and runs it.
const asyncExtra = process.argv.includes('--async') ? ',async=true' : ''
const syncOnly = new Set(['Stop', 'Interrupt', 'SessionEnd']) // end-of-turn events stay synchronous
for (const event of events) args.push('-c', `hooks.${event}=[{hooks=[${handler(ours, syncOnly.has(event) ? '' : asyncExtra)},${handler(capture)}]}]`)
args.push('Run exactly two shell commands, one after the other, and nothing else: first `echo codepuff-live-test`, then `node -e "process.exit(3)"`. After that, reply with only the word done.')

console.log('Running one real Codex session (this can take a minute)...')
const started = Date.now()
const run = spawnSync(codex, args, { encoding: 'utf8', timeout: 240_000, env: { ...process.env, CODEPUFF_HOME: data }, cwd: proj })
console.log(`exit ${run.status} after ${Math.round((Date.now() - started) / 1000)} s`)
if (run.error) console.log('error:', run.error.message)
if (run.status !== 0) console.log((run.stderr || '').slice(-1500))

const capturePath = join(tmp, 'capture.jsonl')
const payloads = existsSync(capturePath) ? readFileSync(capturePath, 'utf8').trim().split('\n').filter(Boolean).map(line => { try { return JSON.parse(line) } catch { return { unparsable: line.slice(0, 80) } } }) : []
console.log('\nHook events Codex sent:', payloads.map(p => p.hook_event_name ?? '?').join(' → ') || '(none)')
for (const p of payloads.filter(p => p.hook_event_name === 'PostToolUse')) {
  console.log('\nPostToolUse payload keys:', Object.keys(p).join(', '))
  console.log('  tool_name:', p.tool_name, '| tool_input:', JSON.stringify(p.tool_input).slice(0, 160))
  console.log('  tool_response:', JSON.stringify(p.tool_response).slice(0, 400))
}

// What CodePuff made of it.
const sessions = join(data, 'sessions', 'codex')
const files = existsSync(sessions) ? readdirSync(sessions).filter(n => n.endsWith('.json')) : []
console.log('\nCodePuff records written:', files.length)
for (const f of files) {
  const rec = JSON.parse(readFileSync(join(sessions, f), 'utf8'))
  const sum = Object.values(rec.days).reduce((acc, d) => { for (const [k, v] of Object.entries(d)) if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v; return acc }, {})
  console.log(' ', f, JSON.stringify({ project: rec.pname, counters: sum, live: { run: rec.live.run, te: !!rec.live.te, err: !!rec.live.err } }))
}
const errors = join(data, 'errors.log')
if (existsSync(errors)) console.log('hook errors:', readFileSync(errors, 'utf8').slice(0, 400))
console.log('\nartifacts:', tmp)
if (!process.argv.includes('--keep')) { console.log('(removing them; use --keep to look at capture.jsonl)'); rmSync(tmp, { recursive: true, force: true }) }
