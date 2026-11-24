// Milestones: round numbers worth a little celebration (the hundredth task, a week-long streak). They are read from the
// statistics, which are real counts, so nothing here is invented; the ones already reached are remembered on the pet so each
// celebrates once.

/** @type {{ id: string, key: string, n: number, reached: (life: { tools: number, prompts: number, passed: number, commits: number, streak: number }) => boolean }[]} */
export const MILESTONES = [
  ...[100, 500, 1000, 5000].map(n => ({ id: 'tools-' + n, key: 'milestone.tools', n, reached: l => l.tools >= n })),
  ...[3, 7, 30].map(n => ({ id: 'streak-' + n, key: 'milestone.streak', n, reached: l => l.streak >= n })),
  ...[100, 500].map(n => ({ id: 'prompts-' + n, key: 'milestone.prompts', n, reached: l => l.prompts >= n })),
  ...[10, 100].map(n => ({ id: 'tests-' + n, key: 'milestone.tests', n, reached: l => l.passed >= n })),
  ...[10, 50].map(n => ({ id: 'commits-' + n, key: 'milestone.commits', n, reached: l => l.commits >= n })),
]

/** The ids of the milestones these numbers have reached. */
export const reachedMilestones = life => MILESTONES.filter(m => m.reached(life)).map(m => m.id)
