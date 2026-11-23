// Reading the commit an agent just made. Called only after a successful `git commit` was observed, never in
// a loop and never over history: one `git show` of HEAD, bounded by a short timeout.

import { execFileSync } from 'node:child_process'
import { GIT_SHOW_ARGS, parseShow } from '../core/gitparse.js'

export { parseShow }

/**
 * @param {string} cwd the folder the agent ran in
 * @param {number} now
 * @returns {ReturnType<typeof parseShow>} undefined when git is missing, the folder is not a repository, or HEAD is not a fresh commit
 */
export function readHeadCommit(cwd, now = Date.now(), { git = 'git', timeoutMs = 4000, freshMs = 10 * 60_000 } = {}) {
  let out
  try {
    out = execFileSync(git, ['-c', 'core.quotepath=off', '-C', cwd, ...GIT_SHOW_ARGS], {
      encoding: 'utf8', timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    })
  } catch { return undefined }
  return parseShow(out, now, freshMs)
}
