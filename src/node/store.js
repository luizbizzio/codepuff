// The local store. Everything CodePuff knows lives in one folder:
//
//   pet.json                       identity and appearance (versioned)
//   sessions/<agent>/<id>.json     one record per agent session (versioned)
//   locks/                         short-lived per-session locks
//   exports/                       backups made by `data export` and before destructive operations
//
// Each session record has exactly one logical owner at a time, and every write is an atomic replace
// under a per-session lock, so any number of Claude Code and Codex processes can run at once without
// lost updates or torn files. Reading never needs a lock. Nothing in here talks to a network.

import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { layout } from './paths.js'
import { atomicWrite, createExclusive, withLock } from './fsx.js'
import { defaultPet, restoreAppearance, sanitizePet } from '../core/settings.js'
import { sanitizeRecord } from '../core/records.js'
import { newRecord, reduce } from '../core/session.js'
import { buildBackup, mergeRecords, parseBackup } from '../core/backup.js'
import { sessionKey } from '../core/hash.js'

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

/**
 * @param {string} dir
 * @param {{ lockTimeout?: number }} [options] how long an event waits for the session's lock before it is applied anyway (a hook must
 *   not hang the agent, so the default is a few seconds; the tests that put six processes on one session ask for longer)
 */
export function openStore(dir, { lockTimeout = 5000 } = {}) {
  const L = layout(dir)
  const cache = new Map() // file -> { mtimeMs, size, rec }

  const recordFile = (agent, sid) => join(L.sessions, agent, sessionKey(sid) + '.json')

  /** Moves a damaged file aside instead of deleting it, so nothing is ever lost silently. */
  function quarantine(path) {
    try { renameSync(path, path + '.corrupt-' + stamp()) } catch { /* someone else did it first */ }
  }

  // ---- pet ---------------------------------------------------------------------------------------------

  function readPet() {
    let text
    try { text = readFileSync(L.pet, 'utf8') } catch { return { exists: false, ...sanitizePet(undefined) } }
    try { return { exists: true, ...sanitizePet(JSON.parse(text)) } } catch {
      return { exists: true, corrupt: true, ...sanitizePet(undefined) }
    }
  }

  /** Reads the pet, creating it (once, even with concurrent first runs) when there is none. */
  function ensurePet(now = Date.now()) {
    const found = readPet()
    if (found.exists && !found.corrupt) return found.pet
    if (found.corrupt) quarantine(L.pet)
    const fresh = defaultPet(now)
    if (createExclusive(L.pet, JSON.stringify(fresh, null, 2) + '\n')) return fresh
    return readPet().pet
  }

  const writePet = pet => atomicWrite(L.pet, JSON.stringify(sanitizePet(pet).pet, null, 2) + '\n')

  // ---- records -----------------------------------------------------------------------------------------

  function readRecord(agent, sid) {
    const file = recordFile(agent, sid)
    let text
    try { text = readFileSync(file, 'utf8') } catch { return undefined }
    if (!text.trim()) return undefined
    try { return sanitizeRecord(JSON.parse(text)) } catch { quarantine(file); return undefined }
  }

  /**
   * Applies one event to its session record. The only way statistics change.
   * @returns the updated record
   */
  function applyEvent(ev) {
    const file = recordFile(ev.agent, ev.session)
    return withLock(join(L.locks, ev.agent + '-' + sessionKey(ev.session)), () => {
      const rec = readRecord(ev.agent, ev.session) ?? newRecord(ev)
      reduce(rec, ev)
      atomicWrite(file, JSON.stringify(rec))
      return rec
    }, { timeout: lockTimeout })
  }

  /** Every readable record. Files that did not change since the last call are not read again. */
  function listRecords() {
    const out = []
    const alive = new Set()
    let agents = []
    try { agents = readdirSync(L.sessions, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) } catch { return out }
    for (const agent of agents) {
      let files = []
      try { files = readdirSync(join(L.sessions, agent)).filter(name => name.endsWith('.json')) } catch { continue }
      for (const name of files) {
        const file = join(L.sessions, agent, name)
        let stat
        try { stat = statSync(file) } catch { continue }
        alive.add(file)
        const hit = cache.get(file)
        if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) { if (hit.rec) out.push(hit.rec); continue }
        let rec
        try {
          const text = readFileSync(file, 'utf8')
          rec = text.trim() ? sanitizeRecord(JSON.parse(text)) : undefined
        } catch { rec = undefined }
        cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, rec })
        if (rec) out.push(rec)
      }
    }
    for (const file of cache.keys()) if (!alive.has(file)) cache.delete(file)
    return out
  }

  // ---- data controls -----------------------------------------------------------------------------------

  function exportBackup(file) {
    const doc = buildBackup(ensurePet(), listRecords())
    const target = file ?? join(L.exports, 'codepuff-backup-' + stamp() + '.json')
    atomicWrite(target, JSON.stringify(doc, null, 2) + '\n')
    return { file: target, sessions: doc.sessions.length }
  }

  /**
   * @param {string} text the backup file's content
   * @param {{ mode?: 'merge' | 'replace', pet?: boolean }} [options]
   *   merge (default) adds what is new and never lowers a count; replace discards current statistics first
   *   (after saving a safety backup). `pet: true` also restores the pet from the backup.
   */
  function importBackup(text, { mode = 'merge', pet = false } = {}) {
    const parsed = parseBackup(text)
    if (!parsed.ok) return parsed
    let safety
    const current = listRecords()
    if (mode === 'replace' && current.length) safety = exportBackup(join(L.exports, 'before-import-' + stamp() + '.json')).file
    const base = mode === 'replace' ? [] : current
    const { changed } = mergeRecords(base, parsed.records)
    if (mode === 'replace') rmSync(L.sessions, { recursive: true, force: true })
    for (const rec of changed) {
      withLock(join(L.locks, rec.agent + '-' + rec.sid), () => atomicWrite(recordFile(rec.agent, rec.sid), JSON.stringify(rec)))
    }
    if (pet || mode === 'replace') writePet(parsed.pet)
    return { ok: true, imported: changed.length, skipped: parsed.skipped, newer: parsed.newer, safety }
  }

  /** Forgets every statistic. The pet (name, look, birthday) is untouched. A safety backup is saved first. */
  function resetStats() {
    const records = listRecords()
    let safety
    if (records.length) safety = exportBackup(join(L.exports, 'before-reset-' + stamp() + '.json')).file
    rmSync(L.sessions, { recursive: true, force: true })
    cache.clear()
    return { removed: records.length, safety }
  }

  /** Starts over with a brand-new pet (new birthday, default look). Statistics are untouched. */
  function resetPet(now = Date.now()) {
    const fresh = defaultPet(now)
    writePet(fresh)
    return fresh
  }

  /** Back to the default look and name. Birthday and statistics are kept. */
  function resetAppearance() {
    const pet = restoreAppearance(ensurePet())
    writePet(pet)
    return pet
  }

  /** Deletes the whole data folder. Nothing is kept. */
  function deleteAll() {
    const existed = existsSync(L.dir)
    rmSync(L.dir, { recursive: true, force: true })
    cache.clear()
    return { existed }
  }

  function usage() {
    let files = 0
    let bytes = 0
    const walk = folder => {
      let entries = []
      try { entries = readdirSync(folder, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const path = join(folder, entry.name)
        if (entry.isDirectory()) walk(path)
        else { try { bytes += statSync(path).size; files++ } catch { /* gone */ } }
      }
    }
    walk(L.dir)
    return { files, bytes }
  }

  return { dir: L.dir, paths: L, readPet, ensurePet, writePet, readRecord, applyEvent, listRecords, exportBackup, importBackup, resetStats, resetPet, resetAppearance, deleteAll, usage }
}
