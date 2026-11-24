// Milestones: round numbers worth a little celebration (the hundredth task, a week-long streak). They are read from the
// statistics, which are real counts, so nothing here is invented; the ones already reached are remembered on the pet so each
// celebrates once.

/** @type {{ id: string, text: string, reached: (life: { tools: number, prompts: number, passed: number, commits: number, streak: number }) => boolean }[]} */
export const MILESTONES = [
  ...[100, 500, 1000, 5000].map(n => ({ id: 'tools-' + n, text: `${n.toLocaleString('en-US')} tasks done together!`, reached: l => l.tools >= n })),
  ...[3, 7, 30].map(n => ({ id: 'streak-' + n, text: `${n}-day streak!`, reached: l => l.streak >= n })),
  ...[100, 500].map(n => ({ id: 'prompts-' + n, text: `${n} prompts so far!`, reached: l => l.prompts >= n })),
  ...[10, 100].map(n => ({ id: 'tests-' + n, text: `${n} passing test runs!`, reached: l => l.passed >= n })),
  ...[10, 50].map(n => ({ id: 'commits-' + n, text: `${n} commits together!`, reached: l => l.commits >= n })),
]

/** The ids of the milestones these numbers have reached. */
export const reachedMilestones = life => MILESTONES.filter(m => m.reached(life)).map(m => m.id)
