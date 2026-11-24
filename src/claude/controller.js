// Everything the Claude Code mod does, behind a small `io` interface, so it can be tested without Claude Code.
// The mod (hooks/register.tsx) only binds `io` to the host's `$` and draws what `model()` returns.
//
// Nothing here uses Node: the mod runs in the host's own module environment. Files are read and written
// through `io`, and persistence follows the same rule as the Node side: this session's record has exactly one
// writer (this controller), so no locking is needed, and all other sessions are only ever read.

import { aggregate, activity, petAge, series } from '../core/aggregate.js'
import { addDays, dayKey } from '../core/days.js'
import { AGENT_LABELS, CATEGORY_LABELS, ago, statRows } from '../core/format.js'
import { PRESETS, isHex } from '../core/color.js'
import { buildBackup, mergeRecords, parseBackup } from '../core/backup.js'
import { sessionKey } from '../core/hash.js'
import { GIT_SHOW_ARGS, parseShow } from '../core/gitparse.js'
import { normalizeHook } from '../core/normalize.js'
import { WINDOWS, focus, labelFor, stateOf } from '../core/petstate.js'
import { sanitizeRecord } from '../core/records.js'
import { newRecord, reduce } from '../core/session.js'
import { CHARACTERS, DEFAULT_NAMES, NAME_MAX, cleanName, defaultPet, displayName, restoreAppearance, sanitizePet } from '../core/settings.js'

const join = (...parts) => parts.join('/').replace(/\\/g, '/').replace(/([^:])\/{2,}/g, '$1/')
const stamp = now => new Date(now).toISOString().replace(/[:.]/g, '-')
const BLOCKS = '▁▂▃▄▅▆▇█'
const REACTION_MS = 900
/** Pats closer together than this build up: a few make the pet giggle, many make it overjoyed. */
const PAT_COMBO_MS = 2500
const reactionLevel = count => (count >= 5 ? 'delighted' : count >= 3 ? 'giggle' : 'petted')
const REACTION_LABEL = { petted: 'Happy to see you', giggle: 'Giggling', delighted: 'Overjoyed!' }
const REACTION_LENGTH = { petted: REACTION_MS, giggle: 1300, delighted: 1700 }
/** The pet looks tired from this share of a plan window (or spending limit) being used. */
export const TIRED_AT = 80
const WINDOW_NAMES = { five_hour: '5-hour limit', seven_day: 'weekly limit', spend_limit: 'spending limit' }

function tiredOf(usage, at) {
  if (!usage) return null
  let worst = null
  for (const limit of usage.limits) {
    if (typeof limit?.percentUsed !== 'number') continue
    if (limit.resetsAt && Date.parse(limit.resetsAt) < at) continue // that window has already reset
    if (!worst || limit.percentUsed > worst.percentUsed) worst = limit
  }
  if (!worst || worst.percentUsed < TIRED_AT) return null
  const percent = Math.round(worst.percentUsed)
  const resets = worst.resetsAt ? Math.max(0, Date.parse(worst.resetsAt) - at) : 0
  return { percent, window: WINDOW_NAMES[worst.kind] ?? 'plan limit', kind: worst.kind, resetsInMs: resets, exhausted: percent >= 95 }
}
export const SCOPES = ['session', 'all', '7d', '30d']
export const AGENT_FILTERS = ['all', 'claude', 'codex']

/**
 * @typedef {object} Io
 * @property {() => Promise<string>} dataDir absolute path of the CodePuff data folder
 * @property {(path: string) => Promise<string>} read rejects when missing
 * @property {(path: string, text: string) => Promise<void>} write creates folders as needed
 * @property {(path: string) => Promise<{ name: string, kind: string, size: number, mtimeMs: number }[]>} list rejects when missing
 * @property {() => number} now
 * @property {(argv: string[], cwd?: string) => Promise<{ exitCode: number, stdout: string }>} [run] optional; commit details need it
 */

/** @param {Io} io */
export function createController(io) {
  const s = {
    dir: '', sid: '', cwd: '', pet: null, rec: null,
    others: new Map(), // file -> { key, rec }
    dirty: false, ui: { tab: 'stats', scope: 'session', agent: 'all' }, react: 0, pats: [], reaction: 'petted',
    health: { storage: 'ok', git: 'ok' }, lastRefresh: 0, usage: null,
    listeners: new Set(),
  }
  const now = () => io.now()
  const file = (...p) => join(s.dir, ...p)
  const changed = () => { for (const fn of s.listeners) { try { fn() } catch { /* a listener must never break an event */ } } }

  async function loadPet() {
    const t = now()
    let text
    try { text = await io.read(file('pet.json')) } catch { text = undefined }
    if (text !== undefined) {
      try { s.pet = sanitizePet(JSON.parse(text), t).pet; return } catch {
        try { await io.write(file('pet.json.corrupt-' + stamp(t)), text) } catch { /* keep going */ }
      }
    }
    s.pet = defaultPet(t)
    await writePet()
  }

  async function writePet() {
    try { await io.write(file('pet.json'), JSON.stringify(s.pet, null, 2) + '\n') } catch { s.health.storage = 'error' }
  }

  async function loadOwn() {
    if (!s.sid) return
    try {
      const text = await io.read(file('sessions', 'claude', sessionKey(s.sid) + '.json'))
      s.rec = text.trim() ? (sanitizeRecord(JSON.parse(text)) ?? null) : null
    } catch { s.rec = null }
  }

  /** Reads the other sessions (both agents) whose files changed since the last look. Cheap: one listing per agent. */
  async function refreshOthers() {
    const seen = new Set()
    let any = false
    for (const agent of ['claude', 'codex']) {
      let entries = []
      try { entries = await io.list(file('sessions', agent)) } catch { continue }
      for (const entry of entries) {
        if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
        const key = agent + '/' + entry.name
        if (agent === 'claude' && entry.name === sessionKey(s.sid) + '.json') continue
        seen.add(key)
        const have = s.others.get(key)
        if (have && have.mtimeMs === entry.mtimeMs && have.size === entry.size) continue
        let rec
        try {
          const text = await io.read(file('sessions', agent, entry.name))
          rec = text.trim() ? sanitizeRecord(JSON.parse(text)) : undefined
        } catch { rec = undefined }
        s.others.set(key, { mtimeMs: entry.mtimeMs, size: entry.size, rec })
        any = true
      }
    }
    for (const key of [...s.others.keys()]) if (!seen.has(key)) { s.others.delete(key); any = true }
    s.lastRefresh = now()
    return any
  }

  const records = () => [...(s.rec ? [s.rec] : []), ...[...s.others.values()].map(o => o.rec).filter(Boolean)]

  async function flush() {
    if (!s.dirty || !s.rec) return
    s.dirty = false
    try { await io.write(file('sessions', 'claude', sessionKey(s.sid) + '.json'), JSON.stringify(s.rec)); s.health.storage = 'ok' } catch { s.health.storage = 'error'; s.dirty = true }
  }

  /** Reads HEAD after a successful `git commit` and records it once. Best effort: any failure leaves the commit "unverified". */
  async function lookupCommit(ev) {
    if (!io.run || !ev.cwd) { s.health.git = 'unavailable'; return }
    try {
      const out = await io.run(['git', '-c', 'core.quotepath=off', '-C', ev.cwd, ...GIT_SHOW_ARGS], ev.cwd)
      if (out.exitCode !== 0) return
      const commit = parseShow(out.stdout, now())
      if (!commit || !s.rec) return
      reduce(s.rec, { kind: 'commit', at: now(), hash: commit.hash, added: commit.added, removed: commit.removed, files: commit.files, committedAt: commit.committedAt })
      s.dirty = true
      changed()
    } catch { s.health.git = 'unavailable' }
  }

  // ---- public ---------------------------------------------------------------------------------------------

  const api = {
    get pet() { return s.pet },
    get sessionId() { return s.sid },
    get ui() { return s.ui },
    get health() { return s.health },
    onChange(fn) { s.listeners.add(fn); return () => s.listeners.delete(fn) },

    async init({ sid, cwd }) {
      s.sid = sid
      s.cwd = cwd
      s.dir = await io.dataDir()
      await loadPet()
      await loadOwn()
      await refreshOthers()
      changed()
    },

    /** Feeds one host hook payload. Synchronous and exception-safe: observing can never disturb the agent. */
    observe(name, payload) {
      try {
        const ev = normalizeHook('claude', { ...payload, hook_event_name: name, session_id: payload?.session_id ?? s.sid, cwd: payload?.cwd ?? s.cwd }, now())
        if (!ev) return
        if (!s.rec) s.rec = newRecord(ev)
        reduce(s.rec, ev)
        s.dirty = true
        if (ev.commit) void lookupCommit(ev)
        changed()
      } catch { /* never throw into the host */ }
    },

    flush,
    refreshOthers,
    records,

    /** The next time the displayed state changes by itself (a celebration ends, a wait times out); undefined if never. */
    nextTick(at = now()) {
      const live = s.rec?.live
      const marks = [s.react + REACTION_LENGTH[s.reaction]]
      if (s.rec && live) marks.push(live.err + WINDOWS.error, live.ok + WINDOWS.success, live.te + WINDOWS.finished, live.te + WINDOWS.waiting, s.rec.last + WINDOWS.stale, live.err + WINDOWS.investigate)
      const next = marks.filter(t => t > at)
      return next.length ? Math.min(...next) - at : undefined
    },

    /** The plan's usage as the host reports it (`$.session.usage()`): the rate-limit windows. Read only; nothing is stored. */
    setUsage(usage) { s.usage = usage ? { at: now(), limits: Array.isArray(usage.rateLimits) ? usage.rateLimits : [], cost: usage.cost ?? null } : null; changed() },

    /** A purely visual reaction to a click or tap. Nothing is sent to the agent and no statistic changes. */
    pat() {
      const at = now()
      s.pats = [...s.pats.filter(t => at - t < PAT_COMBO_MS), at]
      s.react = at
      s.reaction = reactionLevel(s.pats.length)
      changed()
    },

    /** Everything the pane draws, computed from memory. */
    model(at = now()) {
      const pet = s.pet ?? defaultPet(at)
      const today = dayKey(at)
      const all = records()
      let mine = s.rec ? stateOf(s.rec, at) : { state: 'idle', label: 'Resting', helpers: 0, since: at, agent: 'claude', session: sessionKey(s.sid), project: '', running: false }
      // Tired: the plan's limit is nearly used up. It shows while the pet has nothing else to do (working states stay as they are).
      const tired = tiredOf(s.usage, at)
      if (tired && ['idle', 'waiting', 'finished', 'success'].includes(mine.state)) mine = { ...mine, state: 'tired', label: labelFor('tired', { percent: tired.percent, window: tired.window }) }
      // A click makes the pet happy for a moment, unless the agent needs the user (that always wins).
      if (at - s.react < REACTION_LENGTH[s.reaction] && mine.state !== 'permission') mine = { ...mine, state: s.reaction, label: REACTION_LABEL[s.reaction] }
      const others = focus(all.filter(r => r !== s.rec), at)
      const life = activity(all, { today })
      const age = petAge(pet.createdAt, at)
      const scope = s.ui.scope
      const agent = scope === 'session' ? 'claude' : s.ui.agent
      const range = scope === '7d' ? { since: addDays(today, -6) } : scope === '30d' ? { since: addDays(today, -29) } : {}
      const stats = scope === 'session'
        ? aggregate(s.rec ? [s.rec] : [], { now: at })
        : aggregate(all, { agent, now: at, ...range })
      const week = series(all, { days: 14, today, agent: scope === 'session' ? 'all' : s.ui.agent })
      const peak = Math.max(1, ...week.map(d => d.tools))
      const todayStats = aggregate(all, { since: today, until: today, now: at })
      // How this session's tasks went, as the agent reported them (every tool call's success or failure).
      const session = s.rec ? aggregate([s.rec], { now: at }).tools : { ok: 0, failed: 0 }
      return {
        pet: { name: displayName(pet), isCustom: !!pet.name, character: pet.character, colors: pet.colors, motion: pet.prefs.motion, line: pet.prefs.line, band: pet.prefs.band, createdAt: pet.createdAt },
        age, life: { current: life.current, longest: life.longest, last: life.last, days: life.total },
        me: mine,
        outcome: { ok: session.ok, failed: session.failed },
        tired,
        others: others.current.agent ? [others.current, ...others.others].slice(0, 3) : [],
        otherCount: others.current.agent ? 1 + others.others.length : 0,
        today: { prompts: todayStats.prompts, tools: todayStats.tools.total, tests: todayStats.tests.run, passed: todayStats.tests.passed, commits: todayStats.git.commits },
        stats: { rows: statRows(stats), categories: Object.entries(stats.tools.byCategory).filter(([, n]) => n > 0).map(([k, n]) => `${CATEGORY_LABELS[k] ?? k} ${n}`) },
        scopeLabel: scope === 'session' ? 'This session' : scope === 'all' ? `All time · ${AGENT_LABELS[agent]}` : `Last ${scope.slice(0, -1)} days · ${AGENT_LABELS[agent]}`,
        spark: week.map(d => BLOCKS[Math.min(7, Math.floor((d.tools / peak) * 7.999))]).join(''),
        ui: s.ui,
        health: s.health,
        sessionLabel: s.rec?.pname || '',
      }
    },

    setUi(patch) {
      const next = { ...s.ui, ...patch }
      if (!['stats', 'look'].includes(next.tab)) next.tab = 'stats'
      if (!SCOPES.includes(next.scope)) next.scope = 'session'
      if (!AGENT_FILTERS.includes(next.agent)) next.agent = 'all'
      s.ui = next
      changed()
    },

    /** Applies a validated change to the pet's identity or look, and saves it at once. */
    async setPet(patch) {
      const merged = { ...s.pet, ...patch, colors: { ...s.pet.colors, ...(patch.colors ?? {}) }, prefs: { ...s.pet.prefs, ...(patch.prefs ?? {}) } }
      s.pet = sanitizePet(merged, now()).pet
      await writePet()
      changed()
      return s.pet
    },

    // ---- data controls -----------------------------------------------------------------------------------

    async exportBackup() {
      await flush()
      const target = file('exports', 'codepuff-backup-' + stamp(now()) + '.json')
      await refreshOthers()
      await io.write(target, JSON.stringify(buildBackup(s.pet, records()), null, 2) + '\n')
      return { file: target, sessions: records().length }
    },

    async importFile(path) {
      let text
      try { text = await io.read(path) } catch { return { ok: false, error: 'Could not read ' + path } }
      const parsed = parseBackup(text)
      if (!parsed.ok) return parsed
      await refreshOthers()
      const { changed: list } = mergeRecords(records(), parsed.records)
      for (const rec of list) {
        await io.write(file('sessions', rec.agent, sessionKey(rec.sid) + '.json'), JSON.stringify(rec))
        if (rec.agent === 'claude' && rec.sid === s.sid) s.rec = rec
      }
      await refreshOthers()
      changed()
      return { ok: true, imported: list.length, skipped: parsed.skipped }
    },

    /** Forgets all statistics (the pet is untouched). Files are emptied, not deleted: the host cannot delete. */
    async resetStats() {
      const backup = await api.exportBackup()
      for (const rec of records()) await io.write(file('sessions', rec.agent, sessionKey(rec.sid) + '.json'), '')
      s.rec = null
      s.others.clear()
      await refreshOthers()
      changed()
      return { removed: backup.sessions, safety: backup.file }
    },

    async resetPet() { s.pet = defaultPet(now()); await writePet(); changed(); return s.pet },
    async restoreAppearance() { s.pet = restoreAppearance(s.pet); await writePet(); changed(); return s.pet },

    // ---- the /codepuff command ---------------------------------------------------------------------------

    /** @returns {Promise<{ text: string, open?: boolean }>} */
    async command(args = '') {
      const [word = '', ...rest] = String(args).trim().split(/\s+/)
      const value = rest.join(' ')
      const say = text => ({ text })
      switch (word.toLowerCase()) {
        case '':
        case 'open':
        case 'pet': {
          const m = api.model()
          return { text: `${m.pet.name}: ${m.me.label}. Streak ${m.life.current} day${m.life.current === 1 ? '' : 's'}, ${m.age.days} days old. Use /codepuff help for more.`, open: true }
        }
        case 'help': return say('/codepuff [open] · stats [session|all|7d|30d] · name <name> · character <id> · characters · palette <id> · body <#hex> · accent <#hex> · motion <auto|reduced> · band <on|off> · line <on|off> · restore · export · import <file> · reset stats|pet confirm · palettes')
        case 'palettes': return say('Palettes: ' + PRESETS.map(p => p.id).join(', '))
        case 'stats': {
          if (value && SCOPES.includes(value)) api.setUi({ scope: value })
          const m = api.model()
          return say([`${m.scopeLabel}`, ...m.stats.rows.map(r => (r.group ? `\n${r.group}\n` : '') + `  ${r.label}: ${r.value}`), `Last 14 days: ${m.spark}`].join('\n').replace(/\n\n\n/g, '\n\n'))
        }
        case 'name': { const n = cleanName(value); await api.setPet({ name: n }); return say(n ? `Your pet is now called ${n}.` : `Name cleared. Your pet is called ${displayName(s.pet)} again. (Names are at most ${NAME_MAX} characters.)`) }
        case 'characters': return say(CHARACTERS.map(id => `${id} (${DEFAULT_NAMES[id]})`).join(', '))
        case 'character': {
          if (!CHARACTERS.includes(value)) return say('Characters: ' + CHARACTERS.join(', '))
          await api.setPet({ character: value }); return say(`Switched to ${DEFAULT_NAMES[value]}. Statistics and progress are unchanged.`)
        }
        case 'band':
          if (!['on', 'off'].includes(value)) return say('Usage: /codepuff band on|off')
          await api.setPet({ prefs: { band: value === 'on' } }); return say(`Compact band ${value}.`)
        case 'palette': {
          const preset = PRESETS.find(p => p.id === value)
          if (!preset) return say('Palettes: ' + PRESETS.map(p => p.id).join(', '))
          await api.setPet({ colors: { body: preset.body, accent: preset.accent } }); return say(`Palette: ${preset.name}.`)
        }
        case 'body':
        case 'accent': {
          if (value !== 'default' && !isHex(value)) return say('Use a color like #7cc4ff, or "default".')
          await api.setPet({ colors: { [word]: value === 'default' ? null : value.toLowerCase() } }); return say('Saved.')
        }
        case 'motion':
          if (!['auto', 'reduced'].includes(value)) return say('Motion: auto or reduced.')
          await api.setPet({ prefs: { motion: value } }); return say(`Motion: ${value}.`)
        case 'line':
          if (!['on', 'off'].includes(value)) return say('Usage: /codepuff line on|off')
          await api.setPet({ prefs: { line: value === 'on' } }); return say(`Status line ${value}.`)
        case 'restore': await api.restoreAppearance(); return say('Default appearance restored. Your pet keeps its birthday and statistics.')
        case 'export': { const r = await api.exportBackup(); return say(`Exported ${r.sessions} sessions to ${r.file}`) }
        case 'import': {
          if (!value) return say('Usage: /codepuff import <path to a CodePuff backup>')
          const r = await api.importFile(value)
          return say(r.ok ? `Imported ${r.imported} sessions${r.skipped ? ` (${r.skipped} invalid entries skipped)` : ''}.` : r.error)
        }
        case 'reset': {
          const [what, confirm] = rest
          if (!['stats', 'pet'].includes(what)) return say('Usage: /codepuff reset stats confirm | reset pet confirm')
          if (confirm !== 'confirm') return say(what === 'stats' ? 'This forgets all statistics (a backup is saved first). Your pet stays. Run: /codepuff reset stats confirm' : 'This starts a brand-new pet with a new birthday. Statistics stay. Run: /codepuff reset pet confirm')
          if (what === 'stats') { const r = await api.resetStats(); return say(`Statistics reset (${r.removed} sessions). Backup: ${r.safety}`) }
          await api.resetPet(); return say('A new pet was created. Statistics are unchanged.')
        }
        default: return say(`Unknown option "${word}". Try /codepuff help`)
      }
    },

    ago: t => ago(t, now()),
  }
  return api
}
