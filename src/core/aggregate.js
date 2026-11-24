// Statistics are computed, never stored: every number here is a sum over session records.
//
// Scopes
//   agent      'all' (combined) | 'claude' | 'codex'
//   session    one record only (the "current session" view)
//   range      since / until day keys (inclusive), e.g. the last 7 or 30 days
// Any combination works because counters live in per-day buckets inside each record.

import { addDays, dayKey, streaks } from './days.js'
import { CATEGORIES } from './classify.js'
import { isActiveBucket } from './session.js'

/** A session counts as active when it was heard from this recently and has not ended. */
const ACTIVE_WINDOW = 10 * 60_000

export const emptyStats = () => ({
  sessions: { observed: 0, active: 0 },
  projects: 0,
  prompts: 0,
  turns: 0,
  interrupted: 0,
  tools: { total: 0, ok: 0, failed: 0, unknown: 0, byCategory: Object.fromEntries(CATEGORIES.map(cat => [cat, 0])) },
  files: 0,
  tests: { run: 0, passed: 0, failed: 0, unknown: 0 },
  git: { commits: 0, unverified: 0, added: 0, removed: 0, files: 0, withLines: 0, withoutLines: 0 },
  subagents: 0,
  permissions: 0,
  modelFailures: 0,
  activeMs: 0,
  activeDays: 0,
})

/**
 * @param {Iterable<any>} records session records
 * @param {{ agent?: 'all' | 'claude' | 'codex', session?: { agent: string, sid: string }, since?: string, until?: string, now?: number }} [scope]
 */
export function aggregate(records, scope = {}) {
  const { agent = 'all', session, since, until, now = Date.now() } = scope
  const stats = emptyStats()
  const projects = new Set()
  const days = new Set()
  const commits = new Map()
  let cx = 0
  for (const rec of records) {
    if (!rec || typeof rec !== 'object' || !rec.days) continue
    if (agent !== 'all' && rec.agent !== agent) continue
    if (session && (rec.agent !== session.agent || rec.sid !== session.sid)) continue
    let touched = false
    for (const [day, b] of Object.entries(rec.days)) {
      if (since && day < since) continue
      if (until && day > until) continue
      if (!b || typeof b !== 'object') continue
      touched = true
      stats.prompts += b.pr ?? 0
      stats.turns += b.tc ?? 0
      stats.interrupted += b.tx ?? 0
      stats.tools.total += b.tl ?? 0
      stats.tools.ok += b.ok ?? 0
      stats.tools.failed += b.fl ?? 0
      stats.tools.unknown += b.un ?? 0
      for (const [cat, n] of Object.entries(b.c ?? {})) stats.tools.byCategory[cat] = (stats.tools.byCategory[cat] ?? 0) + n
      stats.files += b.fd ?? 0
      stats.tests.run += b.te ?? 0
      stats.tests.passed += b.tp ?? 0
      stats.tests.failed += b.tf ?? 0
      stats.tests.unknown += b.tu ?? 0
      stats.subagents += b.sa ?? 0
      stats.permissions += b.pm ?? 0
      stats.modelFailures += b.mf ?? 0
      stats.activeMs += b.ms ?? 0
      cx += b.cx ?? 0
      if (isActiveBucket(b)) days.add(day)
    }
    for (const commit of rec.git ?? []) {
      if (since && commit.d < since) continue
      if (until && commit.d > until) continue
      if (!commits.has(commit.h)) commits.set(commit.h, commit)
    }
    if (!touched) continue
    stats.sessions.observed++
    if (!rec.ended && now - rec.last <= ACTIVE_WINDOW) stats.sessions.active++
    for (const project of rec.proj ?? []) projects.add(project)
  }
  stats.projects = projects.size
  stats.activeDays = days.size
  for (const commit of commits.values()) {
    stats.git.commits++
    if (commit.a === null || commit.r === null) stats.git.withoutLines++
    else {
      stats.git.withLines++
      stats.git.added += commit.a
      stats.git.removed += commit.r
    }
    stats.git.files += commit.f ?? 0
  }
  stats.git.unverified = Math.max(0, cx - commits.size)
  return stats
}

/** Activity days and streaks across *all* records of the chosen agents: the pet's life, not one session's. */
export function activity(records, { agent = 'all', today = dayKey(Date.now()) } = {}) {
  const days = new Set()
  for (const rec of records) {
    if (!rec?.days || (agent !== 'all' && rec.agent !== agent)) continue
    for (const [day, b] of Object.entries(rec.days)) if (isActiveBucket(b)) days.add(day)
  }
  return { days, ...streaks(days, today) }
}

/** Per-day totals for a chart, oldest first, one row per calendar day (days with nothing are zero). */
export function series(records, { days = 14, today = dayKey(Date.now()), agent = 'all' } = {}) {
  const rows = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i - days + 1), claude: 0, codex: 0, prompts: 0, tools: 0, ms: 0 }))
  const at = new Map(rows.map(row => [row.day, row]))
  for (const rec of records) {
    if (!rec?.days || (agent !== 'all' && rec.agent !== agent)) continue
    for (const [day, b] of Object.entries(rec.days)) {
      const row = at.get(day)
      if (!row) continue
      row[rec.agent === 'codex' ? 'codex' : 'claude'] += b.tl ?? 0
      row.prompts += b.pr ?? 0
      row.tools += b.tl ?? 0
      row.ms += b.ms ?? 0
    }
  }
  return rows
}

/** A birthday is a date; age is whole calendar days since it, so it never depends on streaks. */
export function petAge(createdAt, now = Date.now()) {
  const born = dayKey(createdAt)
  const today = dayKey(now)
  const [by, bm, bd] = born.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(by, bm - 1, bd)) / 86_400_000)
  return { born, days }
}
