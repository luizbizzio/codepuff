// Turning statistics into the rows people read. One place decides what is shown, so the terminal, the web
// view and the Claude pane never disagree, and "Unavailable" is applied in exactly one spot. Every word comes from the active
// language's catalog (see i18n/), so these functions answer in whatever language is set.

import { formatNumber, t } from './i18n/index.js'

/** "2026-11-24" as "Nov 24" (empty for anything that is not a day key). */
export function shortDay(key) {
  const match = /^[0-9]{4}-([0-9]{2})-([0-9]{2})$/.exec(String(key))
  const month = match ? Number(match[1]) : 0
  return match && month >= 1 && month <= 12 ? t('date.short', { month: t('month.' + month), day: Number(match[2]) }) : ''
}

export function duration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return t('duration.none')
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return t('duration.lt1')
  if (minutes < 60) return t('duration.min', { n: minutes })
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 100) return t('duration.hm', { h: hours, m: String(rest).padStart(2, '0') })
  return t('duration.h', { h: hours })
}

/** An amount in US dollars as the host's `/cost` counts it, told as an estimate ("≈ $1.23"), or plain ("$1.23") where the place already says
 *  it is one; the decimal sign and the symbol follow the language. */
export function usd(amount, approx = true) {
  const cents = Math.max(0, Math.round((Number.isFinite(amount) ? amount : 0) * 100))
  const text = n(Math.floor(cents / 100)) + t('num.decimal') + String(cents % 100).padStart(2, '0')
  return (approx ? '≈ ' : '') + t('stats.cost.value', { usd: text })
}

/** A number of minutes, short: "45 min", "1h", "1h 30m". */
export const minutesText = minutes => (minutes >= 60 && minutes % 60 === 0 ? t('duration.h', { h: minutes / 60 }) : duration(minutes * 60_000))

/** How long until a plan window resets: minutes, hours and minutes, and from a day on days and hours ("6d 9h", never "153h"). */
export function resetIn(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return t('duration.none')
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return t('duration.lt1')
  if (minutes < 60) return t('duration.min', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('duration.hm', { h: hours, m: String(minutes % 60).padStart(2, '0') })
  return t('duration.dh', { d: Math.floor(hours / 24), h: hours % 24 })
}

export function ago(at, now = Date.now()) {
  if (!at) return t('ago.never')
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 10) return t('ago.now')
  if (seconds < 60) return t('ago.s', { n: seconds })
  if (seconds < 3600) return t('ago.min', { n: Math.round(seconds / 60) })
  if (seconds < 86_400) return t('ago.h', { n: Math.round(seconds / 3600) })
  return t('ago.d', { n: Math.round(seconds / 86_400) })
}

const n = value => formatNumber(value ?? 0)

/** Lines added or removed in observed commits. Never invented: missing data reads "Unavailable". */
export function lines(stats, field) {
  const g = stats.git
  if (g.commits === 0) return '—'
  if (g.withLines === 0) return t('stats.unavailable')
  const value = n(g[field])
  return g.withoutLines > 0 ? `${value} ${t('stats.linesWithout', { n: g.withoutLines })}` : value
}

/**
 * The rows of the statistics view, in display order.
 * @param {ReturnType<import('./aggregate.js').emptyStats>} s
 */
export function statRows(s) {
  const commits = s.git.unverified > 0 ? t('stats.commitsUnverified', { commits: n(s.git.commits), n: s.git.unverified }) : n(s.git.commits)
  const x = s.tests
  const testNote = x.run === 0 ? '' : t(x.unknown ? 'stats.testNoteUnknown' : 'stats.testNote', { passed: x.passed, failed: x.failed, unknown: x.unknown })
  const failures = s.modelFailures > 0 ? [{ id: 'modelFailures', label: t('stats.row.modelFailures'), value: n(s.modelFailures), hint: t('stats.row.modelFailures.hint') }] : []
  return [
    { group: t('stats.group.conversation'), id: 'prompts', label: t('stats.row.prompts'), value: n(s.prompts) },
    { id: 'turns', label: t('stats.row.turns'), value: n(s.turns) },
    { id: 'tools', label: t('stats.row.tools'), value: n(s.tools.total) },
    { id: 'toolsOk', label: t('stats.row.toolsOk'), value: s.tools.unknown ? t('stats.toolsUnknown', { ok: n(s.tools.ok), failed: n(s.tools.failed), n: n(s.tools.unknown) }) : `${n(s.tools.ok)} / ${n(s.tools.failed)}` },
    { id: 'sessions', label: t('stats.row.sessions'), value: n(s.sessions.observed) },
    { id: 'active', label: t('stats.row.active'), value: n(s.sessions.active) },
    { id: 'projects', label: t('stats.row.projects'), value: n(s.projects) },
    ...failures,
    { group: t('stats.group.coding'), id: 'files', label: t('stats.row.files'), value: n(s.files) },
    { id: 'tests', label: t('stats.row.tests'), value: n(x.run) + testNote },
    { id: 'commits', label: t('stats.row.commits'), value: commits },
    { id: 'added', label: t('stats.row.added'), value: lines(s, 'added') },
    { id: 'removed', label: t('stats.row.removed'), value: lines(s, 'removed') },
    { id: 'time', label: t('stats.row.time'), value: duration(s.activeMs), hint: t('stats.row.time.hint') },
  ]
}

const CATEGORIES = ['read', 'search', 'edit', 'shell', 'web', 'agent', 'plan', 'mcp', 'other']
const categoryLabel = id => (CATEGORIES.includes(id) ? t('stats.cat.' + id) : id)

/** The names of the agents. "Combined" is a word and follows the language; the products' names do not. */
export const AGENT_LABELS = Object.freeze({
  claude: 'Claude Code',
  codex: 'Codex',
  get all() { return t('agent.all') },
})

/**
 * The few numbers worth a glance, as tiles (the full list of rows is behind "details"). Each has a short label and a note.
 * @param {ReturnType<import('./aggregate.js').emptyStats>} s
 */
export function statTiles(s) {
  const x = s.tests
  const settled = s.tools.ok + s.tools.failed
  const testNotes = x.run ? [t('stats.tile.passed', { n: n(x.passed) }), x.failed ? t('stats.tile.failed', { n: n(x.failed) }) : '', x.unknown ? t('stats.tile.unconfirmed', { n: n(x.unknown) }) : ''].filter(Boolean).join(t('stats.tile.sep')) : ''
  return [
    { id: 'prompts', label: t('stats.tile.prompts'), value: n(s.prompts), note: s.sessions.observed ? t('unit.session', { n: s.sessions.observed }) : '' },
    { id: 'tools', label: t('stats.tile.tools'), value: n(s.tools.total), note: settled ? t('stats.tile.succeeded', { pct: Math.round((s.tools.ok / settled) * 100) }) : '' },
    { id: 'files', label: t('stats.tile.files'), value: n(s.files), note: '' },
    { id: 'commits', label: t('stats.tile.commits'), value: n(s.git.commits), note: s.git.commits && s.git.withLines ? `+${n(s.git.added)} −${n(s.git.removed)}` : '' },
    // The number of runs, and how they ended: a run whose result could not be read (a piped command hides its exit code) is
    // "unconfirmed", not a pass and not a failure.
    { id: 'tests', label: t('stats.tile.tests'), value: n(x.run), note: testNotes },
    { id: 'time', label: t('stats.tile.time'), value: duration(s.activeMs), note: '' },
    // How many subagents the agent started (the helpers that appear next to the pet while they work).
    { id: 'subagents', label: t('stats.cat.agent'), value: n(s.subagents), note: '' },
  ]
}

/** How the tool calls split by kind, biggest first (at most `limit`), each with its share of the largest for drawing a bar. */
export function statBars(s, limit = 6) {
  const list = Object.entries(s.tools.byCategory).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, limit)
  const top = Math.max(1, ...list.map(([, count]) => count))
  return list.map(([id, count]) => ({ id, label: categoryLabel(id), count, share: count / top }))
}
