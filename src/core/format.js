// Turning statistics into the rows people read. One place decides what is shown, so the terminal, the web
// view and the Claude pane never disagree, and "Unavailable" is applied in exactly one spot.

export const UNAVAILABLE = 'Unavailable'

export function duration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return minutes + ' min'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 100) return hours + 'h ' + String(rest).padStart(2, '0') + 'm'
  return hours + 'h'
}

export function ago(at, now = Date.now()) {
  if (!at) return 'never'
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return seconds + 's ago'
  if (seconds < 3600) return Math.round(seconds / 60) + ' min ago'
  if (seconds < 86_400) return Math.round(seconds / 3600) + ' h ago'
  return Math.round(seconds / 86_400) + ' d ago'
}

const n = value => (value ?? 0).toLocaleString('en-US')

/** Lines added or removed in observed commits. Never invented: missing data reads "Unavailable". */
export function lines(stats, field) {
  const g = stats.git
  if (g.commits === 0) return '—'
  if (g.withLines === 0) return UNAVAILABLE
  const value = n(g[field])
  return g.withoutLines > 0 ? `${value} (${g.withoutLines} commit${g.withoutLines === 1 ? '' : 's'} without data)` : value
}

/**
 * The rows of the statistics view, in display order.
 * @param {ReturnType<import('./aggregate.js').emptyStats>} s
 */
export function statRows(s) {
  const commits = s.git.unverified > 0 ? `${n(s.git.commits)} (+${s.git.unverified} not verifiable)` : n(s.git.commits)
  const t = s.tests
  const testNote = t.run === 0 ? '' : ` — ${t.passed} passed, ${t.failed} failed` + (t.unknown ? `, ${t.unknown} unknown` : '')
  const failures = s.modelFailures > 0 ? [{ id: 'modelFailures', label: 'Model requests that failed', value: n(s.modelFailures), hint: 'Reported by Codex (for example a usage limit).' }] : []
  return [
    { group: 'Conversation', id: 'prompts', label: 'Prompts submitted', value: n(s.prompts) },
    { id: 'turns', label: 'Agent turns completed', value: n(s.turns) },
    { id: 'tools', label: 'Tool calls', value: n(s.tools.total) },
    { id: 'toolsOk', label: 'Succeeded / failed', value: `${n(s.tools.ok)} / ${n(s.tools.failed)}` + (s.tools.unknown ? ` (${n(s.tools.unknown)} unknown)` : '') },
    { id: 'sessions', label: 'Sessions observed', value: n(s.sessions.observed) },
    { id: 'active', label: 'Active sessions now', value: n(s.sessions.active) },
    { id: 'projects', label: 'Projects', value: n(s.projects) },
    ...failures,
    { group: 'Coding', id: 'files', label: 'Files changed', value: n(s.files) },
    { id: 'tests', label: 'Tests executed', value: n(t.run) + testNote },
    { id: 'commits', label: 'Git commits observed', value: commits },
    { id: 'added', label: 'Lines added in those commits', value: lines(s, 'added') },
    { id: 'removed', label: 'Lines deleted in those commits', value: lines(s, 'removed') },
    { id: 'time', label: 'Estimated agent time', value: duration(s.activeMs), hint: 'Time a turn was running; gaps over 10 minutes are not counted.' },
  ]
}

export const CATEGORY_LABELS = { read: 'Read', search: 'Search', edit: 'Edit', shell: 'Shell', web: 'Web', agent: 'Subagents', plan: 'Plan', mcp: 'MCP', other: 'Other' }

export const AGENT_LABELS = { claude: 'Claude Code', codex: 'Codex', all: 'Combined' }

/**
 * The few numbers worth a glance, as tiles (the full list of rows is behind "details"). Each has a short label and a note.
 * @param {ReturnType<import('./aggregate.js').emptyStats>} s
 */
export function statTiles(s) {
  const t = s.tests
  const settled = s.tools.ok + s.tools.failed
  return [
    { id: 'prompts', label: 'Prompts', value: n(s.prompts), note: s.sessions.observed ? `${n(s.sessions.observed)} session${s.sessions.observed === 1 ? '' : 's'}` : '' },
    { id: 'tools', label: 'Tool calls', value: n(s.tools.total), note: settled ? `${Math.round((s.tools.ok / settled) * 100)}% succeeded` : '' },
    { id: 'files', label: 'Files changed', value: n(s.files), note: '' },
    { id: 'commits', label: 'Commits', value: n(s.git.commits), note: s.git.commits && s.git.withLines ? `+${n(s.git.added)} −${n(s.git.removed)}` : '' },
    { id: 'tests', label: 'Tests passed', value: n(t.passed), note: t.run ? `of ${n(t.run)} run` : '' },
    { id: 'time', label: 'Agent time', value: duration(s.activeMs), note: '' },
  ]
}

/** How the tool calls split by kind, biggest first (at most `limit`), each with its share of the largest for drawing a bar. */
export function statBars(s, limit = 6) {
  const list = Object.entries(s.tools.byCategory).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, limit)
  const top = Math.max(1, ...list.map(([, count]) => count))
  return list.map(([id, count]) => ({ id, label: CATEGORY_LABELS[id] ?? id, count, share: count / top }))
}
