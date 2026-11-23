// One session's record, and the single function that changes it.
//
// A session record is the unit of storage: one small JSON document per (agent, session), owned by
// whoever observes that session. Statistics are never stored as global counters; they are always
// computed by adding up records (see aggregate.js). That is what makes concurrent processes, resumed
// sessions and two different agents safe: nothing is shared except the directory they write into.
//
// Counters live in per-day buckets (`days`), so one record answers "this session", "all time" and
// "last 7 days" alike. A record holds no content: no prompts, commands, paths or outputs.

import { dayKey } from './days.js'

export const SCHEMA = 1

export const LIMITS = Object.freeze({
  seen: 48, // tool-call ids remembered to ignore a call delivered twice
  inflight: 8,
  files: 1000, // distinct files remembered per session and day
  commits: 300,
  projects: 6,
  /** The longest gap between two events that still counts as the agent working. */
  activeGap: 10 * 60_000,
})

/** What the pet needs to know right now. Small, replaced field by field, never accumulated. */
export const newLive = () => ({
  run: 0, // 1 while a turn is under way
  t0: 0, // when the current turn began
  think: 0, // when a model request began, while it is outstanding (Codex only)
  tools: [], // tool calls started and not finished: { i: id, a: activity, t: time }
  perm: 0, // when the agent started waiting for the user (approval or an answer)
  pk: '', // 'perm' | 'ask'
  te: 0, // when the last turn ended
  ok: 0, // when the last confirmed success happened
  okk: '', // 'test' | 'commit'
  err: 0, // when the last real failure happened
  ea: '', // the activity that failed
  lt: 0, // when the last tool finished
  la: '', // its activity
  sub: 0, // subagents running now
  sa: 0, // when the subagent count last changed
})

export function newRecord(ev) {
  return {
    v: SCHEMA,
    agent: ev.agent,
    sid: ev.session,
    started: ev.at,
    last: ev.at,
    ended: 0,
    resumes: 0,
    proj: ev.project ? [ev.project] : [],
    pname: ev.projectName ?? '',
    days: {},
    git: [],
    fset: { d: '', h: [] },
    seen: [],
    live: newLive(),
  }
}

const bump = (bucket, key, by = 1) => { bucket[key] = (bucket[key] ?? 0) + by }

/**
 * Applies one event to a record. Mutates and returns the record.
 * Events are applied at most once by their callers; a duplicate *tool completion* is also ignored here,
 * because hosts are known to deliver the same completion twice in some paths.
 * @param {ReturnType<typeof newRecord>} rec
 * @param {Record<string, any>} ev a normalized event (see normalize.js) or a `commit` event
 */
export function reduce(rec, ev) {
  const at = Number.isFinite(ev.at) ? ev.at : Date.now()
  const day = dayKey(at)
  const bucket = (rec.days[day] ??= {})
  const live = (rec.live ??= newLive())

  // Estimated agent time: the gap since the previous event counts only while a turn was running.
  if (live.run && at > rec.last) bump(bucket, 'ms', Math.min(at - rec.last, LIMITS.activeGap))
  if (at > rec.last) rec.last = at
  if (ev.project && !rec.proj.includes(ev.project) && rec.proj.length < LIMITS.projects) rec.proj.push(ev.project)
  if (ev.projectName && !rec.pname) rec.pname = ev.projectName

  switch (ev.kind) {
    case 'start':
      rec.ended = 0
      if (ev.source === 'resume') rec.resumes++
      Object.assign(live, newLive())
      break

    case 'end':
      rec.ended = at
      Object.assign(live, newLive())
      break

    case 'prompt':
      rec.ended = 0
      bump(bucket, 'pr')
      Object.assign(live, { run: 1, t0: at, think: 0, perm: 0, pk: '', te: 0, tools: [] })
      break

    case 'turn_start':
      rec.ended = 0
      if (!live.run) Object.assign(live, { run: 1, t0: at, te: 0 })
      break

    case 'think':
      if (ev.on) Object.assign(live, { run: 1, think: at, t0: live.run ? live.t0 : at, te: 0 })
      else live.think = 0
      break

    case 'tool_start': {
      if (rec.seen.includes(ev.id)) break // its completion was seen first (out-of-order delivery)
      const isAsk = ev.act === 'ask'
      live.tools = live.tools.filter(tool => tool.i !== ev.id)
      live.tools.push({ i: ev.id ?? '', a: ev.act, t: at })
      if (live.tools.length > LIMITS.inflight) live.tools.shift()
      if (!live.run) Object.assign(live, { run: 1, t0: at, te: 0 })
      live.think = 0
      // A tool starting means any approval was given. Asking the user a question is itself a wait.
      if (isAsk) Object.assign(live, { perm: at, pk: 'ask' })
      else if (live.perm && at >= live.perm) Object.assign(live, { perm: 0, pk: '' })
      break
    }

    case 'tool_end': {
      if (ev.id) {
        if (rec.seen.includes(ev.id)) return rec // the same completion twice: count it once
        rec.seen.push(ev.id)
        if (rec.seen.length > LIMITS.seen) rec.seen.shift()
      }
      live.tools = live.tools.filter(tool => tool.i !== ev.id)
      if (ev.act === 'ask') Object.assign(live, { perm: 0, pk: '' })
      else if (live.perm && at >= live.perm) Object.assign(live, { perm: 0, pk: '' })

      bump(bucket, 'tl')
      bucket.c ??= {}
      bump(bucket.c, ev.cat ?? 'other')
      if (ev.interrupted) bump(bucket, 'un')
      else if (ev.ok === true) bump(bucket, 'ok')
      else if (ev.ok === false) bump(bucket, 'fl')
      else bump(bucket, 'un')

      live.lt = at
      live.la = ev.act ?? ''
      if (ev.ok === false && !ev.interrupted) Object.assign(live, { err: at, ea: ev.act ?? '' })

      if (ev.test) {
        bump(bucket, 'te')
        if (ev.test === 'pass') { bump(bucket, 'tp'); Object.assign(live, { ok: at, okk: 'test' }) }
        else if (ev.test === 'fail') bump(bucket, 'tf')
        else bump(bucket, 'tu')
      }
      if (ev.commit) {
        bump(bucket, 'cx')
        Object.assign(live, { ok: at, okk: 'commit' })
      }
      if (ev.cat === 'edit' && ev.ok !== false && Array.isArray(ev.files)) {
        if (rec.fset.d !== day) rec.fset = { d: day, h: [] }
        for (const file of ev.files) {
          if (!rec.fset.h.includes(file) && rec.fset.h.length < LIMITS.files) {
            rec.fset.h.push(file)
            bump(bucket, 'fd')
          }
        }
      }
      break
    }

    case 'model_failed':
      bump(bucket, 'mf')
      Object.assign(live, { think: 0, err: at, ea: 'model' })
      break

    case 'perm':
      Object.assign(live, { perm: at, pk: 'perm' })
      bump(bucket, 'pm')
      break

    case 'denied':
      live.tools = live.tools.filter(tool => tool.i !== ev.id)
      Object.assign(live, { perm: 0, pk: '' })
      break

    case 'sub_start':
      live.sub = Math.min(live.sub + 1, 20)
      live.sa = at
      bump(bucket, 'sa')
      break

    case 'sub_stop':
      live.sub = Math.max(0, live.sub - 1)
      live.sa = at
      break

    case 'turn_end':
      if (ev.reason === 'done') bump(bucket, 'tc')
      else bump(bucket, 'tx')
      Object.assign(live, { run: 0, te: at, think: 0, perm: 0, pk: '', tools: [] })
      break

    case 'commit': {
      // A commit read from Git. Counted once per hash, however many sessions saw it.
      if (rec.git.some(commit => commit.h === ev.hash)) break
      rec.git.push({ h: ev.hash, a: ev.added ?? null, r: ev.removed ?? null, f: ev.files ?? null, t: ev.committedAt ?? at, d: dayKey(ev.committedAt ?? at) })
      if (rec.git.length > LIMITS.commits) rec.git.shift()
      break
    }

    default:
      break
  }
  return rec
}

/** Whether a day counts as an active day: the user really did something (submitted a prompt). */
export const isActiveBucket = bucket => (bucket?.pr ?? 0) > 0
