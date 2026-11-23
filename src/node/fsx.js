// File-system primitives for concurrent processes: atomic replace and a directory lock.

import { mkdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync, openSync, closeSync, writeSync, fsyncSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

const sleeper = new Int32Array(new SharedArrayBuffer(4))
export const sleepSync = ms => Atomics.wait(sleeper, 0, 0, ms)

/** Writes a file so a reader sees either the old content or the new content, never half of it. */
export function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, text)
    try { fsyncSync(fd) } catch { /* not every file system can */ }
  } finally { closeSync(fd) }
  // Windows refuses to rename over a file another process has open for a moment; retry briefly.
  for (let attempt = 0; ; attempt++) {
    try { renameSync(tmp, path); return } catch (error) {
      if (attempt >= 12 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) { try { unlinkSync(tmp) } catch { /* gone */ } throw error }
      sleepSync(5 + attempt * 5)
    }
  }
}

/** Creates a file only if it does not exist yet. Returns false when it already existed. */
export function createExclusive(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  let fd
  try { fd = openSync(path, 'wx') } catch (error) { if (error.code === 'EEXIST') return false; throw error }
  try { writeSync(fd, text) } finally { closeSync(fd) }
  return true
}

/**
 * Runs `fn` while holding a named lock (a directory, the one create-or-fail operation every file system
 * gives for free). A lock older than `stale` ms is assumed to belong to a dead process and is broken.
 * If the lock cannot be had within `timeout` ms, `fn` runs anyway: losing a lock is better than losing an event,
 * and every write is atomic so the worst case is one overwritten update, never a corrupt file.
 */
export function withLock(lockPath, fn, { timeout = 5000, stale = 15_000 } = {}) {
  mkdirSync(dirname(lockPath), { recursive: true })
  const deadline = Date.now() + timeout
  let held = false
  for (let wait = 4; ; wait = Math.min(wait * 2, 40)) {
    try { mkdirSync(lockPath); held = true; break } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'EPERM' && error.code !== 'EACCES') throw error
      try { if (Date.now() - statSync(lockPath).mtimeMs > stale) { rmSync(lockPath, { recursive: true, force: true }); continue } } catch { continue }
      if (Date.now() > deadline) break
      sleepSync(wait)
    }
  }
  try { return fn() } finally { if (held) { try { rmdirSync(lockPath) } catch { /* already broken by someone */ } } }
}
