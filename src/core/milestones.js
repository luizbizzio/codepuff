// Milestones: round numbers worth a little celebration (the hundredth task, a week-long streak). They are read from the
// statistics, which are real counts, so nothing here is invented; the ones already reached are remembered on the pet so each
// celebrates once. They are also the achievements shown as badges (see render/badge.js): `kind` says what is counted and `tier`
// (0 to 3: bronze, silver, gold, diamond) how far along that count it is.

import { activity, aggregate } from './aggregate.js'
import { dayKey } from './days.js'

/** @typedef {{ tools: number, prompts: number, passed: number, commits: number, streak: number, files: number, lines: number, days: number, hours: number, helpers: number, projects: number }} Life */

/** @type {{ id: string, key: string, kind: string, tier: number, n: number, count: (life: Life) => number, reached: (life: Life) => boolean }[]} */
const family = (kind, counts, count) => counts.map((n, tier) => ({ id: kind + '-' + n, key: 'milestone.' + kind, kind, tier, n, count, reached: life => count(life) >= n }))

export const MILESTONES = [
  ...family('tools', [100, 500, 1000, 5000], life => life.tools),
  ...family('streak', [3, 7, 30], life => life.streak),
  ...family('prompts', [100, 500], life => life.prompts),
  ...family('tests', [10, 100], life => life.passed),
  ...family('commits', [10, 50], life => life.commits),
  ...family('files', [10, 100, 500, 2000], life => life.files),
  ...family('lines', [1000, 10000, 100000], life => life.lines),
  ...family('days', [7, 30, 100, 365], life => life.days),
  ...family('time', [10, 50, 200], life => life.hours),
  ...family('helpers', [10, 50, 200], life => life.helpers),
  ...family('projects', [3, 10, 25], life => life.projects),
]

/** The ids of the milestones these numbers have reached. */
export const reachedMilestones = life => MILESTONES.filter(m => m.reached(life)).map(m => m.id)

/** What the milestones count, over everything the pet has seen (every session, both agents). */
export function lifeOf(records, at) {
  const total = aggregate(records, { now: at })
  return {
    tools: total.tools.total, prompts: total.prompts, passed: total.tests.passed, commits: total.git.commits, streak: activity(records, { today: dayKey(at) }).current,
    files: total.files, lines: total.git.added, days: total.activeDays, hours: Math.floor(total.activeMs / 3_600_000), helpers: total.subagents, projects: total.projects,
  }
}
