import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { tempDir } from './helpers.js'

const CLI = join(import.meta.dirname, '..', 'bin', 'codepuff.js')

/** Stand-ins for `claude` and `codex` that only write down how they were called. */
function stubs(dir, { exit = {} } = {}) {
  const bin = join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const log = join(dir, 'calls.log')
  for (const name of ['claude', 'codex']) {
    const code = exit[name] ?? 0
    // (`--version` always answers: it is how setup finds the tool, and is not an installation step.)
    if (process.platform === 'win32') writeFileSync(join(bin, name + '.cmd'), `@echo off\r\nif "%1"=="--version" exit /b 0\r\necho ${name} %*>>"${log}"\r\nexit /b ${code}\r\n`)
    else { writeFileSync(join(bin, name), `#!/bin/sh\n[ "$1" = "--version" ] && exit 0\necho "${name} $@" >> "${log}"\nexit ${code}\n`); chmodSync(join(bin, name), 0o755) }
  }
  return { bin, log, calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split(/\r?\n/).map(line => line.trim().replace(/\s+/g, ' ')).filter(Boolean) : []) }
}

function setup(dir, tools, args = [], env = {}) {
  const path = tools.bin + delimiter + (process.env.PATH ?? process.env.Path ?? '')
  return spawnSync(process.execPath, [CLI, 'setup', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: path, Path: path, CLAUDE_CONFIG_DIR: join(dir, 'claude'), CODEX_HOME: join(dir, 'codex'), CODEPUFF_HOME: join(dir, 'data'), CODEPUFF_LANG: 'en', ...env },
  })
}

test('setup installs the plugin in Claude Code and in Codex through their own command lines, from the GitHub marketplace', () => {
  const { dir, done } = tempDir()
  try {
    const tools = stubs(dir)
    const r = setup(dir, tools)
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.deepEqual(tools.calls(), [
      'claude plugin marketplace add luizbizzio/codepuff',
      'claude plugin install codepuff@codepuff',
      'codex plugin marketplace add luizbizzio/codepuff',
      'codex plugin add codepuff@codepuff',
    ])
    assert.match(r.stdout, /start a new Claude Code session/)
    assert.match(r.stdout, /trust them/)
    assert.match(r.stdout, /npx github:luizbizzio\/codepuff doctor/)
  } finally { done() }
})

test('setup does only what is asked, changes nothing on a dry run, and leaves hosts that already have CodePuff alone', () => {
  const { dir, done } = tempDir()
  try {
    const tools = stubs(dir)
    assert.equal(setup(dir, tools, ['--only', 'codex']).status, 0)
    assert.deepEqual(tools.calls(), ['codex plugin marketplace add luizbizzio/codepuff', 'codex plugin add codepuff@codepuff'])
    const dry = setup(dir, stubs(join(dir, 'dry')), ['--dry-run'])
    assert.match(dry.stdout, /\$ claude plugin install codepuff@codepuff/)
    assert.deepEqual(stubs(join(dir, 'dry')).calls(), [], 'a dry run runs nothing')
    // Already installed in both: nothing is run.
    mkdirSync(join(dir, 'claude'), { recursive: true }); mkdirSync(join(dir, 'codex'), { recursive: true })
    writeFileSync(join(dir, 'claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'codepuff@codepuff': true } }))
    writeFileSync(join(dir, 'codex', 'config.toml'), '[plugins."codepuff@codepuff"]\nenabled = true\n')
    const again = stubs(join(dir, 'again'))
    const r = setup(dir, again)
    assert.equal(r.status, 0)
    assert.deepEqual(again.calls(), [])
    assert.equal((r.stdout.match(/already installed/g) ?? []).length, 2)
  } finally { done() }
})

test('setup never adds the plugin next to Codex hooks (every event would be counted twice), and says what to type when a tool is missing or fails', () => {
  const { dir, done } = tempDir()
  try {
    mkdirSync(join(dir, 'codex'), { recursive: true })
    writeFileSync(join(dir, 'codex', 'hooks.json'), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node /x/codepuff/bin/codepuff.js hook codex' }] }] } }))
    const tools = stubs(dir)
    const r = setup(dir, tools)
    assert.match(r.stdout, /already in Codex as hooks/)
    assert.deepEqual(tools.calls().filter(line => line.startsWith('codex')), [])
    // A claude that fails: the two lines to type are printed and the exit code says so.
    const broken = stubs(join(dir, 'broken'), { exit: { claude: 1 } })
    const failed = setup(dir, broken, ['--only', 'claude'])
    assert.equal(failed.status, 1)
    assert.match(failed.stdout, /\/plugin install codepuff@codepuff/)
    // No tools on PATH at all.
    const empty = join(dir, 'empty'); mkdirSync(empty, { recursive: true })
    const none = spawnSync(process.execPath, [CLI, 'setup'], { encoding: 'utf8', env: { ...process.env, CODEPUFF_PATH_ONLY: '1', PATH: empty, Path: empty, CLAUDE_CONFIG_DIR: join(dir, 'c2'), CODEX_HOME: join(dir, 'x2'), CODEPUFF_HOME: join(dir, 'd2') } })
    assert.equal(none.status, 0)
    assert.match(none.stdout, /claude command was not found/)
    assert.match(none.stdout, /codex plugin marketplace add luizbizzio\/codepuff/)
  } finally { done() }
})
