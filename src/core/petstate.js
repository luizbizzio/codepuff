// From a session record to what the pet shows. Pure: the same record and the same `now` always give the
// same answer, which is what makes the behaviour testable and the animation honest.
//
// Every state below is derived from something that really happened (a tool started, a test failed, a
// permission was requested, a turn ended). Nothing is invented to look busy, and nothing here claims to
// know what the model is "thinking": `thinking` only means "a turn is running and no tool call is in
// flight", and its label says exactly that.

import { newLive } from './session.js'

export const WINDOWS = Object.freeze({
  success: 4_000,
  error: 6_000,
  investigate: 25_000,
  finished: 5_000,
  waiting: 2 * 60_000,
  /** A session not heard from for this long is shown as resting, whatever it last did. */
  stale: 15 * 60_000,
  /** A tool call that started this long ago and never finished is no longer shown as running. */
  tool: 10 * 60_000,
  subagents: 30 * 60_000,
})

export const STATES = [
  'idle', 'tired', 'thinking', 'reading', 'searching', 'coding', 'running', 'git', 'mcp', 'testing', 'web', 'delegating', 'planning',
  'success', 'error', 'investigating', 'waiting', 'permission', 'finished', 'disconnected',
]

const ACT_STATE = { read: 'reading', search: 'searching', edit: 'coding', run: 'running', git: 'git', test: 'testing', web: 'web', delegate: 'delegating', plan: 'planning', mcp: 'mcp', other: 'running', ask: 'permission' }

/** How much a state deserves the single display slot when several sessions compete (higher wins). */
export const RANK = Object.freeze({
  permission: 7, error: 6,
  thinking: 5, reading: 5, searching: 5, coding: 5, running: 5, git: 5, mcp: 5, testing: 5, web: 5, delegating: 5, planning: 5, investigating: 5,
  success: 4, finished: 3, waiting: 2, tired: 1, idle: 1, disconnected: 0,
})

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's')

export function labelFor(state, detail = {}) {
  switch (state) {
    case 'thinking': return 'Working on a response'
    case 'reading': return 'Reading files'
    case 'searching': return 'Searching the project'
    case 'coding': return 'Editing code'
    case 'running': return 'Running a command'
    case 'tired': return `Tired · ${detail.percent ?? '?'}% of the ${detail.window ?? 'plan limit'} used`
    case 'git': return 'Using git'
    case 'mcp': return 'Using a connected tool'
    case 'testing': return 'Running tests'
    case 'web': return 'Looking things up online'
    case 'delegating': return detail.helpers ? 'Working with ' + plural(detail.helpers, 'subagent') : 'Starting a subagent'
    case 'planning': return 'Updating its plan'
    case 'success': return detail.kind === 'commit' ? 'Commit made' : 'Tests passed'
    case 'error': return detail.act === 'model' ? 'The model request failed' : detail.act === 'test' ? 'Tests failed' : 'A tool failed'
    case 'investigating': return 'Looking into the failure'
    case 'waiting': return 'Waiting for your next prompt'
    case 'permission': return detail.kind === 'ask' ? 'Waiting for your answer' : 'Waiting for permission'
    case 'finished': return 'Finished'
    case 'disconnected': return detail.ended ? 'Session ended' : 'No agent connected'
    default: return 'Resting'
  }
}

/**
 * @param {any} rec a session record
 * @param {number} now
 * @returns {{ state: string, label: string, since: number, helpers: number, agent: string, session: string, project: string, running: boolean }}
 */
export function stateOf(rec, now) {
  const base = { agent: rec.agent, session: rec.sid, project: rec.pname ?? '', helpers: 0, running: false, since: rec.last }
  const live = { ...newLive(), ...(rec.live ?? {}) }
  const done = (state, detail = {}, since = rec.last) => ({ ...base, state, since, label: labelFor(state, { helpers: base.helpers, ...detail }), running: RANK[state] === 5 })

  if (rec.ended) return done('disconnected', { ended: true }, rec.ended)
  base.helpers = live.sub > 0 && now - live.sa < WINDOWS.subagents ? Math.min(live.sub, 3) : 0
  if (now - rec.last > WINDOWS.stale) return done('idle')

  const tool = [...live.tools].filter(item => now - item.t < WINDOWS.tool).sort((a, b) => b.t - a.t)[0]
  if (live.perm) return done('permission', { kind: live.pk }, live.perm)
  if (live.err && now - live.err < WINDOWS.error && !(tool && tool.t > live.err)) return done('error', { act: live.ea }, live.err)
  if (live.ok && now - live.ok < WINDOWS.success && !(tool && tool.t > live.ok)) return done('success', { kind: live.okk }, live.ok)
  if (live.te && !live.run && now - live.te < WINDOWS.finished) return done('finished', {}, live.te)
  if (tool) {
    let state = ACT_STATE[tool.a] ?? 'running'
    if ((state === 'reading' || state === 'searching') && live.err && now - live.err < WINDOWS.investigate) state = 'investigating'
    if (state === 'permission') state = 'running'
    return done(state, {}, tool.t)
  }
  if (live.run) return done(base.helpers > 0 ? 'delegating' : 'thinking', {}, live.think || live.lt || live.t0)
  if (live.te && now - live.te < WINDOWS.waiting) return done('waiting', {}, live.te)
  return done('idle')
}

const rankOf = result => RANK[result.state] ?? 1

/** The deterministic order used whenever several sessions compete for one pet. */
export function byPriority(a, b) {
  return rankOf(b) - rankOf(a) || b.last - a.last || (a.agent < b.agent ? -1 : a.agent > b.agent ? 1 : 0) || (a.session < b.session ? -1 : a.session > b.session ? 1 : 0)
}

/**
 * Chooses the one session whose activity the pet shows, and summarizes the rest.
 * Rule, in order: needs the user (permission) > a failure > live work > a celebration > waiting > resting;
 * ties go to the most recently heard-from session, then to the agent name, then to the session id.
 * Ended sessions never compete. With nothing alive the pet is `disconnected`.
 * @param {any[]} records
 * @param {number} now
 */
export function focus(records, now) {
  const states = []
  for (const rec of records) {
    if (!rec || rec.ended || !rec.live) continue
    if (now - rec.last > WINDOWS.stale) continue
    states.push({ ...stateOf(rec, now), last: rec.last })
  }
  states.sort(byPriority)
  if (states.length === 0) {
    return { current: { state: 'disconnected', label: labelFor('disconnected'), since: now, helpers: 0, agent: '', session: '', project: '', running: false, last: 0 }, others: [] }
  }
  return { current: states[0], others: states.slice(1) }
}
