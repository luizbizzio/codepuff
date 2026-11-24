import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregate } from '../src/core/aggregate.js'
import { newRecord, reduce } from '../src/core/session.js'
import { normalizeHook } from '../src/core/normalize.js'
import { bashFail, bashOk, hook, play, T0, withZone } from './helpers.js'

const total = rec => aggregate([rec], { now: T0 + 3_600_000 })

test('a user prompt counts once; subagent prompts, internal turns and tool retries do not', () => {
  const rec = play('claude', [
    'SessionStart',
    'UserPromptSubmit',
    ['UserPromptSubmit', { agent_id: 'sub-1' }], // a subagent's own prompt
    ['PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'a.js' }, tool_use_id: 'r1' }],
    ['PostToolUse', { tool_name: 'Read', tool_use_id: 'r1', tool_response: {} }],
    ['PostToolUse', { tool_name: 'Read', tool_use_id: 'r1', tool_response: {} }], // delivered twice
    ['Stop'],
    ['Stop', { agent_id: 'sub-1' }], // a subagent finishing is not the agent's turn
  ])
  const s = total(rec)
  assert.equal(s.prompts, 1)
  assert.equal(s.turns, 1)
  assert.equal(s.tools.total, 1, 'the same completion is counted once')
  assert.equal(s.sessions.observed, 1)
})

test('tools are counted by category with successes and failures', () => {
  const rec = play('claude', [
    'UserPromptSubmit',
    ...bashOk('ls'),
    ...bashFail('node broken.js'),
    ['PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'a.js' }, tool_use_id: 'e1', tool_response: {} }],
    ['PostToolUse', { tool_name: 'Grep', tool_use_id: 'g1', tool_response: {} }],
    ['PostToolUse', { tool_name: 'WebFetch', tool_use_id: 'w1', tool_response: {} }],
  ])
  const s = total(rec)
  assert.equal(s.tools.total, 5)
  assert.equal(s.tools.ok, 4)
  assert.equal(s.tools.failed, 1)
  assert.deepEqual({ shell: s.tools.byCategory.shell, edit: s.tools.byCategory.edit, search: s.tools.byCategory.search, web: s.tools.byCategory.web }, { shell: 2, edit: 1, search: 1, web: 1 })
})

test('test runs are counted as passed, failed or unknown, and only confirmed passes count as passed', () => {
  const rec = play('claude', [
    'UserPromptSubmit',
    ...bashOk('npm test'),
    ...bashFail('pytest'),
    ...bashOk('npm test | tail -3'), // pipeline hides the exit code
    ...bashOk('npm run build'), // not a test
  ])
  const s = total(rec)
  assert.deepEqual(s.tests, { run: 3, passed: 1, failed: 1, unknown: 1 })
})

test('Codex outcomes are read from the result, and an unreadable result is unknown', () => {
  const rec = play('codex', [
    'UserPromptSubmit',
    ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'cargo test' }, tool_use_id: 'a', tool_response: 'Exit code: 0\nOutput:\nok' }],
    ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'cargo test' }, tool_use_id: 'b', tool_response: { metadata: { exit_code: 101 } } }],
    ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'cargo test' }, tool_use_id: 'c', tool_response: 'finished' }],
  ])
  const s = total(rec)
  assert.deepEqual(s.tests, { run: 3, passed: 1, failed: 1, unknown: 1 })
  assert.equal(s.tools.unknown, 1)
})

test('Codex tools that are not shell commands count as completed unless the result says it failed', () => {
  const rec = play('codex', [
    'UserPromptSubmit',
    ['PostToolUse', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch' }, tool_use_id: 'a', tool_response: 'Done!' }],
    ['PostToolUse', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch' }, tool_use_id: 'b', tool_response: 'Error: patch does not apply' }],
    ['PostToolUse', { tool_name: 'mcp__x__y', tool_use_id: 'c', tool_response: { isError: true, content: [] } }],
    ['PostToolUse', { tool_name: 'update_plan', tool_use_id: 'd' }],
  ])
  const s = total(rec)
  assert.deepEqual({ ok: s.tools.ok, failed: s.tools.failed, unknown: s.tools.unknown }, { ok: 1, failed: 2, unknown: 1 })
})

test('a stray error field on a Claude success event never turns it into a failure', () => {
  const rec = play('claude', ['UserPromptSubmit', ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 'a', tool_response: {}, error: 'Exit code 1' }]])
  assert.deepEqual(total(rec).tests, { run: 1, passed: 1, failed: 0, unknown: 0 })
})

test('files changed counts distinct files per session and day, not edits', () => {
  const edit = (path, id) => ['PostToolUse', { tool_name: 'Edit', tool_input: { file_path: path }, tool_use_id: id, tool_response: {} }]
  const rec = play('claude', ['UserPromptSubmit', edit('a.js', '1'), edit('a.js', '2'), edit('b.js', '3'), edit('A.JS', '4')])
  assert.equal(total(rec).files, 2)
})

test('subagents, permissions and the live state follow real events', () => {
  const rec = play('claude', ['UserPromptSubmit', 'SubagentStart', ['PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm x' } }]])
  assert.equal(total(rec).subagents, 1)
  assert.equal(total(rec).permissions, 1)
  assert.equal(rec.live.sub, 1)
  assert.ok(rec.live.perm > 0)
  play('claude', [])
})

test('a resumed session keeps one record; it is not counted as a second session', () => {
  let rec = play('claude', ['SessionStart', 'UserPromptSubmit', 'Stop'])
  const resume = normalizeHook('claude', hook('SessionStart', { source: 'resume' }), T0 + 60_000)
  reduce(rec, resume)
  assert.equal(rec.resumes, 1)
  assert.equal(aggregate([rec], {}).sessions.observed, 1)
})

test('events applied out of order never leave a tool "running" forever', () => {
  const rec = play('codex', ['UserPromptSubmit'])
  const end = normalizeHook('codex', hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 'x', tool_response: 'Exit code: 0' }), T0 + 2000)
  const start = normalizeHook('codex', hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 'x' }), T0 + 1000)
  reduce(rec, end)
  reduce(rec, start) // arrives late
  assert.equal(rec.live.tools.length, 0)
})

test('events from different sessions and agents never mix', () => {
  const a = play('claude', ['UserPromptSubmit', ...bashOk('ls')], { session: 'A' })
  const b = play('codex', ['UserPromptSubmit', 'UserPromptSubmit', ...bashOk('ls'), ...bashOk('ls')], { session: 'B' })
  assert.equal(aggregate([a, b], { session: { agent: 'claude', sid: 'A' } }).prompts, 1)
  assert.equal(aggregate([a, b], { session: { agent: 'codex', sid: 'B' } }).prompts, 2)
  assert.equal(aggregate([a, b], { agent: 'codex' }).tools.total, 2)
  assert.equal(aggregate([a, b], {}).prompts, 3)
})

test('estimated agent time counts only gaps while a turn runs and caps long silences', () => {
  const rec = play('claude', ['UserPromptSubmit', 'Stop', 'UserPromptSubmit', 'Stop'], { step: 30_000 })
  // prompt -> stop: 30s of running, stop -> prompt: idle (not counted), prompt -> stop: 30s
  assert.equal(total(rec).activeMs, 60_000)
  const long = play('claude', ['UserPromptSubmit', 'Stop'], { step: 3 * 3_600_000 })
  assert.equal(total(long).activeMs, 10 * 60_000, 'one long silence is capped, not trusted')
  withZone(0, () => {})
})

test('missing events degrade gracefully: a tool end with no start, an end with no prompt, an unknown event', () => {
  const rec = play('codex', [
    ['PostToolUse', { tool_name: 'Read', tool_use_id: 'lone', tool_response: 'x' }],
    'Stop',
    'SomethingTheHostInventedLater',
  ])
  const s = total(rec)
  assert.equal(s.tools.total, 1)
  assert.equal(s.prompts, 0)
  assert.equal(s.turns, 1)
})

test('commits are counted once per hash across sessions; lines are never invented', () => {
  const a = play('claude', ['UserPromptSubmit', ...bashOk('git commit -m x')], { session: 'A' })
  const b = play('codex', ['UserPromptSubmit', ...bashOk('git commit -m x')], { session: 'B' })
  const commit = (hash, added, removed) => ({ kind: 'commit', hash, added, removed, files: 2, at: T0 + 5000, committedAt: T0 + 4000 })
  reduce(a, commit('a'.repeat(40), 10, 3))
  reduce(b, commit('a'.repeat(40), 10, 3)) // the same commit seen by a second session
  reduce(b, commit('b'.repeat(40), null, null)) // a merge: lines unavailable
  const s = aggregate([a, b], {})
  assert.equal(s.git.commits, 2)
  assert.equal(s.git.added, 10)
  assert.equal(s.git.removed, 3)
  assert.equal(s.git.withLines, 1)
  assert.equal(s.git.withoutLines, 1)
  reduce(a, commit('a'.repeat(40), 99, 99)) // the same hash again changes nothing
  assert.equal(aggregate([a, b], {}).git.added, 10)
})

test('a commit command whose details cannot be read is reported as unverified, not as a commit', () => {
  const rec = play('claude', ['UserPromptSubmit', ...bashOk('git commit -m x')])
  const s = aggregate([rec], {})
  assert.equal(s.git.commits, 0)
  assert.equal(s.git.unverified, 1)
})

test('stats can be scoped to a date range', () => {
  const rec = newRecord(normalizeHook('claude', hook('SessionStart'), T0))
  for (const [day, n] of [[0, 1], [1, 2], [5, 4], [20, 8]]) {
    for (let i = 0; i < n; i++) reduce(rec, normalizeHook('claude', hook('UserPromptSubmit'), T0 + day * 86_400_000 + i * 1000))
  }
  withZone(0, () => {
    assert.equal(aggregate([rec], { since: '2026-11-23', until: '2026-11-23' }).prompts, 1)
    assert.equal(aggregate([rec], { since: '2026-11-23', until: '2026-11-29' }).prompts, 7)
    assert.equal(aggregate([rec], {}).prompts, 15)
  })
})

test('nothing sensitive reaches the record', () => {
  const rec = play('claude', [
    ['UserPromptSubmit', { prompt: 'my password is hunter2' }],
    ['PreToolUse', { tool_name: 'Bash', tool_input: { command: 'echo TOKEN=sk-live-123' }, tool_use_id: 'z' }],
    ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'echo TOKEN=sk-live-123' }, tool_use_id: 'z', tool_response: { stdout: 'TOKEN=sk-live-123' } }],
    ['PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'C:\\Users\\me\\secrets\\.env', new_string: 'API_KEY=abc' }, tool_use_id: 'y', tool_response: {} }],
  ])
  const text = JSON.stringify(rec)
  for (const secret of ['hunter2', 'sk-live-123', 'secrets', '.env', 'API_KEY', 'password']) assert.ok(!text.includes(secret), secret)
})

test('Codex 0.171 sends PreToolUse but no PostToolUse: its tool calls are counted when the turn ends, with an unknown outcome', () => {
  const pre = (name, id, input) => ['PreToolUse', { tool_name: name, tool_input: input, tool_use_id: id }]
  const rec = play('codex', [
    'SessionStart', 'UserPromptSubmit',
    pre('Bash', 'c1', { command: 'echo hi' }),
    pre('Bash', 'c2', { command: 'npm test' }),
    pre('apply_patch', 'c3', { command: '*** Begin Patch\n*** Add File: a.txt\n+x\n*** End Patch' }),
    'Stop',
  ])
  const s = total(rec)
  assert.equal(s.tools.total, 3, 'the three calls are counted')
  assert.equal(s.tools.ok, 0)
  assert.equal(s.tools.failed, 0)
  assert.equal(s.tools.unknown, 3, 'and none is said to have succeeded or failed')
  assert.equal(s.tools.byCategory.shell, 2)
  assert.equal(s.tools.byCategory.edit, 1)
  assert.equal(s.tests.run, 0, 'a test run is not claimed without its result')
  assert.equal(s.turns, 1)
  // A host that does send the completion is counted once, with its real outcome.
  const full = play('codex', [
    'UserPromptSubmit',
    pre('Bash', 'd1', { command: 'echo hi' }),
    ['PostToolUse', { tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_use_id: 'd1', tool_response: 'Exit code: 0' }],
    'Stop',
  ])
  assert.equal(total(full).tools.total, 1)
  assert.equal(total(full).tools.ok, 1)
  // Claude Code reports every completion, so nothing is counted at the end of a turn there.
  const claude = play('claude', ['UserPromptSubmit', pre('Bash', 'k1', { command: 'sleep 5' }), 'Stop'])
  assert.equal(total(claude).tools.total, 0, 'an interrupted Claude call is not made up')
  // Many calls in one turn: none is lost when the in-flight list is full.
  const many = play('codex', ['UserPromptSubmit', ...Array.from({ length: 20 }, (_, i) => pre('Read', 'm' + i, { file_path: 'a' + i })), 'Stop'])
  assert.equal(total(many).tools.total, 20)
})
