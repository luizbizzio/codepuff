import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from '../src/node/store.js'
import { handleHook } from '../src/node/hook.js'
import { parseShow } from '../src/node/git.js'
import { aggregate } from '../src/core/aggregate.js'
import { focus } from '../src/core/petstate.js'
import { CODEX_EVENTS, hookCommand, installCodex, mergeCodexHooks } from '../src/node/install.js'
import { T0, tempDir } from './helpers.js'

const CLI = join(import.meta.dirname, '..', 'bin', 'codepuff.js')
const run = (dir, args, input) => spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir } })

test('the hook process answers {} and records the event, for a real Codex payload', () => {
  const { dir, done } = tempDir()
  try {
    const payload = { session_id: 'thread-1', transcript_path: null, cwd: 'C:\\Users\\me\\proj', hook_event_name: 'UserPromptSubmit', model: 'x', permission_mode: 'default', turn_id: 'turn-1', prompt: 'please do the secret thing' }
    const result = run(dir, ['hook', 'codex'], JSON.stringify(payload))
    assert.equal(result.status, 0)
    assert.equal(result.stdout.trim(), '{}')
    const rec = openStore(dir).readRecord('codex', 'thread-1')
    assert.equal(aggregate([rec], {}).prompts, 1)
    assert.equal(rec.pname, 'proj')
    assert.ok(!JSON.stringify(rec).includes('secret'), 'the prompt text is never stored')
  } finally { done() }
})

test('the hook never blocks or breaks the agent: garbage in, {} out, exit 0', () => {
  const { dir, done } = tempDir()
  try {
    for (const input of ['', 'not json', '{"hook_event_name":', '[]', 'null', '{"hook_event_name":"Stop"}']) {
      const result = run(dir, ['hook', 'codex'], input)
      assert.equal(result.status, 0, input)
      assert.equal(result.stdout.trim(), '{}', input)
    }
    assert.ok(existsSync(join(dir, 'errors.log')), 'failures are noted, quietly')
  } finally { done() }
})

test('a byte-order mark in front of the payload (Windows PowerShell pipes) is tolerated', () => {
  const { dir, done } = tempDir()
  try {
    const body = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'bom', cwd: '/p', turn_id: 't' })
    assert.equal(run(dir, ['hook', 'codex'], '﻿' + body).status, 0)
    assert.equal(run(dir, ['hook', 'codex'], 'ï»¿' + body.replace('"bom"', '"bom2"')).status, 0)
    assert.equal(aggregate(openStore(dir).listRecords(), {}).prompts, 2)
  } finally { done() }
})

test('the error log never contains any of the input', () => {
  const { dir, done } = tempDir()
  try {
    run(dir, ['hook', 'codex'], '{"prompt":"my secret plan","hook_event_name":')
    const log = readFileSync(join(dir, 'errors.log'), 'utf8')
    assert.match(log, /not valid JSON/)
    assert.ok(!log.includes('secret'))
  } finally { done() }
})

test('the hook still answers when the data folder cannot be written', () => {
  const blocked = mkdtempSync(join(tmpdir(), 'codepuff-blocked-'))
  writeFileSync(join(blocked, 'file'), 'x') // a file where a folder is needed
  const result = spawnSync(process.execPath, [CLI, 'hook', 'codex'], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's', cwd: '/p' }), encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: join(blocked, 'file', 'sub') } })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), '{}')
})

test('Claude-style payloads work through the same command hook (for hosts without the plugin)', () => {
  const { dir, done } = tempDir()
  try {
    run(dir, ['hook', 'claude'], JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 'c1', cwd: '/p', tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 'a', tool_response: { stdout: 'ok' } }))
    const s = aggregate(openStore(dir).listRecords(), { agent: 'claude' })
    assert.equal(s.tests.passed, 1)
  } finally { done() }
})

test('the whole flow, event to animation: a Codex turn drives the pet through its states', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    const send = (name, extra, at) => handleHook('codex', JSON.stringify({ hook_event_name: name, session_id: 'flow', cwd: '/p/app', turn_id: 't', ...extra }), { store, now: T0 + at, readCommit: () => undefined })
    const states = at => focus(store.listRecords(), T0 + at).current
    send('SessionStart', { source: 'startup' }, 0)
    assert.equal(states(100).state, 'idle')
    send('UserPromptSubmit', { prompt: 'x' }, 1000)
    assert.equal(states(1100).state, 'thinking')
    send('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'cat src/a.js' }, tool_use_id: 'r' }, 2000)
    assert.equal(states(2100).state, 'reading', 'a shell read looks like reading')
    send('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'cat src/a.js' }, tool_use_id: 'r', tool_response: 'Exit code: 0\nOutput:\nx' }, 3000)
    send('PreToolUse', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' }, tool_use_id: 'e' }, 4000)
    assert.equal(states(4100).state, 'coding')
    send('PostToolUse', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' }, tool_use_id: 'e', tool_response: 'ok' }, 5000)
    send('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 't1' }, 6000)
    assert.equal(states(6100).state, 'testing')
    send('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 't1', tool_response: 'Exit code: 0\nOutput:\nok' }, 8000)
    assert.equal(states(8100).state, 'success')
    send('Stop', { last_assistant_message: 'done', stop_hook_active: false }, 12_000)
    assert.equal(states(12_100).state, 'finished')
    assert.equal(states(12_100).agent, 'codex')
    assert.equal(states(12_100).project, 'app')
    const s = aggregate(store.listRecords(), {})
    assert.deepEqual({ prompts: s.prompts, turns: s.turns, tools: s.tools.total, files: s.files, passed: s.tests.passed }, { prompts: 1, turns: 1, tools: 3, files: 1, passed: 1 })
  } finally { done() }
})

test('real Codex payloads: the events seen in a live Codex 0.171 session are understood (usage-limit failure included)', () => {
  // These are the payloads a real `codex exec` sent in this project's live check, with ids shortened.
  const sid = '01a20a4f-f26f-7093-8fe5-8385cb986317'
  const base = { session_id: sid, transcript_path: null, cwd: 'C:\\Users\\x\\AppData\\Local\\Temp\\proj', model: 'gpt-6.2-sol' }
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    const send = (payload, at) => handleHook('codex', JSON.stringify({ ...base, ...payload }), { store, now: T0 + at, readCommit: () => undefined })
    send({ hook_event_name: 'SessionStart', permission_mode: 'default', source: 'startup' }, 0)
    send({ hook_event_name: 'UserPromptSubmit', permission_mode: 'default', turn_id: 't', prompt: 'x' }, 1000)
    send({ kind: 'sampling', request_id: 'r', attempt_number: 1, thread_id: sid, turn_id: 't', hook_event_name: 'PreModelRequest' }, 1100)
    assert.equal(focus(store.listRecords(), T0 + 1200).current.state, 'thinking')
    send({ kind: 'sampling', request_id: 'r', attempt_number: 1, thread_id: sid, turn_id: 't', hook_event_name: 'PostModelRequest', status: 'failed', error: 'You have hit your usage limit', token_usage: null, response_id: null }, 1500)
    const now = focus(store.listRecords(), T0 + 1600).current
    assert.equal(now.state, 'error')
    assert.equal(now.label, 'The model request failed')
    send({ hook_event_name: 'SessionEnd', reason: 'other' }, 2000)
    const rec = store.readRecord('codex', sid)
    assert.ok(!JSON.stringify(rec).includes('usage limit'), 'the error text is not kept')
    const s = aggregate([rec], {})
    assert.equal(s.prompts, 1)
    assert.equal(s.modelFailures, 1)
    assert.ok(rec.ended > 0)
  } finally { done() }
})

test('a successful commit is read from git once, and the same hash is never counted twice', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    const commit = { hash: 'c'.repeat(40), committedAt: T0, added: 12, removed: 4, files: 3 }
    const payload = id => JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 'g', cwd: '/p', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' }, tool_use_id: id, tool_response: 'Exit code: 0' })
    const first = handleHook('codex', payload('a'), { store, now: T0, readCommit: () => commit })
    assert.equal(first.commit, commit.hash)
    handleHook('codex', payload('b'), { store, now: T0 + 5000, readCommit: () => commit }) // e.g. a retried command seeing the same HEAD
    const s = aggregate(store.listRecords(), {})
    assert.equal(s.git.commits, 1)
    assert.equal(s.git.added, 12)
    assert.equal(s.git.removed, 4)
    // A failed commit is not a commit.
    const failed = JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 'g', cwd: '/p', tool_name: 'Bash', tool_input: { command: 'git commit -m y' }, tool_use_id: 'f', tool_response: 'Exit code: 1' })
    let asked = false
    handleHook('codex', failed, { store, now: T0 + 9000, readCommit: () => { asked = true } })
    assert.equal(asked, false, 'git is not even consulted')
  } finally { done() }
})

test('git output is parsed exactly, and a stale HEAD is not "the commit just made"', () => {
  const out = `${'a'.repeat(40)}\x1f${Math.floor(T0 / 1000)}\x1f${'b'.repeat(40)}\n\n10\t2\tsrc/a.js\n0\t5\tsrc/b.js\n-\t-\timg.png\n`
  assert.deepEqual(parseShow(out, T0 + 1000), { hash: 'a'.repeat(40), committedAt: T0, added: 10, removed: 7, files: 3 })
  assert.equal(parseShow(out, T0 + 3_600_000), undefined, 'an hour-old HEAD is not fresh')
  const merge = `${'a'.repeat(40)}\x1f${Math.floor(T0 / 1000)}\x1f${'b'.repeat(40)} ${'c'.repeat(40)}\n`
  assert.deepEqual(parseShow(merge, T0), { hash: 'a'.repeat(40), committedAt: T0, added: null, removed: null, files: null }, 'merge: lines unavailable, never invented')
  assert.equal(parseShow('garbage', T0), undefined)
})

test('git integration against a real repository', () => {
  const repo = mkdtempSync(join(tmpdir(), 'codepuff-repo-'))
  try {
    const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    writeFileSync(join(repo, 'a.txt'), 'one\ntwo\nthree\n')
    git('add', '.')
    git('commit', '-q', '-m', 'first')
    writeFileSync(join(repo, 'a.txt'), 'one\nTWO\nthree\nfour\n')
    git('commit', '-q', '-am', 'second')
    const { readHeadCommit } = awaitImport()
    const commit = readHeadCommit(repo, Date.now())
    assert.equal(commit.added, 2)
    assert.equal(commit.removed, 1)
    assert.equal(commit.files, 1)
    assert.match(commit.hash, /^[0-9a-f]{40}$/)
    assert.equal(readHeadCommit(repo, Date.now() + 3_600_000 * 5), undefined)
    assert.equal(readHeadCommit(tmpdir(), Date.now()), undefined, 'not a repository')
  } catch (error) {
    if (/ENOENT/.test(String(error))) return // git not installed on this machine
    throw error
  }
})
import * as gitModule from '../src/node/git.js'
const awaitImport = () => gitModule

test('Codex install merges into existing hooks, keeps the user\'s own, and is idempotent', () => {
  const home = mkdtempSync(join(tmpdir(), 'codepuff-codex-'))
  const cli = join(home, 'codepuff', 'bin', 'codepuff.js')
  const mine = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook codex' }] }] } }
  writeFileSync(join(home, 'hooks.json'), JSON.stringify(mine, null, 2))
  const first = installCodex({ home, cliPath: cli })
  assert.equal(first.unchanged, false)
  const doc = JSON.parse(readFileSync(join(home, 'hooks.json'), 'utf8'))
  assert.deepEqual(doc.hooks.PreToolUse[0], mine.hooks.PreToolUse[0], 'the existing hook is untouched and still first')
  assert.equal(doc.hooks.PreToolUse.length, 2)
  for (const [event] of CODEX_EVENTS) assert.ok(doc.hooks[event].some(g => g.hooks.some(h => h.command === hookCommand(cli))), event)
  assert.ok(existsSync(join(home, 'hooks.json.codepuff-backup')))
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'hooks.json.codepuff-backup'), 'utf8')), mine, 'the backup is the original')
  assert.equal(installCodex({ home, cliPath: cli }).unchanged, true, 'a second install changes nothing')
  assert.equal(JSON.parse(readFileSync(join(home, 'hooks.json'), 'utf8')).hooks.PostToolUse.length, 1, 'no duplicates')

  const removed = installCodex({ home, cliPath: cli, remove: true })
  assert.equal(removed.unchanged, false)
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'hooks.json'), 'utf8')), mine, 'uninstall restores exactly the user\'s own hooks')
})

test('Codex install refuses to overwrite a hooks file it cannot parse', () => {
  const home = mkdtempSync(join(tmpdir(), 'codepuff-codex-'))
  writeFileSync(join(home, 'hooks.json'), '{ broken')
  assert.throws(() => installCodex({ home, cliPath: '/x/codepuff.js' }), /not valid JSON/)
  assert.equal(readFileSync(join(home, 'hooks.json'), 'utf8'), '{ broken')
})

test('Codex install creates the file when there is none, and a dry run writes nothing', () => {
  const home = mkdtempSync(join(tmpdir(), 'codepuff-codex-'))
  const dry = installCodex({ home, cliPath: '/x/codepuff.js', dryRun: true })
  assert.equal(existsSync(join(home, 'hooks.json')), false)
  assert.ok(dry.text.includes('hook codex'))
  installCodex({ home, cliPath: '/x/codepuff.js' })
  assert.ok(existsSync(join(home, 'hooks.json')))
  assert.deepEqual(mergeCodexHooks({}, '/x/codepuff.js', { remove: true }), { hooks: {} })
})

test('Codex hooks that must not block the agent are asynchronous; only end-of-turn ones are synchronous', () => {
  const doc = mergeCodexHooks({}, '/x/codepuff.js')
  for (const event of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'PreModelRequest']) assert.equal(doc.hooks[event][0].hooks[0].async, true, event)
  for (const event of ['Stop', 'SessionEnd', 'Interrupt']) assert.equal(doc.hooks[event][0].hooks[0].async, undefined, event)
})

test('the CLI reports statistics from the shared history', () => {
  const { dir, done } = tempDir()
  try {
    run(dir, ['hook', 'claude'], JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'a', cwd: '/p/x' }))
    run(dir, ['hook', 'codex'], JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'b', cwd: '/p/y', turn_id: 't' }))
    const stats = JSON.parse(run(dir, ['stats', '--json']).stdout)
    const [combined, claude, codex] = stats.columns
    assert.equal(combined.stats.prompts, 2)
    assert.equal(claude.stats.prompts, 1)
    assert.equal(codex.stats.prompts, 1)
    assert.equal(combined.stats.projects, 2)
    assert.equal(stats.life.current, 1)
    const text = run(dir, ['stats']).stdout
    assert.match(text, /Prompts submitted\s+2\s+1\s+1/)
    assert.match(run(dir, ['stats', '--scope', 'session']).stdout, /This session/)
    assert.match(run(dir, []).stdout, /Alpha \(alpha\)/)
  } finally { done() }
})

test('the CLI validates settings and guards destructive commands', () => {
  const { dir, done } = tempDir()
  try {
    assert.match(run(dir, ['set', 'name', 'Biscuit']).stdout, /Biscuit/)
    assert.equal(run(dir, ['set', 'body', 'red']).status, 1)
    assert.equal(run(dir, ['set', 'character', 'dragon']).status, 1)
    assert.match(run(dir, ['set', 'palette', 'mint']).stdout, /custom colors/)
    assert.equal(openStore(dir).ensurePet().name, 'Biscuit')
    assert.notEqual(run(dir, ['data', 'delete']).status, 0, 'refuses without --yes')
    assert.ok(existsSync(join(dir, 'pet.json')))
    assert.notEqual(run(dir, ['data', 'reset', 'stats']).status, 0)
    assert.equal(run(dir, ['data', 'reset', 'stats', '--yes']).status, 0)
    assert.match(run(dir, ['set', 'restore']).stdout, /restored/)
    assert.equal(openStore(dir).ensurePet().name, '')
    assert.equal(run(dir, ['data', 'delete', '--yes']).status, 0)
    assert.equal(existsSync(dir), false)
  } finally { done() }
})

test('the Codex hook judges the user\'s message the same way: hearts fall, nothing of the text is kept, and the switch turns it off', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    store.ensurePet(T0)
    const prompt = text => ({ session_id: 'thread-9', cwd: '/p', hook_event_name: 'UserPromptSubmit', prompt: text })
    handleHook('codex', JSON.stringify(prompt('você é um idiota')), { store, now: T0 })
    assert.equal(store.readPet().pet.affection.score, 85)
    handleHook('codex', JSON.stringify(prompt('this stupid bug, fix it')), { store, now: T0 + 1000 })
    assert.equal(store.readPet().pet.affection.score, 85, 'swearing at a bug does not count')
    handleHook('codex', JSON.stringify(prompt('thanks, great job')), { store, now: T0 + 2000 })
    assert.equal(store.readPet().pet.affection.score, 89)
    const all = [store.paths.pet, store.readRecord('codex', 'thread-9') && JSON.stringify(store.readRecord('codex', 'thread-9'))].filter(Boolean).map(x => (x.startsWith('{') ? x : readFileSync(x, 'utf8'))).join('\n')
    assert.ok(!/idiot|stupid|great job/.test(all), 'the text is not stored')
    store.writePet({ ...store.readPet().pet, prefs: { ...store.readPet().pet.prefs, mood: false } })
    handleHook('codex', JSON.stringify(prompt('burro')), { store, now: T0 + 3000 })
    assert.equal(store.readPet().pet.affection.score, 89, 'with the switch off nothing is judged')
  } finally { done() }
})
