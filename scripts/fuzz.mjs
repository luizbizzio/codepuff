// Developer tool: fuzzing. Random garbage goes into the hook normalizer, the insult judge, the saved-data cleaners, the Claude mod's
// controller (a stream of events, commands and settings) and the picture builder; nothing may throw and the invariants must hold.
//   node scripts/fuzz.mjs        (prints NO FAILURES, or each distinct failure with an example input)
// Fuzzing: random garbage into the engine and the mod's controller; nothing may throw, and the invariants must hold.
const root = new URL('../src/', import.meta.url).href
const { normalizeHook } = await import(root + 'core/normalize.js')
const { judge, heartsOf, felt } = await import(root + 'core/mood.js')
const { sanitizePet, defaultPet } = await import(root + 'core/settings.js')
const { sanitizeRecord } = await import(root + 'core/records.js')
const { parseBackup } = await import(root + 'core/backup.js')
const { createController } = await import(root + 'claude/controller.js')
const { petSvg } = await import(root + 'core/render/raster.js')
const { STATES } = await import(root + 'core/petstate.js')
const { REACTIONS } = await import(root + 'core/art/anim.js')
const { MASCOT_IDS } = await import(root + 'core/art/registry.js')
const { aggregate } = await import(root + 'core/aggregate.js')

let seed = 12345
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
const pick = list => list[Math.floor(rnd() * list.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const WEIRD = [undefined, null, 0, -1, 1.5, NaN, Infinity, '', ' ', 'x'.repeat(5000), '\u0000', '​', '💥', true, false, [], {}, [1, 2], { a: 1 }, '../../etc', '$(rm -rf)', '<script>', "'; --", '\\u202e', 'constructor', '__proto__']
const weird = () => pick(WEIRD)
const randomText = () => Array.from({ length: int(0, 40) }, () => String.fromCodePoint(pick([int(32, 126), int(0x80, 0x24f), int(0x4e00, 0x4e50), int(0x1f300, 0x1f330), 0x200b, 0x202e, 0x0301, 10, 9]))).join('')
const J = x => { try { return JSON.stringify(x, (k, v) => (typeof v === 'bigint' ? 'big' : typeof v === 'symbol' ? 'sym' : typeof v === 'function' ? 'fn' : v)) } catch { return '?' } }
const failures = new Map()
const note = (area, error, input) => { const key = area + ': ' + String(error?.message ?? error).slice(0, 120); if (!failures.has(key)) failures.set(key, input) }
const guard = (area, input, fn) => { try { const out = fn(); return out && typeof out.then === 'function' ? out.catch(error => note(area, error, input)) : out } catch (error) { note(area, error, input) } }

// 1. hook payloads of every shape
const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'TurnStart', 'Stop', 'StopFailure', 'Interrupt', 'PermissionRequest', 'PermissionDenied', 'SubagentStart', 'SubagentStop', 'PreModelRequest', 'PostModelRequest', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Nonsense', weird()]
const TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob', 'WebFetch', 'Task', 'AskUserQuestion', 'TodoWrite', 'mcp__x__y', 'apply_patch', 'shell', weird()]
const randomPayload = () => {
  const p = {}
  for (const key of ['session_id', 'cwd', 'agent_id', 'tool_name', 'tool_use_id', 'prompt', 'error', 'status', 'kind', 'source', 'is_interrupt', 'hook_event_name']) if (rnd() < 0.6) p[key] = rnd() < 0.5 ? (key === 'tool_name' ? pick(TOOLS) : key === 'prompt' ? randomText() : key === 'session_id' ? pick(['a', 'b', 'c']) : weird()) : weird()
  if (rnd() < 0.7) p.tool_input = pick([weird(), { command: weird() }, { command: pick(['git commit -m x', 'npm test', 'ls | tail', 'git status', 'pytest -q']) }, { file_path: weird() }, { file_path: '/a/b' }, { questions: weird() }])
  if (rnd() < 0.7) p.tool_response = pick([weird(), { stdout: weird(), exitCode: weird() }, 'Exit code: 1', 'Exit code: 0', { is_error: true }])
  return p
}
for (let i = 0; i < 30000; i++) {
  const agent = pick(['claude', 'codex', weird()])
  const payload = randomPayload()
  guard('normalizeHook', J([agent, String(payload.tool_name)]), () => normalizeHook(agent, { ...payload, hook_event_name: pick(EVENTS) }, int(0, 2e12)))
}

// 2. judge and the affection maths
for (let i = 0; i < 30000; i++) {
  const text = rnd() < 0.2 ? weird() : randomText()
  const verdict = guard('judge', String(text).slice(0, 60), () => judge(text))
  if (verdict && !([0, 1, 2].includes(verdict.insult) && typeof verdict.kind === 'boolean')) note('judge shape', J(verdict), text)
  const aff = { score: int(1, 100), day: '2026-11-0' + int(1, 9), at: int(0, 1e12) }
  const next = guard('felt', '', () => felt(aff, verdict ?? { insult: 0, kind: false }, '2026-11-1' + int(0, 9), int(0, 2e12)))
  if (next && !(next.score >= 1 && next.score <= 100 && heartsOf(next.score) >= 1 && heartsOf(next.score) <= 5)) note('felt out of range', J(next), '')
}
// a long text must not stall the matcher
for (const text of ['`'.repeat(100000), '```' + 'a'.repeat(100000), ' '.repeat(100000), 'you '.repeat(50000) + 'idiot', '\n'.repeat(100000)]) {
  const t = performance.now(); judge(text); const ms = performance.now() - t
  if (ms > 100) note('judge slow', ms.toFixed(0) + ' ms', text.slice(0, 10))
}

// 3. saved data of every shape
const garbage = depth => {
  if (depth > 3) return weird()
  const r = rnd()
  if (r < 0.3) return weird()
  if (r < 0.5) return Array.from({ length: int(0, 4) }, () => garbage(depth + 1))
  const o = {}
  for (const key of ['v', 'id', 'createdAt', 'name', 'character', 'colors', 'prefs', 'body', 'accent', 'motion', 'band', 'bandSize', 'sounds', 'volume', 'mood', 'affection', 'score', 'day', 'at', 'milestones', 'seen', 'days', 'live', 'agent', 'sid', 'last', 'tl', 'ok', 'c', '__proto__', 'constructor']) if (rnd() < 0.35) o[key] = garbage(depth + 1)
  return o
}
for (let i = 0; i < 20000; i++) {
  const g = JSON.parse(J(garbage(0)) ?? 'null')
  const pet = guard('sanitizePet', J(g)?.slice(0, 80), () => sanitizePet(g, 1e12))
  if (pet) {
    const p = pet.pet
    const ok = p && typeof p.name === 'string' && p.name.length <= 16 && p.affection.score >= 1 && p.affection.score <= 100 && Array.isArray(p.seen) && ['small', 'medium', 'large'].includes(p.prefs.bandSize) && ['low', 'medium', 'high'].includes(p.prefs.volume) && typeof p.prefs.mood === 'boolean'
    if (!ok) note('sanitizePet invariants', J(p)?.slice(0, 200), J(g)?.slice(0, 100))
  }
  guard('sanitizeRecord', J(g)?.slice(0, 80), () => sanitizeRecord(g))
  guard('parseBackup', '', () => parseBackup(rnd() < 0.5 ? J(g) : randomText()))
  guard('aggregate', '', () => aggregate([guard('x', '', () => sanitizeRecord(g)), g].filter(Boolean), {}))
}

// 4. the controller: a stream of random events, with the model read all the way
let clock = 1_800_000_000_000
const files = new Map()
const io = {
  dataDir: async () => '/d',
  read: async p => { const t = files.get(p.replace(/\\/g, '/')); if (t === undefined) throw new Error('ENOENT'); return t },
  write: async (p, t) => { files.set(p.replace(/\\/g, '/'), t) },
  list: async p => { const b = p.replace(/\\/g, '/').replace(/\/$/, '') + '/'; const out = [...files.entries()].filter(([k]) => k.startsWith(b) && !k.slice(b.length).includes('/')).map(([k, v]) => ({ name: k.slice(b.length), kind: 'file', size: v.length, mtimeMs: v.length })); if (!out.length) throw new Error('ENOENT'); return out },
  now: () => clock,
  run: async () => ({ exitCode: pick([0, 1]), stdout: weird() }),
}
const ctl = createController(io, { host: pick(['claude', 'codex']) })
await ctl.init({ sid: 's1', cwd: '/w' })
for (let i = 0; i < 20000; i++) {
  clock += int(0, 4000) * (rnd() < 0.02 ? 5000 : 1)
  const r = rnd()
  guard('observe', '', () => ctl.observe(pick(EVENTS.filter(e => typeof e === 'string')), randomPayload()))
  if (r < 0.04) guard('pat', '', () => ctl.pat())
  if (r > 0.96) guard('setUsage', '', () => ctl.setUsage(pick([null, undefined, {}, { rateLimits: weird() }, { rateLimits: [{ kind: pick(['five_hour', 'seven_day', weird()]), percentUsed: pick([int(0, 100), weird()]), resetsAt: pick([new Date(clock + int(-1e7, 1e8)).toISOString(), weird(), null]) }] }])))
  if (r > 0.93 && r < 0.94) await guard('setUi', '', () => ctl.setUi({ agent: weird(), scope: weird(), tab: weird(), details: weird() }))
  if (r > 0.92 && r < 0.93) await guard('setPet', '', () => ctl.setPet({ name: weird(), character: weird(), colors: { body: weird() }, prefs: { band: weird(), bandSize: weird(), volume: weird(), mood: weird(), sounds: { question: weird() } } }))
  if (r > 0.9 && r < 0.91) await guard('command', '', () => ctl.command(pick(['', 'band large', 'sound finish tada', 'volume low', 'mood off', 'stats 7d', randomText(), 'reset stats', 'import /nope'])))
  if (i % 7 === 0) {
    const m = guard('model', '', () => ctl.model())
    if (m) {
      if (!STATES.includes(m.me.state) && !REACTIONS.includes(m.me.state) && m.me.state !== 'tired') note('unknown state', m.me.state, '')
      if (!(m.pet.hearts >= 1 && m.pet.hearts <= 5)) note('hearts', m.pet.hearts, '')
      if (m.outcome.ok < 0 || m.outcome.failed < 0 || !Number.isFinite(m.outcome.ok)) note('outcome', J(m.outcome), '')
      if (!m.periods.includes(m.period)) note('period not offered', m.period + ' of ' + m.periods, '')
      if (m.ui.agent !== m.host && m.period === 'session') note('session on the wrong platform', m.ui.agent, '')
      if (m.stats.tiles.some(t => /NaN|undefined|Infinity/.test(t.value + t.note))) note('tile text', J(m.stats.tiles), '')
      if (m.plan.some(w => !(w.percent >= 0 && w.percent <= 100))) note('plan percent', J(m.plan), '')
      const svg = guard('petSvg(model)', '', () => petSvg({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers: m.me.helpers, height: m.pet.bandHeight, crop: 'band', hover: true, title: m.me.label }))
      if (svg && /NaN|undefined/.test(svg)) note('svg NaN', m.me.state, J({ helpers: m.me.helpers, bh: m.pet.bandHeight, colors: m.pet.colors, ch: m.pet.character, at: svg.slice(Math.max(0, svg.search(/NaN|undefined/) - 60), svg.search(/NaN|undefined/) + 30) }))
    }
    guard('takeCues', '', () => ctl.takeCues()); guard('takeToasts', '', () => ctl.takeToasts())
  }
  if (i % 500 === 0) await guard('flush', '', () => ctl.flush())
}

// 5. the picture builder with options that are not what it expects
for (let i = 0; i < 3000; i++) {
  const o = { character: pick([...MASCOT_IDS, 'nope', weird()]), state: pick([...STATES, ...REACTIONS, 'nope', weird()]), colors: pick([{}, { body: weird() }, { body: '#12345g' }, { body: '#abc' }, { accent: weird() }, weird()]), helpers: pick([0, 1, 3, 99, -2, weird()]), scale: pick([1, 2.5, 0, -1, weird()]), reduced: weird(), height: pick([undefined, 48, 0, weird()]), crop: pick([undefined, 'band', weird()]), hover: weird(), title: pick([undefined, randomText(), weird()]) }
  const svg = guard('petSvg options', J(o)?.slice(0, 120), () => petSvg(o))
  if (svg && /NaN|undefined/.test(svg) && !MASCOT_IDS.includes(o.character)) { /* unknown character: allowed to fall back */ }
}

console.log(failures.size ? 'FAILURES: ' + failures.size : 'NO FAILURES')
for (const [key, input] of failures) console.log(' -', key, '| e.g.', String(input).slice(0, 140))
