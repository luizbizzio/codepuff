// Shared test helpers: a clock, event builders and a temporary data folder.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newRecord, reduce } from '../src/core/session.js'
import { normalizeHook } from '../src/core/normalize.js'
import { tz } from '../src/core/days.js'

export const T0 = Date.UTC(2026, 10, 23, 15, 0, 0) // 2026-11-23 15:00 UTC
export const MIN = 60_000

export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'codepuff-test-'))
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) }
}

/** Runs `fn` with a fixed local time zone (offset in minutes, or a function of the instant). */
export function withZone(offset, fn) {
  const saved = tz.offset
  tz.offset = typeof offset === 'function' ? offset : () => offset
  try { return fn() } finally { tz.offset = saved }
}

/** A hook payload in the shape both hosts use. */
export const hook = (name, extra = {}) => ({ hook_event_name: name, session_id: 's1', cwd: 'C:\\work\\demo', ...extra })

/** Applies host hook payloads to a fresh record, each `step` ms after the previous one. */
export function play(agent, steps, { start = T0, step = 1000, session = 's1' } = {}) {
  let rec
  let at = start
  for (const item of steps) {
    const [name, extra = {}] = Array.isArray(item) ? item : [item]
    const ev = normalizeHook(agent, hook(name, { session_id: session, ...extra }), at)
    if (ev) { rec ??= newRecord(ev); reduce(rec, ev) }
    at += step
  }
  return rec
}

export const bashOk = (command, id = 't' + Math.random()) => [['PreToolUse', { tool_name: 'Bash', tool_input: { command }, tool_use_id: id }], ['PostToolUse', { tool_name: 'Bash', tool_input: { command }, tool_use_id: id, tool_response: { stdout: 'ok' } }]]
export const bashFail = (command, id = 't' + Math.random(), code = 1) => [['PreToolUse', { tool_name: 'Bash', tool_input: { command }, tool_use_id: id }], ['PostToolUseFailure', { tool_name: 'Bash', tool_input: { command }, tool_use_id: id, error: 'Exit code ' + code + '\nfailed' }]]
