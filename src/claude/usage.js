// The plan's usage, as the host reports it, turned into "is the pet tired": the worst rate-limit window that has not reset yet.

/** The pet looks tired from this share of a plan window (or spending limit) being used. */
export const TIRED_AT = 80
const WINDOW_NAMES = { five_hour: '5-hour limit', seven_day: 'weekly limit', spend_limit: 'spending limit' }

/** The sound moment of each plan window that matters. */
const RESET_MOMENT = { five_hour: 'reset5h', seven_day: 'resetWeek' }
export const RESET_TEXT = { reset5h: 'Your 5-hour limit has reset.', resetWeek: 'Your weekly limit has reset.' }

/**
 * The windows that reset between two readings of the usage: its time ran out and a fresh window began (the reset time moved
 * later), or the share used fell by a lot. A window that was not used (nothing below 1%) has nothing to announce.
 * @returns {('reset5h' | 'resetWeek')[]}
 */
export function resetsBetween(before, after, at) {
  const out = []
  if (!before || !after) return out
  for (const limit of after.limits) {
    const moment = RESET_MOMENT[limit.kind]
    const was = before.limits.find(item => item.kind === limit.kind)
    if (!moment || !was || typeof was.percentUsed !== 'number' || typeof limit.percentUsed !== 'number' || was.percentUsed < 1) continue
    const ended = was.resetsAt && Date.parse(was.resetsAt) <= at + 120_000
    const newer = limit.resetsAt && was.resetsAt && Date.parse(limit.resetsAt) > Date.parse(was.resetsAt) + 60_000
    const fell = limit.percentUsed + 10 <= was.percentUsed
    if (fell || (limit.percentUsed < was.percentUsed && (ended || newer)) || (newer && ended)) out.push(moment)
  }
  return out
}

const PLAN_LABEL = { five_hour: '5h', seven_day: 'week', spend_limit: 'spend' }

/**
 * The plan's windows for drawing as bars: how much of each is used and how long until it resets. A window that has already reset
 * is left out (its figure is old).
 * @returns {{ id: string, label: string, percent: number, resetsInMs: number }[]}
 */
export function planWindows(usage, at) {
  if (!usage) return []
  return usage.limits
    .filter(limit => PLAN_LABEL[limit?.kind] && typeof limit.percentUsed === 'number' && !(limit.resetsAt && Date.parse(limit.resetsAt) < at))
    .map(limit => ({ id: limit.kind, label: PLAN_LABEL[limit.kind], percent: Math.max(0, Math.min(100, Math.round(limit.percentUsed))), resetsInMs: limit.resetsAt ? Math.max(0, Date.parse(limit.resetsAt) - at) : 0 }))
}

export function tiredOf(usage, at) {
  if (!usage) return null
  let worst = null
  for (const limit of usage.limits) {
    if (typeof limit?.percentUsed !== 'number') continue
    if (limit.resetsAt && Date.parse(limit.resetsAt) < at) continue // that window has already reset
    if (!worst || limit.percentUsed > worst.percentUsed) worst = limit
  }
  if (!worst || worst.percentUsed < TIRED_AT) return null
  const percent = Math.round(worst.percentUsed)
  const resets = worst.resetsAt ? Math.max(0, Date.parse(worst.resetsAt) - at) : 0
  return { percent, window: WINDOW_NAMES[worst.kind] ?? 'plan limit', kind: worst.kind, resetsInMs: resets, exhausted: percent >= 95 }
}
