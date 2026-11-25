import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHook, toolPayload } from '../src/core/normalize.js'
import { newRecord, reduce } from '../src/core/session.js'
import { stateOf } from '../src/core/petstate.js'

// Claude Code's `classic.PreToolUse` delivers the tool-call envelope ({ tool, tool_use_id, ...arguments }), not the
// { tool_name, tool_input } payload of its other hooks. A call in flight must still show its own state.

const NOW = 1_800_000_000_000

function inFlight(envelope) {
  const ev = normalizeHook('claude', { ...toolPayload(envelope), hook_event_name: 'PreToolUse', session_id: 's1', cwd: '/work/app' }, NOW)
  const rec = newRecord(ev)
  reduce(rec, { kind: 'turn_start', at: NOW })
  reduce(rec, ev)
  return stateOf(rec, NOW + 100).state
}

test('a tool call in flight shows what it is doing', () => {
  assert.equal(inFlight({ tool: 'Read', tool_use_id: 'a1', file_path: '/work/app/a.js' }), 'reading')
  assert.equal(inFlight({ tool: 'Grep', tool_use_id: 'a2', pattern: 'x' }), 'searching')
  assert.equal(inFlight({ tool: 'Glob', tool_use_id: 'a3', pattern: '*.js' }), 'searching')
  assert.equal(inFlight({ tool: 'Edit', tool_use_id: 'a4', file_path: '/work/app/a.js', old_string: 'a', new_string: 'b' }), 'coding')
  assert.equal(inFlight({ tool: 'Write', tool_use_id: 'a5', file_path: '/work/app/a.js', content: 'x' }), 'coding')
  assert.equal(inFlight({ tool: 'Bash', tool_use_id: 'a6', command: 'npm test' }), 'testing')
  assert.equal(inFlight({ tool: 'Bash', tool_use_id: 'a7', command: 'git commit -m x' }), 'git')
  assert.equal(inFlight({ tool: 'Bash', tool_use_id: 'a8', command: 'node build.js' }), 'running')
  assert.equal(inFlight({ tool: 'WebFetch', tool_use_id: 'a9', url: 'https://example.com' }), 'web')
  assert.equal(inFlight({ tool: 'Agent', tool_use_id: 'b1', prompt: 'x' }), 'delegating')
  assert.equal(inFlight({ tool: 'TodoWrite', tool_use_id: 'b2', todos: [] }), 'planning')
  assert.equal(inFlight({ tool: 'mcp__server__thing', tool_use_id: 'b3' }), 'mcp')
})

test('a payload already in the usual shape is left as it is, and nothing but the arguments reaches tool_input', () => {
  const usual = { tool_name: 'Read', tool_input: { file_path: 'a' }, tool_use_id: 'x' }
  assert.equal(toolPayload(usual), usual)
  const made = toolPayload({ tool: 'Bash', tool_use_id: 'x', command: 'ls', consent: 'c', requestMeta: {}, agentId: 'sub-1' })
  assert.deepEqual(made, { tool_name: 'Bash', tool_use_id: 'x', tool_input: { command: 'ls' }, agent_id: 'sub-1' })
  assert.deepEqual(toolPayload(undefined), {})
})
