// Everything the Claude Code mod does, behind a small `io` interface, so it can be tested without Claude Code.
// The mod (hooks/register.tsx) only binds `io` to the host's `$` and draws what `model()` returns.
//
// Nothing here uses Node: the mod runs in the host's own module environment. Files are read and written
// through `io`, and persistence follows the same rule as the Node side: this session's record has exactly one
// writer (this controller), so no locking is needed, and all other sessions are only ever read.

import { aggregate, activity, petAge, series } from '../core/aggregate.js'
import { heartsOf } from '../core/mood.js'
import { addDays, dayKey } from '../core/days.js'
import { ACCESSORIES, FRAMES, PALETTE_REWARDS, frameOf, isOpen, rewardFor, wornOf } from '../core/rewards.js'
import { cardSvg } from '../core/card.js'
import { AGENT_LABELS, ago, duration, shortDay, statBars, statRows, statTiles, usd } from '../core/format.js'
import { MILESTONES, lifeOf } from '../core/milestones.js'
import { TIER_NAMES } from '../core/render/badge.js'
import { buildBackup, mergeRecords, parseBackup } from '../core/backup.js'
import { sessionKey } from '../core/hash.js'
import { chooseLanguage, getLanguage, setLanguage, t } from '../core/i18n/index.js'
import { GIT_SHOW_ARGS, parseShow } from '../core/gitparse.js'
import { normalizeHook } from '../core/normalize.js'
import { WINDOWS, focus, labelFor, stateOf } from '../core/petstate.js'
import { sanitizeRecord } from '../core/records.js'
import { newRecord, reduce } from '../core/session.js'
import { BAND_SIZES, defaultPet, displayName, restoreAppearance, sanitizePet } from '../core/settings.js'
import { createAffection } from './affection.js'
import { runCommand } from './commands.js'
import { AGENT_FILTERS, BLOCKS, PERIODS, PAT_COMBO_MS, REACTION_LENGTH, SAD_AT, SCOPES, greetingAt, reactionLevel } from './constants.js'
import { createMoments } from './moments.js'
import { TIRED_AT, keepWatched, resetText, planWindows, resetsBetween, tiredOf, trackResets } from './usage.js'

export { AGENT_FILTERS, SCOPES, TIRED_AT }

/** An absence this long gets a greeting when it ends. (What ends a stretch of work for the break reminder is the pet's setting, `breakRest`.) */
const GREET_AFTER = 3 * 3_600_000
/** The reactions that come from the clock, not from you: they give way to anything the agent is doing. */
const AMBIENT = ['morning', 'afternoon', 'evening', 'night', 'stretch']

/** The earliest day any record of this agent (or of both) has numbers for. */
const firstDay = (records, agent) => records.filter(r => agent === 'all' || r.agent === agent).flatMap(r => Object.keys(r.days ?? {})).sort()[0]

const join = (...parts) => parts.join('/').replace(/\\/g, '/').replace(/([^:])\/{2,}/g, '$1/')
const stamp = now => new Date(now).toISOString().replace(/[:.]/g, '-')

/**
 * @typedef {object} Io
 * @property {() => Promise<string>} dataDir absolute path of the CodePuff data folder
 * @property {(path: string) => Promise<string>} read rejects when missing
 * @property {(path: string, text: string) => Promise<void>} write creates folders as needed
 * @property {(path: string) => Promise<{ name: string, kind: string, size: number, mtimeMs: number }[]>} list rejects when missing
 * @property {() => number} now
 * @property {(argv: string[], cwd?: string) => Promise<{ exitCode: number, stdout: string }>} [run] optional; commit details need it
 */

/**
 * @param {Io} io
 * @param {{ host?: 'claude' | 'codex', locale?: string }} [options] `locale` is the system's language (a supported code, found by the host: see i18n/detect), used when the pet's language is "auto"; which agent this controller lives in: its platform is listed first and "This session"
 *   is only offered for it (the mod runs in Claude Code, so the default is `claude`)
 */
export function createController(io, { host = 'claude', locale = 'en', greet = false } = {}) {
  const s = {
    dir: '', sid: '', cwd: '', pet: null, rec: null,
    others: new Map(), // file -> { key, rec }
    dirty: false, ui: { tab: 'stats', scope: 'session', agent: host, details: false }, react: 0, pats: [], reaction: 'petted', cues: [], cueAt: {}, toasts: [], milestoneAt: 0, petText: '', writes: Promise.resolve(),
    health: { storage: 'ok', git: 'ok' }, lastRefresh: 0, usage: null, locale, watch: {}, watchText: '{}',
    // The stretch of work the pet is watching for the break reminder: when it began and when it was last seen at it (a pause of ten minutes ends it).
    work: { since: 0, last: 0 },
    listeners: new Set(),
  }
  const now = () => io.now()
  /** How long a pause has to be to end a stretch of work (the break reminder's rest, in milliseconds). */
  const restMs = () => (s.pet?.prefs.breakRest ?? 10) * 60_000
  /** Makes the pet's language (or the system's, for "auto") the one every label is built in. Cheap, so it is done wherever text is made. */
  const applyLanguage = () => setLanguage(chooseLanguage(s.pet?.prefs.language, s.locale))
  const file = (...p) => join(s.dir, ...p)
  const changed = () => { for (const fn of s.listeners) { try { fn() } catch { /* a listener must never break an event */ } } }
  const affection = createAffection({ s, io, file, now, writePet: () => writePet() })
  const moments = createMoments({ s, now, records: () => records(), writePet: () => writePet() })

  async function loadPet() {
    const t = now()
    let text
    try { text = await io.read(file('pet.json')) } catch { text = undefined }
    if (text !== undefined) {
      try { s.pet = sanitizePet(JSON.parse(text), t).pet; s.petText = text; return } catch {
        try { await io.write(file('pet.json.corrupt-' + stamp(t)), text) } catch { /* keep going */ }
      }
    }
    s.pet = defaultPet(t)
    await writePet()
  }

  /** Saves the pet. Saves are queued, so two never overlap and a look at the file (reloadPet) can wait for the ones under way. */
  function writePet() {
    const save = async () => {
      await affection.sync()
      const text = JSON.stringify(s.pet, null, 2) + '\n'
      try { await io.write(file('pet.json'), text); s.petText = text } catch { s.health.storage = 'error' }
    }
    s.writes = s.writes.then(save, save)
    return s.writes
  }

  /**
   * Another window (a second Claude Code session) or the Codex hook may have saved the pet since this one last did. Their file is
   * adopted, so a later save here does not put an old copy back over their change; the newer affection wins, and what has been
   * celebrated or shown is the union of both. It waits for saves of our own that are under way. Returns whether anything changed.
   */
  async function reloadPet() {
    await s.writes
    let text
    try { text = await io.read(file('pet.json')) } catch { return false }
    if (text === s.petText) return false
    try {
      const found = sanitizePet(JSON.parse(text), now()).pet
      const mine = s.pet
      const union = (a, b) => (a === null ? b : b === null ? a : [...new Set([...a, ...b])])
      s.pet = { ...found, affection: found.affection.at >= mine.affection.at ? found.affection : mine.affection, milestones: union(found.milestones, mine.milestones), seen: [...new Set([...found.seen, ...mine.seen])] }
      s.petText = text
      return true
    } catch { return false }
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
    let any = await reloadPet()
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
      applyLanguage()
      if (affection.heal(now())) await writePet()
      if (moments.welcome()) await writePet()
      await loadOwn()
      await refreshOthers()
      // The limits that were waited on when the pet was last open (so a reset that came while it was closed is still announced).
      try { s.watch = keepWatched(JSON.parse(await io.read(file('usage-watch.json'))), now()); s.watchText = JSON.stringify(s.watch) } catch { s.watch = {} }
      moments.checkMilestones(true)
      // A greeting that fits the time of day, when the host asks for one (the mod does; a test or the terminal app does not).
      if (greet) { s.react = now(); s.reaction = greetingAt(new Date(now()).getHours()) }
      changed()
    },

    /** Feeds one host hook payload. Synchronous and exception-safe: observing can never disturb the agent. */
    observe(name, payload) {
      try {
        applyLanguage()
        const ev = normalizeHook('claude', { ...payload, hook_event_name: name, session_id: payload?.session_id ?? s.sid, cwd: payload?.cwd ?? s.cwd }, now())
        if (!ev) return
        if (!s.rec) s.rec = newRecord(ev)
        // Back after a long absence: a greeting for the time of day. And the stretch of work goes on, or begins again after a pause.
        const at = now()
        if (greet && ev.kind === 'prompt' && s.rec.last && at - s.rec.last > GREET_AFTER) { s.react = at; s.reaction = greetingAt(new Date(at).getHours()) }
        if (!s.work.last || at - s.work.last > restMs()) s.work = { since: at, last: at }
        else s.work.last = at
        reduce(s.rec, ev)
        if (ev.kind === 'prompt') affection.feel(payload?.prompt, now())
        // The moments that make a sound, read from the events themselves: the agent asks the user something (a permission or a
        // question), or a turn ends well.
        if (ev.kind === 'perm' || (ev.kind === 'tool_start' && ev.act === 'ask')) moments.cue('question')
        if (ev.kind === 'turn_end' && ev.reason === 'done') moments.cue('finish')
        s.dirty = true
        if (ev.commit) void lookupCommit(ev)
        moments.checkMilestones()
        changed()
      } catch { /* never throw into the host */ }
    },

    flush,
    refreshOthers,
    records,

    /** The system's language, found by the host after the controller was made (a supported code); used while the pet's language is "auto". */
    setLocale(code) { s.locale = code; applyLanguage(); changed() },

    /** Picks up what another window or the Codex hook saved to the pet. Cheap (one small file), so it is done before every prompt is
     *  judged: the hearts the judgment starts from are then the latest, not ones from minutes ago. */
    async syncPet() { if (await reloadPet()) changed() },

    /** A sound moment the host reports itself (a turn that ended well). */
    cue(moment) { moments.cue(moment); changed() },

    /** The messages for milestones reached since the last call. */
    takeToasts: () => moments.takeToasts(),

    /** The sound moments that happened since the last call (`question`, `finish`), each with its sound and the volume. */
    takeCues: () => moments.takeCues(),

    /** The next time the displayed state changes by itself (a celebration ends, a wait times out); undefined if never. */
    nextTick(at = now()) {
      const live = s.rec?.live
      const marks = [s.react + REACTION_LENGTH[s.reaction]]
      if (s.rec && live) marks.push(live.err + WINDOWS.error, live.ok + WINDOWS.success, live.te + WINDOWS.finished, live.te + WINDOWS.waiting, s.rec.last + WINDOWS.bored, s.rec.last + WINDOWS.coffee, s.rec.last + WINDOWS.stale, live.err + WINDOWS.investigate)
      const next = marks.filter(t => t > at)
      return next.length ? Math.min(...next) - at : undefined
    },

    /** The plan's usage as the host reports it (`$.session.usage()`): the rate-limit windows. Read only; nothing is stored. */
    setUsage(usage) {
      const next = usage ? { at: now(), limits: Array.isArray(usage.rateLimits) ? usage.rateLimits : [], cost: usage.cost ?? null, context: Number.isFinite(usage.context?.percent) ? usage.context.percent : null } : null
      // A window that reset since the last reading, or whose time has come, is a moment worth a sound (and a word).
      applyLanguage()
      const tracked = trackResets(s.watch, next, now())
      for (const moment of new Set([...resetsBetween(s.usage, next, now()), ...tracked.due])) { moments.cue(moment); s.toasts.push(resetText(moment)) }
      s.watch = tracked.watch
      const watchText = JSON.stringify(s.watch)
      if (s.dir && watchText !== s.watchText) { s.watchText = watchText; void Promise.resolve(io.write(file('usage-watch.json'), watchText)).catch(() => {}) }
      s.usage = next
      changed()
    },

    /** The break reminder: once a stretch of work has gone on as long as the pet was asked to allow, it suggests a pause (a message and a stretch),
     *  and asks again after another stretch. Called now and then by the host. Returns whether it spoke. */
    checkBreak() {
      const every = s.pet?.prefs.breakEvery
      if (!every || !s.work.last) return false
      const at = now()
      if (at - s.work.last > restMs() || at - s.work.since < every * 60_000) return false
      applyLanguage()
      s.toasts.push(t('toast.break', { time: duration(at - s.work.since) }))
      s.work.since = at
      s.react = at; s.reaction = 'stretch'
      changed()
      return true
    },

    /** Saves the pet card (an SVG with the pet and a few of its numbers) to the data folder, and says where (a message, and the pane shows the path).
     *  `notify: false` is for the command, which answers in its own words. */
    async saveCard({ notify = true } = {}) {
      applyLanguage()
      const m = api.model()
      const all = aggregate(records(), { now: now() })
      const svg = cardSvg({ name: m.pet.name, character: m.pet.character, colors: m.pet.colors, worn: m.pet.worn, frame: m.pet.frame, motion: m.pet.motion, hearts: m.pet.hearts, streak: m.life.current, ageDays: m.age.days, prompts: all.prompts, tools: all.tools.total, done: m.achievements.done, total: m.achievements.total })
      const slug = m.pet.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'pet'
      const target = file('cards', 'codepuff-' + slug + '.svg')
      await io.write(target, svg)
      if (notify) s.toasts.push(t('cmd.card.saved', { file: target }))
      changed()
      return { file: target }
    },

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
      applyLanguage()
      const pet = s.pet ?? defaultPet(at)
      const today = dayKey(at)
      const all = records()
      let mine = s.rec ? stateOf(s.rec, at) : { state: 'idle', label: t('state.idle'), helpers: 0, since: at, agent: 'claude', session: sessionKey(s.sid), project: '', running: false }
      // Tired: the plan's limit is nearly used up. It shows while the pet has nothing else to do (working states stay as they are).
      const tired = tiredOf(s.usage, at)
      if (tired && ['idle', 'waiting', 'finished', 'success'].includes(mine.state)) mine = { ...mine, state: 'tired', label: labelFor('tired', { percent: tired.percent, kind: tired.kind }) }
      // Down: the user has been unkind, and the pet has nothing else to do.
      const hearts = heartsOf(pet.affection.score)
      if (pet.prefs.mood && hearts <= SAD_AT && ['idle', 'waiting', 'finished', 'success', 'tired'].includes(mine.state)) mine = { ...mine, state: 'sad', label: labelFor('sad') }
      // A click makes the pet happy for a moment, unless the agent needs the user (that always wins).
      // (A greeting or a stretch is only for when the pet has nothing else to do: work, a failure and a celebration come first.)
      const ambient = AMBIENT.includes(s.reaction) && (mine.running || ['error', 'success', 'finished'].includes(mine.state))
      if (at - s.react < REACTION_LENGTH[s.reaction] && mine.state !== 'permission' && !ambient) mine = { ...mine, state: s.reaction, label: t('reaction.' + s.reaction) }
      const others = focus(all.filter(r => r !== s.rec), at)
      const life = activity(all, { today })
      // What the milestones count, over everything this pet has seen (both agents).
      const counts = lifeOf(all, at)
      const planNow = planWindows(s.usage, at)
      const age = petAge(pet.createdAt, at)
      // Platform first (this host's own, then the other, then both), then the period. "This session" only exists for the host's
      // own platform: for the other agent or for both there is no one session to speak of.
      const agent = s.ui.agent
      const periods = agent === host ? PERIODS : PERIODS.filter(period => period !== 'session')
      const scope = periods.includes(s.ui.scope) ? s.ui.scope : '7d'
      const range = scope === '7d' ? { since: addDays(today, -6) } : scope === '30d' ? { since: addDays(today, -29) } : {}
      const stats = scope === 'session'
        ? aggregate(s.rec ? [s.rec] : [], { now: at })
        : aggregate(all, { agent, now: at, ...range })
      // The session's cost, as the host's /cost totals it: an estimate, never the bill. Only for this session of this host, and only when
      // the host keeps a ledger at all (a missing figure is left out, never shown as zero).
      const costKnown = Number.isFinite(s.usage?.cost?.usd)
      const costUsd = scope === 'session' && agent === host && costKnown ? s.usage.cost.usd : null
      const tiles = statTiles(stats)
      const rows = statRows(stats)
      if (costUsd !== null) {
        tiles.push({ id: 'cost', label: t('stats.tile.cost'), value: usd(costUsd), note: t('stats.tile.cost.note') })
        rows.splice(rows.findIndex(row => row.id === 'time') + 1, 0, { id: 'cost', label: t('stats.row.cost'), value: usd(costUsd) })
      }
      const week = series(all, { days: 14, today, agent })
      const peak = Math.max(1, ...week.map(d => d.tools))
      const todayStats = aggregate(all, { since: today, until: today, now: at })
      // How this session's tasks went, as the agent reported them (every tool call's success or failure).
      const session = s.rec ? aggregate([s.rec], { now: at }).tools : { ok: 0, failed: 0 }
      return {
        pet: { name: displayName(pet), isCustom: !!pet.name, character: pet.character, colors: pet.colors, motion: pet.prefs.motion, line: pet.prefs.line, band: pet.prefs.band, hearts: heartsOf(pet.affection.score), heartScore: pet.affection.score, mood: pet.prefs.mood, accessory: pet.prefs.accessory, worn: wornOf(pet), frame: frameOf(pet), breakEvery: pet.prefs.breakEvery, breakRest: pet.prefs.breakRest, bandFrame: frameOf(pet), sounds: pet.prefs.sounds, volume: pet.prefs.volume, bandSize: pet.prefs.bandSize, bandHeight: BAND_SIZES[pet.prefs.bandSize], language: pet.prefs.language, plan: pet.prefs.plan, createdAt: pet.createdAt },
        language: getLanguage(),
        // What the pet can wear and what unlocks it, and every milestone with whether it has been reached.
        // Everything that can be earned (an accessory, a palette, a card frame) and whether it has been.
        accessories: ACCESSORIES.map(item => ({ id: item.id, name: t('acc.' + item.id), unlocked: isOpen(item, pet.milestones) })),
        frames: FRAMES.map(item => ({ id: item.id, name: t('frame.' + item.id), unlocked: isOpen(item, pet.milestones) })),
        palettes: Object.fromEntries(PALETTE_REWARDS.map(item => [item.id, isOpen(item, pet.milestones)])),
        achievements: {
          done: MILESTONES.filter(m => (pet.milestones ?? []).includes(m.id)).length,
          total: MILESTONES.length,
          // One card for each thing that is counted: it levels up (bronze, silver, gold, diamond) as the count passes each goal. `tier` is
          // the metal reached so far (null before the first), `current` and `target` the count toward the next goal.
          groups: [...new Set(MILESTONES.map(m => m.kind))].map(kind => {
            const steps = MILESTONES.filter(m => m.kind === kind)
            const reachedSteps = steps.filter(m => (pet.milestones ?? []).includes(m.id))
            const top = reachedSteps.at(-1) ?? null
            const next = steps.find(m => !reachedSteps.includes(m)) ?? null
            const reward = next ? rewardFor(next.id) : null
            const count = steps[0].count(counts)
            return {
              kind, title: t('ach.' + kind), tier: top ? top.tier : null, tierName: top ? t('tier.' + TIER_NAMES[top.tier]) : null,
              levels: steps.map(m => ({ id: m.id, tier: m.tier, n: m.n, reached: reachedSteps.includes(m) })),
              complete: !next, current: next ? Math.min(next.n, count) : steps.at(-1).n, target: next ? next.n : steps.at(-1).n,
              nextName: next ? t('tier.' + TIER_NAMES[next.tier]) : null, reward: reward ? t(reward.key) : null,
            }
          }),
        },
        age, life: { current: life.current, longest: life.longest, last: life.last, days: life.total },
        me: mine,
        outcome: { ok: session.ok, failed: session.failed },
        tired,
        plan: planNow,
        // The one-line status under the prompt: what the pet is doing, then what is worth a glance (the context, the plan's limits, the cost).
        statusLine: [displayName(pet) + ' · ' + mine.label, ...(Number.isFinite(s.usage?.context) ? [t('line.context', { n: Math.round(s.usage.context) })] : []), ...planNow.filter(w => w.id === 'five_hour' || w.id === 'seven_day').map(w => `${w.label} ${w.percent}%`), ...(costKnown ? [usd(s.usage.cost.usd, false)] : [])].join(' · '),
        // This session's cost for the compact band, told plain ("$0.14": the statistics say it is an estimate); null when the host reports none.
        sessionCost: costKnown ? usd(s.usage.cost.usd, false) : null,
        others: others.current.agent ? [others.current, ...others.others].slice(0, 3) : [],
        otherCount: others.current.agent ? 1 + others.others.length : 0,
        today: { prompts: todayStats.prompts, tools: todayStats.tools.total, tests: todayStats.tests.run, passed: todayStats.tests.passed, commits: todayStats.git.commits },
        stats: { rows, tiles, bars: statBars(stats), ok: stats.tools.ok, failed: stats.tools.failed },
        // Which days these numbers cover, in a few words (the buttons already say "7 days" or "This session").
        rangeLabel: scope === 'session' ? [s.rec?.pname, s.rec ? t('ui.range.started', { ago: ago(s.rec.started, at) }) : t('ui.range.nothing')].filter(Boolean).join(' · ') : scope === 'all' ? (firstDay(all, agent) ? t('ui.range.since', { day: shortDay(firstDay(all, agent)) }) : t('ui.range.none')) : `${shortDay(range.since)} – ${shortDay(today)}`,
        host,
        platforms: host === 'codex' ? ['codex', 'claude', 'all'] : ['claude', 'codex', 'all'],
        periods,
        period: scope,
        chart: week.map(d => ({ day: d.day, tools: d.tools })),
        scopeLabel: scope === 'session' ? t('ui.scope.session', { agent: AGENT_LABELS[agent] }) : scope === 'all' ? t('ui.scope.all', { agent: AGENT_LABELS[agent] }) : t('ui.scope.days', { n: Number(scope.slice(0, -1)), agent: AGENT_LABELS[agent] }),
        spark: week.map(d => BLOCKS[Math.min(7, Math.floor((d.tools / peak) * 7.999))]).join(''),
        ui: s.ui,
        health: s.health,
        sessionLabel: s.rec?.pname || '',
        sessionPrompts: s.rec ? aggregate([s.rec], { now: at }).prompts : 0,
      }
    },

    setUi(patch) {
      const next = { ...s.ui, ...patch }
      if (!['stats', 'look', 'achievements', 'settings'].includes(next.tab)) next.tab = 'stats'
      if (!SCOPES.includes(next.scope)) next.scope = 'session'
      if (!AGENT_FILTERS.includes(next.agent)) next.agent = host
      // "This session" belongs to the host's own platform only.
      if (next.scope === 'session' && next.agent !== host) next.scope = '7d'
      next.details = next.details === true
      s.ui = next
      changed()
    },

    /** Applies a validated change to the pet's identity or look, and saves it at once. */
    async setPet(patch) {
      const merged = { ...s.pet, ...patch, colors: { ...s.pet.colors, ...(patch.colors ?? {}) }, prefs: { ...s.pet.prefs, ...(patch.prefs ?? {}), sounds: { ...s.pet.prefs.sounds, ...(patch.prefs?.sounds ?? {}) } } }
      s.pet = sanitizePet(merged, now()).pet
      applyLanguage()
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
      try { text = await io.read(path) } catch { return { ok: false, error: t('err.read', { path }) } }
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

    /** The /codepuff slash command (see commands.js). @returns {Promise<{ text: string, open?: boolean }>} */
    command: args => { applyLanguage(); return runCommand(api, args) },

    ago: t => ago(t, now()),
  }
  return api
}
