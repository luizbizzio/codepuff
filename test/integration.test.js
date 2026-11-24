import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openStore } from '../src/node/store.js'
import { PLUGIN_HOOK_COMMAND, pluginHooksDocument } from '../src/node/install.js'
import { aggregate } from '../src/core/aggregate.js'
import { normalizeHook } from '../src/core/normalize.js'
import { tempDir } from './helpers.js'

const ROOT = join(import.meta.dirname, '..')
const payload = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'plug-1', cwd: '/p/demo', turn_id: 't', prompt: 'x' })

test('the Codex plugin hook command works through the system shell, with only PLUGIN_ROOT in the environment', () => {
  const { dir, done } = tempDir()
  try {
    // spawnSync with a string and shell:true goes through cmd.exe on Windows and /bin/sh elsewhere: the same path Codex takes.
    const result = spawnSync(PLUGIN_HOOK_COMMAND, { shell: true, input: payload, encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: ROOT, CODEPUFF_HOME: dir } })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), '{}')
    assert.equal(aggregate(openStore(dir).listRecords(), {}).prompts, 1)
  } finally { done() }
})

test('the same command works under PowerShell on Windows', { skip: process.platform !== 'win32' }, () => {
  const { dir, done } = tempDir()
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PLUGIN_HOOK_COMMAND], { input: payload, encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: ROOT, CODEPUFF_HOME: dir } })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), '{}')
    assert.equal(aggregate(openStore(dir).listRecords(), {}).prompts, 1)
  } finally { done() }
})

test('if the plugin folder cannot be found the hook still answers {} and exits cleanly', () => {
  const { dir, done } = tempDir()
  try {
    const result = spawnSync(PLUGIN_HOOK_COMMAND, { shell: true, input: payload, encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: join(dir, 'nowhere'), CODEPUFF_HOME: dir } })
    assert.equal(result.status, 0)
    assert.equal(result.stdout.trim(), '{}')
    const none = spawnSync(PLUGIN_HOOK_COMMAND, { shell: true, input: payload, encoding: 'utf8', env: Object.fromEntries(Object.entries({ ...process.env, CODEPUFF_HOME: dir }).filter(([k]) => !/PLUGIN_ROOT/.test(k))) })
    assert.equal(none.stdout.trim(), '{}')
  } finally { done() }
})

test('codex/hooks.json is exactly what the installer template generates', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(ROOT, 'codex', 'hooks.json'), 'utf8')), pluginHooksDocument())
})

test('plugin manifests are consistent across hosts', () => {
  const claude = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'))
  const codex = JSON.parse(readFileSync(join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'))
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(claude.name, 'codepuff')
  assert.equal(codex.name, 'codepuff')
  assert.equal(claude.version, pkg.version)
  assert.equal(codex.version, pkg.version)
  assert.equal(codex.hooks, './codex/hooks.json')
  assert.equal(claude.license, 'Apache-2.0')
  assert.equal(pkg.license, 'Apache-2.0')
  const market = JSON.parse(readFileSync(join(ROOT, '.agents', 'plugins', 'marketplace.json'), 'utf8'))
  assert.equal(market.plugins[0].name, 'codepuff')
  assert.equal(market.plugins[0].source.path, './')
  const cMarket = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'))
  assert.equal(cMarket.plugins[0].source, './')
})

// ---- terminal companion & doctor --------------------------------------------------------------------------------

test('the terminal app prints one still frame when it is not attached to a terminal', () => {
  const { dir, done } = tempDir()
  try {
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), 'pet'], { encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir } })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /▀|▄/)
  } finally { done() }
})

test('doctor reports and changes nothing', () => {
  const { dir, done } = tempDir()
  try {
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), 'doctor'], { encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir, CODEX_HOME: join(dir, 'codex') } })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /CodePuff doctor/)
    assert.match(r.stdout, /Codex hooks\s+—\s+not installed/)
    assert.ok(!readFileSyncSafe(join(dir, 'pet.json')), 'doctor does not create the pet')
  } finally { done() }
})
const readFileSyncSafe = path => { try { return readFileSync(path, 'utf8') } catch { return undefined } }

test('install and uninstall commands for Codex work through the CLI and leave data alone', () => {
  const { dir, done } = tempDir()
  try {
    const env = { ...process.env, CODEPUFF_HOME: dir, CODEX_HOME: join(dir, 'codex') }
    const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), ...args], { encoding: 'utf8', env })
    const store = openStore(dir)
    store.applyEvent(normalizeHook('codex', { hook_event_name: 'UserPromptSubmit', session_id: 'b', cwd: '/p', turn_id: 't' }, Date.now()))
    assert.match(run('install', 'codex', '--dry-run').stdout, /Would write/)
    assert.equal(readFileSyncSafe(join(dir, 'codex', 'hooks.json')), undefined)
    const installed = run('install', 'codex')
    assert.equal(installed.status, 0, installed.stderr)
    assert.match(installed.stdout, /\/hooks/)
    assert.match(run('doctor').stdout, /Codex hooks\s+—\s+installed/)
    const removed = run('uninstall', 'codex')
    assert.match(removed.stdout, /Removed CodePuff hooks/)
    assert.match(removed.stdout, /statistics were kept/)
    assert.equal(aggregate(store.listRecords(), {}).prompts, 1, 'uninstalling never deletes statistics')
  } finally { done() }
})
