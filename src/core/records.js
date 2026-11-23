// Validation and migration of anything read from disk or from a backup. A record that is damaged,
// hand-edited or written by a different version is *repaired field by field*, never trusted: every
// number is clamped to a finite non-negative integer, every key is checked, every list is bounded.
// Reading never throws; a record with no usable identity is dropped.

import { CATEGORIES } from './classify.js'
import { isDayKey } from './days.js'
import { LIMITS, SCHEMA, newLive } from './session.js'

const COUNTERS = ['pr', 'tc', 'tx', 'tl', 'ok', 'fl', 'un', 'te', 'tp', 'tf', 'tu', 'fd', 'cx', 'sa', 'pm', 'ms', 'mf']
const AGENT_IDS = ['claude', 'codex']
const MAX_COUNT = 1e9

const count = value => (Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), MAX_COUNT) : 0)
const time = value => (Number.isFinite(value) && value > 0 && value < 8.64e15 ? Math.floor(value) : 0)
const text = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, max) : '')

/** Upgrades older record layouts. Version 1 is the first; this is where version 2's upgrade will go. */
export function migrateRecord(raw) {
  return raw
}

/**
 * @param {unknown} raw
 * @returns {any | undefined} a valid record, or undefined when it cannot be one
 */
export function sanitizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const rec = migrateRecord(raw)
  if (!AGENT_IDS.includes(rec.agent)) return undefined
  if (typeof rec.sid !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(rec.sid)) return undefined

  const days = {}
  if (rec.days && typeof rec.days === 'object') {
    for (const [day, bucket] of Object.entries(rec.days)) {
      if (!isDayKey(day) || !bucket || typeof bucket !== 'object') continue
      const clean = {}
      for (const key of COUNTERS) if (count(bucket[key])) clean[key] = count(bucket[key])
      if (bucket.c && typeof bucket.c === 'object') {
        clean.c = {}
        for (const cat of CATEGORIES) if (count(bucket.c[cat])) clean.c[cat] = count(bucket.c[cat])
      }
      days[day] = clean
    }
  }

  const git = []
  for (const item of Array.isArray(rec.git) ? rec.git.slice(-LIMITS.commits) : []) {
    if (!item || typeof item.h !== 'string' || !/^[0-9a-f]{7,64}$/i.test(item.h)) continue
    const t = time(item.t)
    git.push({
      h: item.h.toLowerCase(),
      a: Number.isFinite(item.a) ? count(item.a) : null,
      r: Number.isFinite(item.r) ? count(item.r) : null,
      f: Number.isFinite(item.f) ? count(item.f) : null,
      t,
      d: isDayKey(item.d) ? item.d : '',
    })
  }

  const live = newLive()
  if (rec.live && typeof rec.live === 'object') {
    for (const key of ['run', 'think', 't0', 'perm', 'te', 'ok', 'err', 'lt', 'sa']) live[key] = time(rec.live[key])
    live.sub = Math.min(count(rec.live.sub), 20)
    live.pk = rec.live.pk === 'ask' ? 'ask' : rec.live.pk === 'perm' ? 'perm' : ''
    live.okk = rec.live.okk === 'commit' ? 'commit' : rec.live.okk === 'test' ? 'test' : ''
    live.ea = text(rec.live.ea, 12)
    live.la = text(rec.live.la, 12)
    live.tools = (Array.isArray(rec.live.tools) ? rec.live.tools : []).slice(-LIMITS.inflight)
      .filter(tool => tool && typeof tool === 'object')
      .map(tool => ({ i: text(tool.i, 80), a: text(tool.a, 12), t: time(tool.t) }))
  }

  const started = time(rec.started)
  return {
    v: SCHEMA,
    agent: rec.agent,
    sid: rec.sid,
    started,
    last: Math.max(time(rec.last), started),
    ended: time(rec.ended),
    resumes: count(rec.resumes),
    proj: (Array.isArray(rec.proj) ? rec.proj : []).filter(p => typeof p === 'string' && /^[0-9a-f]{6,16}$/.test(p)).slice(0, LIMITS.projects),
    pname: text(rec.pname, 40),
    days,
    git,
    fset: { d: isDayKey(rec.fset?.d) ? rec.fset.d : '', h: (Array.isArray(rec.fset?.h) ? rec.fset.h : []).filter(h => typeof h === 'string').slice(0, LIMITS.files) },
    seen: (Array.isArray(rec.seen) ? rec.seen : []).filter(s => typeof s === 'string').slice(-LIMITS.seen),
    live,
  }
}
