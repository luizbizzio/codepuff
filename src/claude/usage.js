import { t } from '../core/i18n/index.js'

// The plan's usage, as the host reports it, turned into "is the pet tired": the worst rate-limit window that has not reset yet.

/** The pet looks tired from this share of a plan window (or spending limit) being used. */
export const TIRED_AT = 80
const WINDOW_NAMES = { five_hour: '5-hour limit', seven_day: 'weekly limit', spend_limit: 'spending limit' }

/** The sound moment of each plan window that matters. */
const RESET_MOMENT = { five_hour: 'reset5h', seven_day: 'resetWeek' }
/** The toast for a window that reset (the sound moment names the catalog key). */
export const resetText = moment => t('toast.' + moment)

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
    if (!moment || !was || !Number.isFinite(was.percentUsed) || !Number.isFinite(limit.percentUsed) || was.percentUsed < 1) continue
    const ended = was.resetsAt && Date.parse(was.resetsAt) <= at + 120_000
    const newer = limit.resetsAt && was.resetsAt && Date.parse(limit.resetsAt) > Date.parse(was.resetsAt) + 60_000
    const fell = limit.percentUsed + 10 <= was.percentUsed
    if (fell || (limit.percentUsed < was.percentUsed && (ended || newer)) || (newer && ended)) out.push(moment)
  }
  return out
}

/**
 * The windows being waited on: for each of the 5-hour and weekly limits that has been used, when it is due to reset. A reset is announced
 * when that time comes, whatever the host reports then (it may say nothing, or still show the old figure, for a while), and also when
 * the pet is opened after it. `watch` is `{ reset5h: { at, percent }, resetWeek: { at, percent } }`.
 * @returns {{ due: ('reset5h' | 'resetWeek')[], watch: object }}
 */
export function trackResets(watch, usage, at) {
  const next = {}
  const due = []
  for (const [moment, item] of Object.entries(watch ?? {})) {
    if (!RESET_MOMENT_KINDS.includes(moment) || !Number.isFinite(item?.at) || !Number.isFinite(item?.percent)) continue
    if (item.at <= at) due.push(moment)
    else next[moment] = item
  }
  for (const limit of usage?.limits ?? []) {
    const moment = RESET_MOMENT[limit?.kind]
    const ends = limit?.resetsAt ? Date.parse(limit.resetsAt) : NaN
    if (!moment || !Number.isFinite(limit.percentUsed) || limit.percentUsed < 1 || !Number.isFinite(ends) || ends <= at) continue
    const was = next[moment]
    next[moment] = { at: ends, percent: Math.max(limit.percentUsed, was && was.at === ends ? was.percent : 0) }
  }
  return { due, watch: next }
}

/** What was waited on when the pet was last open, for a window that ended since: only one that was nearly used up is worth announcing late. */
export const keepWatched = (watch, at) => Object.fromEntries(Object.entries(watch && typeof watch === 'object' ? watch : {}).filter(([, item]) => item && (item.at > at || item.percent >= TIRED_AT)))

const RESET_MOMENT_KINDS = Object.values(RESET_MOMENT)

const PLAN_KINDS = ['five_hour', 'seven_day', 'spend_limit']

/**
 * The plan's windows for drawing as bars: how much of each is used and how long until it resets. A window that has already reset
 * is left out (its figure is old).
 * @returns {{ id: string, label: string, percent: number, resetsInMs: number }[]}
 */
export function planWindows(usage, at) {
  if (!usage) return []
  return usage.limits
    .filter(limit => PLAN_KINDS.includes(limit?.kind) && Number.isFinite(limit.percentUsed) && !(limit.resetsAt && Date.parse(limit.resetsAt) < at))
    .map(limit => ({ id: limit.kind, label: t('plan.' + limit.kind), percent: Math.max(0, Math.min(100, Math.round(limit.percentUsed))), resetsInMs: limit.resetsAt ? Math.max(0, Date.parse(limit.resetsAt) - at) : 0 }))
}

export function tiredOf(usage, at) {
  if (!usage) return null
  let worst = null
  for (const limit of usage.limits) {
    if (!Number.isFinite(limit?.percentUsed)) continue
    if (limit.resetsAt && Date.parse(limit.resetsAt) < at) continue // that window has already reset
    if (!worst || limit.percentUsed > worst.percentUsed) worst = limit
  }
  if (!worst || worst.percentUsed < TIRED_AT) return null
  const percent = Math.round(worst.percentUsed)
  const resets = worst.resetsAt ? Math.max(0, Date.parse(worst.resetsAt) - at) : 0
  return { percent, window: WINDOW_NAMES[worst.kind] ?? 'plan limit', kind: worst.kind, resetsInMs: resets, exhausted: percent >= 95 }
}
