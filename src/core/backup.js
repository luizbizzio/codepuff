// The backup format: one JSON document holding the pet and every session record. Simple, versioned,
// human-readable. Importing validates *everything* and never executes or trusts anything in the file.

import { sanitizePet } from './settings.js'
import { sanitizeRecord } from './records.js'

export const BACKUP_FORMAT = 'codepuff-backup'
export const BACKUP_VERSION = 1
const MAX_RECORDS = 50_000

export function buildBackup(pet, records, now = Date.now()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    note: 'CodePuff backup. Contains counters and identifiers only: no prompts, code, commands, paths or outputs.',
    pet,
    sessions: records.map(rec => ({ ...rec, live: undefined })),
  }
}

/**
 * Parses and validates a backup. Never throws.
 * @returns {{ ok: true, pet: any, records: any[], skipped: number, newer: boolean } | { ok: false, error: string }}
 */
export function parseBackup(input) {
  let doc = input
  if (typeof input === 'string') {
    if (input.length > 200 * 1024 * 1024) return { ok: false, error: 'The file is too large to be a CodePuff backup.' }
    try { doc = JSON.parse(input) } catch { return { ok: false, error: 'The file is not valid JSON.' } }
  }
  if (!doc || typeof doc !== 'object' || doc.format !== BACKUP_FORMAT) return { ok: false, error: 'This is not a CodePuff backup.' }
  if (!Number.isInteger(doc.version) || doc.version < 1) return { ok: false, error: 'The backup has no valid version.' }
  if (!Array.isArray(doc.sessions)) return { ok: false, error: 'The backup has no sessions list.' }
  if (doc.sessions.length > MAX_RECORDS) return { ok: false, error: 'The backup has too many sessions.' }
  const records = []
  let skipped = 0
  const seen = new Set()
  for (const raw of doc.sessions) {
    const rec = sanitizeRecord(raw)
    const key = rec && rec.agent + '/' + rec.sid
    if (!rec || seen.has(key)) { skipped++; continue }
    seen.add(key)
    records.push(rec)
  }
  const { pet } = sanitizePet(doc.pet)
  return { ok: true, pet, records, skipped, newer: doc.version > BACKUP_VERSION }
}

/**
 * Merges backup records into existing ones without double counting. A record that exists on both sides
 * keeps the version that has seen more (later last event), so importing the same backup twice is a no-op.
 */
export function mergeRecords(existing, incoming) {
  const byKey = new Map(existing.map(rec => [rec.agent + '/' + rec.sid, rec]))
  const changed = []
  for (const rec of incoming) {
    const key = rec.agent + '/' + rec.sid
    const have = byKey.get(key)
    if (!have || rec.last > have.last) { byKey.set(key, rec); changed.push(rec) }
  }
  return { records: [...byKey.values()], changed }
}
