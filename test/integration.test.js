import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    assert.match(r.stdout, /Codex\s+—\s+CodePuff is not installed in Codex/)
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
    assert.match(run('doctor').stdout, /Codex\s+—\s+hooks installed in/)
    const removed = run('uninstall', 'codex')
    assert.match(removed.stdout, /Removed CodePuff hooks/)
    assert.match(removed.stdout, /statistics were kept/)
    assert.equal(aggregate(store.listRecords(), {}).prompts, 1, 'uninstalling never deletes statistics')
  } finally { done() }
})

test('doctor sees CodePuff as a Codex plugin, as Codex hooks, and as a Claude Code plugin, and says what to do when it is neither', () => {
  const { dir, done } = tempDir()
  try {
    const codex = join(dir, 'codex'); const claude = join(dir, 'claude'); const data = join(dir, 'data')
    mkdirSync(codex, { recursive: true }); mkdirSync(claude, { recursive: true })
    const run = () => spawnSync(process.execPath, [join(import.meta.dirname, '..', 'bin', 'codepuff.js'), 'doctor'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: codex, CLAUDE_CONFIG_DIR: claude, CODEPUFF_HOME: data } }).stdout
    let out = run()
    assert.match(out, /warn\s+Codex\s+—\s+CodePuff is not installed in Codex: run "codex plugin marketplace add luizbizzio\/codepuff"/)
    assert.match(out, /warn\s+Claude Code\s+—\s+the CodePuff plugin is not enabled/)
    writeFileSync(join(codex, 'config.toml'), '[marketplaces.codepuff]\nsource_type = "git"\n\n[plugins."codepuff@codepuff"]\nenabled = true\n')
    writeFileSync(join(claude, 'settings.json'), JSON.stringify({ enabledPlugins: { 'codepuff@codepuff': true } }))
    out = run()
    assert.match(out, /ok\s+Codex\s+—\s+the CodePuff plugin is installed and enabled/)
    assert.match(out, /ok\s+Claude Code\s+—\s+the CodePuff plugin is installed and enabled/)
    writeFileSync(join(codex, 'config.toml'), '[plugins."codepuff@codepuff"]\nenabled = false\n')
    assert.match(run(), /warn\s+Codex/, 'a plugin that is switched off is not installed')
  } finally { done() }
})

test('"install codex" refuses a copy that npx unpacked, and refuses to add hooks next to the plugin (events would be counted twice)', () => {
  const { dir, done } = tempDir()
  try {
    const codex = join(dir, 'codex'); mkdirSync(codex, { recursive: true })
    const env = { ...process.env, CODEX_HOME: codex, CODEPUFF_HOME: join(dir, 'data') }
    const cli = join(import.meta.dirname, '..', 'bin', 'codepuff.js')
    writeFileSync(join(codex, 'config.toml'), '[plugins."codepuff@codepuff"]\nenabled = true\n')
    const refused = spawnSync(process.execPath, [cli, 'install', 'codex'], { encoding: 'utf8', env })
    assert.equal(refused.status, 1)
    assert.match(refused.stdout, /already installed in Codex as a plugin/)
    assert.ok(!readFileSync(join(codex, 'config.toml'), 'utf8').includes('hooks'), 'nothing was written')
    assert.equal(existsSync(join(codex, 'hooks.json')), false)
    // Without the plugin it installs; with --force it also installs next to the plugin.
    writeFileSync(join(codex, 'config.toml'), '')
    assert.equal(spawnSync(process.execPath, [cli, 'install', 'codex'], { encoding: 'utf8', env }).status, 0)
    assert.equal(existsSync(join(codex, 'hooks.json')), true)
    // Both at once: the doctor says so.
    writeFileSync(join(codex, 'config.toml'), '[plugins."codepuff@codepuff"]\nenabled = true\n')
    assert.match(spawnSync(process.execPath, [cli, 'doctor'], { encoding: 'utf8', env }).stdout, /installed both as a plugin and as hooks.*counted twice/)
  } finally { done() }
})

test('stats refuses a scope or an agent it does not know instead of quietly showing something else', () => {
  const { dir, done } = tempDir()
  try {
    const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), 'stats', ...args], { encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir } })
    assert.equal(run('--scope', 'bogus').status, 1)
    assert.match(run('--scope', 'bogus').stderr, /Scope: session, all/)
    assert.equal(run('--agent', 'nobody').status, 1)
    for (const scope of ['all', 'session', '7d', '30d', '90d']) assert.equal(run('--scope', scope).status, 0, scope)
    assert.equal(run('--agent', 'codex', '--scope', '7d').status, 0)
  } finally { done() }
})

test('doctor and install do not trigger Node deprecation warnings (claude is started as one quoted command on Windows)', () => {
  const { dir, done } = tempDir()
  try {
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), 'doctor'], { encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir, CODEX_HOME: join(dir, 'cx'), CLAUDE_CONFIG_DIR: join(dir, 'cl') } })
    assert.equal(r.status, 0)
    assert.ok(!/DeprecationWarning/.test(r.stderr), r.stderr)
  } finally { done() }
})
