// Parsing the output of `git show --numstat --no-renames --format=%H%x1f%ct%x1f%P HEAD`. Pure, so the Node
// hook and the Claude Code mod share it.

export const GIT_SHOW_ARGS = ['show', '--numstat', '--no-renames', '--format=%H%x1f%ct%x1f%P', 'HEAD']

/**
 * @returns {{ hash: string, committedAt: number, added: number | null, removed: number | null, files: number | null } | undefined}
 *   undefined when the output is not a commit, or HEAD is not the commit that was *just* made.
 */
export function parseShow(out, now, freshMs = 10 * 60_000) {
  const lines = String(out).split(/\r?\n/)
  const [hash, ct, parents = ''] = (lines[0] ?? '').split('\x1f')
  if (!/^[0-9a-f]{40,64}$/i.test(hash ?? '')) return undefined
  const committedAt = Number(ct) * 1000
  if (!Number.isFinite(committedAt) || now - committedAt > freshMs || committedAt - now > 5 * 60_000) return undefined
  const isMerge = parents.trim().split(/\s+/).filter(Boolean).length > 1
  let added = 0
  let removed = 0
  let files = 0
  for (const line of lines.slice(1)) {
    const match = /^(\d+|-)\t(\d+|-)\t/.exec(line)
    if (!match) continue
    files++
    if (match[1] !== '-') added += Number(match[1])
    if (match[2] !== '-') removed += Number(match[2])
  }
  // A merge has no single diff; report the commit but never invent its line counts.
  return { hash: hash.toLowerCase(), committedAt, added: isMerge ? null : added, removed: isMerge ? null : removed, files: isMerge ? null : files }
}
