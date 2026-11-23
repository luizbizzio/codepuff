// Local-calendar helpers. A "day" is a local calendar date written YYYY-MM-DD.
//
// Day keys are computed from the local UTC offset *at that instant*, so a DST change never shifts a
// day, and a day is never derived from a UTC date. Arithmetic on day keys (add, diff, weekday) is done
// on the calendar date alone, in UTC, so it is immune to DST as well.
//
// `tz.offset` can be replaced by tests (or a host that must not trust the process time zone).

export const tz = {
  /** Local offset from UTC in minutes at the instant `ms` (e.g. -180 for UTC-3). */
  offset: ms => -new Date(ms).getTimezoneOffset(),
}

const pad = n => String(n).padStart(2, '0')
const DAY_MS = 86_400_000

export const isDayKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toUtcDay(value) !== undefined

function toUtcDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const back = new Date(t)
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? Math.round(t / DAY_MS) : undefined
}

/** The local calendar date of an instant. */
export function dayKey(ms) {
  const shifted = new Date(ms + tz.offset(ms) * 60_000)
  return shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate())
}

export function addDays(key, count) {
  const n = toUtcDay(key)
  if (n === undefined) throw new RangeError('not a day key: ' + key)
  const d = new Date((n + count) * DAY_MS)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a, b) {
  const x = toUtcDay(a)
  const y = toUtcDay(b)
  if (x === undefined || y === undefined) throw new RangeError('not a day key: ' + a + ' / ' + b)
  return y - x
}

/** 0 = Sunday. */
export const weekdayOf = key => new Date((toUtcDay(key) ?? 0) * DAY_MS).getUTCDay()

/** The last `count` days ending at `today`, oldest first. */
export const lastDays = (today, count) => Array.from({ length: count }, (_, i) => addDays(today, i - count + 1))

/**
 * Current and longest run of consecutive active days.
 * The current streak is alive when the last active day is today or yesterday (today may simply not have
 * started yet); it is 0 otherwise.
 * @param {Iterable<string>} days active day keys
 * @param {string} today
 */
export function streaks(days, today) {
  const sorted = [...new Set([...days].filter(isDayKey))].sort()
  if (sorted.length === 0) return { current: 0, longest: 0, last: undefined, total: 0 }
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    run = daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  const last = sorted[sorted.length - 1]
  let current = 0
  if (daysBetween(last, today) <= 1 && daysBetween(last, today) >= 0) {
    current = 1
    for (let i = sorted.length - 2; i >= 0 && daysBetween(sorted[i], sorted[i + 1]) === 1; i--) current++
  }
  return { current, longest, last, total: sorted.length }
}
