import test from 'node:test'
import assert from 'node:assert/strict'
import { focus, labelFor, stateOf, STATES, WINDOWS } from '../src/core/petstate.js'
import { animation, frameAt, STILL_STATES } from '../src/core/art/anim.js'
import { newRecord, reduce } from '../src/core/session.js'
import { normalizeHook } from '../src/core/normalize.js'
import { bashFail, bashOk, hook, T0 } from './helpers.js'

/** Builds a record from hook payloads at explicit offsets (ms from T0) so tests control time exactly. */
function timeline(agent, steps, session = 's1') {
  let rec
  for (const [offset, name, extra = {}] of steps) {
    const ev = normalizeHook(agent, hook(name, { session_id: session, ...extra }), T0 + offset)
    if (!ev) continue
    rec ??= newRecord(ev)
    reduce(rec, ev)
  }
  return rec
}
const tool = (id, name, input) => ({ tool_name: name, tool_input: input, tool_use_id: id })
const state = (rec, offset) => stateOf(rec, T0 + offset).state

test('a new session with nothing happening is idle; an old silent one is resting', () => {
  const rec = timeline('claude', [[0, 'SessionStart']])
  assert.equal(state(rec, 100), 'idle')
  assert.equal(state(rec, WINDOWS.stale + 1000), 'idle')
})

test('each tool shows the matching activity while it runs', () => {
  const cases = [
    ['Read', { file_path: 'a' }, 'reading'], ['Grep', { pattern: 'x' }, 'searching'], ['Edit', { file_path: 'a' }, 'coding'],
    ['Bash', { command: 'make' }, 'running'], ['Bash', { command: 'npm test' }, 'testing'], ['WebFetch', {}, 'web'],
    ['Task', {}, 'delegating'], ['TodoWrite', {}, 'planning'], ['mcp__x__y', {}, 'mcp'],
  ]
  for (const [name, input, expected] of cases) {
    const rec = timeline('claude', [[0, 'UserPromptSubmit'], [500, 'PreToolUse', tool('t', name, input)]])
    assert.equal(state(rec, 1000), expected, name + ' ' + JSON.stringify(input))
  }
})

test('thinking only appears while a turn runs with no tool in flight', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit']])
  assert.equal(state(rec, 1000), 'thinking')
  assert.match(stateOf(rec, T0 + 1000).label, /Working on a response/)
  assert.doesNotMatch(stateOf(rec, T0 + 1000).label, /think|reason|idea/i, 'the label never claims to know the model\'s thoughts')
  const idle = timeline('claude', [[0, 'SessionStart']])
  assert.notEqual(state(idle, 1000), 'thinking')
})

test('a confirmed passing test run celebrates briefly, then settles', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [100, 'PreToolUse', tool('t', 'Bash', { command: 'npm test' })], [2000, 'PostToolUse', { ...tool('t', 'Bash', { command: 'npm test' }), tool_response: {} }]])
  assert.equal(state(rec, 2500), 'success')
  assert.equal(stateOf(rec, T0 + 2500).label, 'Tests passed')
  assert.equal(state(rec, 2000 + WINDOWS.success + 100), 'thinking', 'the turn is still running afterwards')
})

test('an unconfirmed result never celebrates', () => {
  const rec = timeline('codex', [[0, 'UserPromptSubmit'], [2000, 'PostToolUse', { ...tool('t', 'Bash', { command: 'npm test' }), tool_response: 'done' }]])
  assert.notEqual(state(rec, 2500), 'success')
})

test('a real failure shows surprise, then investigation when the agent starts looking around', () => {
  const rec = timeline('claude', [
    [0, 'UserPromptSubmit'],
    [100, 'PreToolUse', tool('t', 'Bash', { command: 'node x.js' })],
    [1000, 'PostToolUseFailure', { ...tool('t', 'Bash', { command: 'node x.js' }), error: 'Exit code 1\nboom' }],
  ])
  assert.equal(state(rec, 1500), 'error')
  assert.equal(stateOf(rec, T0 + 1500).label, 'A tool failed')
  reduce(rec, normalizeHook('claude', hook('PreToolUse', tool('r', 'Read', { file_path: 'x.js' })), T0 + 1000 + WINDOWS.error + 500))
  assert.equal(state(rec, 1000 + WINDOWS.error + 800), 'investigating')
  reduce(rec, normalizeHook('claude', hook('PreToolUse', tool('e', 'Edit', { file_path: 'x.js' })), T0 + 1000 + WINDOWS.error + 900))
  assert.equal(state(rec, 1000 + WINDOWS.error + 1000), 'coding', 'a different activity is not "investigating"')
})

test('a failing test run is labelled as such', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [1000, 'PostToolUseFailure', { ...tool('t', 'Bash', { command: 'pytest' }), error: 'Exit code 1' }]])
  assert.equal(stateOf(rec, T0 + 1500).label, 'Tests failed')
})

test('"no match" from grep is not an error', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [1000, 'PostToolUseFailure', { ...tool('t', 'Bash', { command: 'grep -r foo .' }), error: 'Exit code 1' }]])
  assert.notEqual(state(rec, 1500), 'error')
})

test('permission requests take over until the agent moves on', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [500, 'PermissionRequest', tool('t', 'Bash', { command: 'rm -rf x' })]])
  assert.equal(state(rec, 1000), 'permission')
  assert.equal(stateOf(rec, T0 + 1000).label, 'Waiting for permission')
  reduce(rec, normalizeHook('claude', hook('PreToolUse', tool('t', 'Bash', { command: 'rm -rf x' })), T0 + 5000))
  assert.equal(state(rec, 5500), 'running')
  const ask = timeline('claude', [[0, 'UserPromptSubmit'], [500, 'PreToolUse', tool('q', 'AskUserQuestion', {})]])
  assert.equal(stateOf(ask, T0 + 1000).label, 'Waiting for your answer')
})

test('a denied request ends the wait', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [500, 'PermissionRequest', tool('t', 'Bash', { command: 'x' })], [900, 'PermissionDenied', tool('t', 'Bash', { command: 'x' })]])
  assert.notEqual(state(rec, 1000), 'permission')
})

test('finishing a turn shows completion, then waiting for the next prompt, then rest', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [3000, 'Stop']])
  assert.equal(state(rec, 3500), 'finished')
  assert.equal(state(rec, 3000 + WINDOWS.finished + 500), 'waiting')
  assert.equal(stateOf(rec, T0 + 3000 + WINDOWS.finished + 500).label, 'Waiting for your next prompt')
  assert.equal(state(rec, 3000 + WINDOWS.waiting + 500), 'idle')
})

test('subagents appear as helpers only while they are really running', () => {
  const rec = timeline('claude', [[0, 'UserPromptSubmit'], [100, 'SubagentStart', { agent_id: 'a' }], [200, 'SubagentStart', { agent_id: 'b' }]])
  assert.equal(stateOf(rec, T0 + 500).helpers, 2)
  assert.equal(stateOf(rec, T0 + 500).state, 'delegating')
  assert.match(stateOf(rec, T0 + 500).label, /2 subagents/)
  reduce(rec, normalizeHook('claude', hook('SubagentStop', { agent_id: 'a' }), T0 + 800))
  reduce(rec, normalizeHook('claude', hook('SubagentStop', { agent_id: 'b' }), T0 + 900))
  assert.equal(stateOf(rec, T0 + 1000).helpers, 0)
  const many = timeline('claude', [[0, 'UserPromptSubmit'], ...Array.from({ length: 6 }, (_, i) => [10 * i, 'SubagentStart', { agent_id: 'x' + i }])])
  assert.equal(stateOf(many, T0 + 500).helpers, 3, 'at most three are drawn')
})

test('an ended session is disconnected', () => {
  const rec = timeline('codex', [[0, 'SessionStart'], [100, 'UserPromptSubmit'], [200, 'SessionEnd']])
  assert.equal(state(rec, 300), 'disconnected')
})

test('a tool that never reports back stops being shown after a while', () => {
  const rec = timeline('codex', [[0, 'UserPromptSubmit'], [100, 'PreToolUse', tool('t', 'Bash', { command: 'make' })]])
  assert.equal(state(rec, 5000), 'running')
  assert.notEqual(state(rec, WINDOWS.tool + 5000), 'running')
})

test('competing sessions: a deterministic priority rule, and the winner is identified', () => {
  const now = T0 + 10_000
  const busy = timeline('claude', [[0, 'SessionStart'], [5000, 'UserPromptSubmit'], [6000, 'PreToolUse', tool('t', 'Edit', { file_path: 'a' })]], 'busy')
  const waiting = timeline('codex', [[0, 'SessionStart'], [1000, 'UserPromptSubmit'], [2000, 'Stop']], 'quiet')
  const asking = timeline('codex', [[0, 'SessionStart'], [2000, 'UserPromptSubmit'], [3000, 'PermissionRequest', tool('p', 'Bash', { command: 'x' })]], 'asking')
  const { current, others } = focus([busy, waiting, asking], now)
  assert.equal(current.state, 'permission', 'needing the user outranks everything')
  assert.equal(current.agent, 'codex')
  assert.equal(current.session, 'asking')
  assert.equal(others.length, 2)
  assert.deepEqual(others.map(item => item.session), ['busy', 'quiet'])
  // The same input in any order gives the same answer.
  assert.equal(focus([asking, waiting, busy], now).current.session, 'asking')
  assert.equal(focus([waiting, busy], now).current.session, 'busy', 'live work outranks a session that merely finished')
})

test('ties are broken by recency, then agent, then id', () => {
  const now = T0 + 10_000
  const make = (agent, session, at) => timeline(agent, [[0, 'SessionStart'], [at, 'UserPromptSubmit']], session)
  assert.equal(focus([make('claude', 'a', 1000), make('claude', 'b', 2000)], now).current.session, 'b')
  assert.equal(focus([make('codex', 'z', 2000), make('claude', 'y', 2000)], now).current.agent, 'claude')
  assert.equal(focus([make('claude', 'b', 2000), make('claude', 'a', 2000)], now).current.session, 'a')
})

test('with no live session the pet is disconnected, and says so', () => {
  const none = focus([], T0)
  assert.equal(none.current.state, 'disconnected')
  assert.equal(none.current.label, 'No agent connected')
  const old = timeline('claude', [[0, 'SessionStart'], [1000, 'UserPromptSubmit']])
  assert.equal(focus([old], T0 + WINDOWS.stale + 5000).current.state, 'disconnected')
})

test('every state has a label and an animation, and every animation is well formed', () => {
  for (const name of STATES) assert.ok(labelFor(name).length > 0, name)
  for (const name of STILL_STATES) {
    const anim = animation(name)
    assert.ok(anim.frames.length >= 1)
    assert.ok(anim.total > 0)
    for (const item of anim.frames) assert.ok(item.d >= 50, name + ' frame too short')
  }
  for (const name of STATES) assert.ok(STILL_STATES.includes(name) || ['idle'].includes(name) || animation(name), name)
})

test('frames are deterministic, loop, and report when they change', () => {
  const anim = animation('coding')
  const a = frameAt(anim, 0)
  assert.equal(a.index, 0)
  assert.ok(a.until > 0 && a.until <= anim.frames[0].d)
  assert.equal(frameAt(anim, anim.total).index, 0, 'loops')
  assert.equal(frameAt(anim, 123_456).index, frameAt(anim, 123_456).index)
  const petted = animation('petted')
  assert.equal(frameAt(petted, 999_999).until, Infinity, 'a one-shot reaction holds its last frame')
})

test('no state is a busy loop: the fastest frame is at least 70 ms', () => {
  for (const name of STILL_STATES) for (const item of animation(name).frames) assert.ok(item.d >= 70, name)
})
