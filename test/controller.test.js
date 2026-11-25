import test from 'node:test'
import assert from 'node:assert/strict'
import { createController } from '../src/claude/controller.js'
import { openStore } from '../src/node/store.js'
import { normalizeHook } from '../src/core/normalize.js'
import { WINDOWS } from '../src/core/petstate.js'
import { greetingAt, REACTION_LENGTH } from '../src/claude/constants.js'
import { cardSvg } from '../src/core/card.js'
import { T0, tempDir } from './helpers.js'

/** An in-memory stand-in for the host's file system, with the same limits: read, write, list, no append, no delete. */
function fakeHost({ run } = {}) {
  const files = new Map()
  const clock = { at: T0 }
  const norm = p => p.replace(/\\/g, '/')
  const io = {
    dataDir: async () => '/data/.codepuff',
    read: async p => { const t = files.get(norm(p)); if (t === undefined) throw new Error('ENOENT'); return t },
    write: async (p, t) => { files.set(norm(p), t) },
    list: async p => {
      const base = norm(p).replace(/\/$/, '') + '/'
      const out = [...files.entries()].filter(([k]) => k.startsWith(base) && !k.slice(base.length).includes('/')).map(([k, v]) => ({ name: k.slice(base.length), kind: 'file', size: v.length, mtimeMs: clock.at + v.length }))
      if (!out.length) throw new Error('ENOENT')
      return out
    },
    now: () => clock.at,
    run,
  }
  return { io, files, clock }
}

const payload = (extra = {}) => ({ session_id: 'chat-1', cwd: '/work/app', ...extra })
const tool = (id, name, input) => ({ tool_name: name, tool_input: input, tool_use_id: id })

test('the mod controller records a Claude session and persists it in the shared layout', async () => {
  const { io, files, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'chat-1', cwd: '/work/app' })
  ctl.observe('UserPromptSubmit', payload({ prompt: 'secret words' }))
  clock.at += 500
  ctl.observe('PreToolUse', payload(tool('a', 'Bash', { command: 'npm test' })))
  assert.equal(ctl.model().me.state, 'testing')
  clock.at += 2000
  ctl.observe('PostToolUse', payload({ ...tool('a', 'Bash', { command: 'npm test' }), tool_response: {} }))
  assert.equal(ctl.model().me.state, 'success')
  await ctl.flush()
  const stored = files.get('/data/.codepuff/sessions/claude/chat-1.json')
  assert.ok(stored)
  assert.ok(!stored.includes('secret words'))
  assert.ok(files.has('/data/.codepuff/pet.json'))
  const m = ctl.model()
  assert.equal(m.today.prompts, 1)
  assert.equal(m.today.tests, 1)
  assert.equal(m.me.project, 'app')
})

test('a record written by the mod is read by the Node side, and the other way round (one shared history)', async () => {
  const { dir, done } = tempDir()
  try {
    const { io, files, clock } = fakeHost()
    const ctl = createController(io)
    await ctl.init({ sid: 'chat-1', cwd: '/work/app' })
    ctl.observe('UserPromptSubmit', payload())
    await ctl.flush()

    // Copy what the mod wrote into a real data folder and read it with the Node store.
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    mkdirSync(join(dir, 'sessions', 'claude'), { recursive: true })
    writeFileSync(join(dir, 'sessions', 'claude', 'chat-1.json'), files.get('/data/.codepuff/sessions/claude/chat-1.json'))
    writeFileSync(join(dir, 'pet.json'), files.get('/data/.codepuff/pet.json'))
    const store = openStore(dir)
    assert.equal(store.listRecords().length, 1)
    assert.equal(store.ensurePet().id, ctl.pet.id)

    // A Codex hook process writes its own record into the same layout; the mod sees it on its next refresh.
    store.applyEvent(normalizeHook('codex', { hook_event_name: 'UserPromptSubmit', session_id: 'thr', cwd: '/work/api', turn_id: 't' }, clock.at))
    files.set('/data/.codepuff/sessions/codex/thr.json', readFileSyncText(join(dir, 'sessions', 'codex', 'thr.json')))
    await ctl.refreshOthers()
    const m = ctl.model()
    assert.equal(m.otherCount, 1)
    assert.equal(m.others[0].agent, 'codex')
    ctl.setUi({ scope: 'all', agent: 'all' })
    assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '2', 'lifetime includes both agents')
    ctl.setUi({ scope: 'session', agent: 'claude' })
    assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '1', 'this session is only this chat')
    assert.deepEqual(ctl.model().periods, ['session', '7d', '30d', 'all'], 'Claude Code (the host) offers this session')
    assert.deepEqual(ctl.model().platforms, ['claude', 'codex', 'all'], 'the host is listed first')
    // For the other platform, or for both, there is no one session: the period moves on.
    ctl.setUi({ agent: 'codex' })
    assert.deepEqual(ctl.model().periods, ['7d', '30d', 'all'])
    assert.equal(ctl.model().ui.scope, '7d')
    ctl.setUi({ agent: 'all', scope: 'session' })
    assert.equal(ctl.model().ui.scope, '7d', 'asking for this session on Combined is answered with 7 days')
    assert.equal(ctl.model().sessionPrompts, 1, 'the band counts this chat only')
    ctl.setUi({ scope: 'all', agent: 'codex' })
    assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '1')
  } finally { done() }
})
const readFileSyncText = path => readFileSync(path, 'utf8')
import { readFileSync } from 'node:fs'

test('a new chat starts a fresh session while the pet and lifetime statistics carry over', async () => {
  const { io, clock } = fakeHost()
  const first = createController(io)
  await first.init({ sid: 'chat-1', cwd: '/w' })
  await first.setPet({ name: 'Biscuit', character: 'claude', colors: { body: '#ff8800' } })
  first.observe('UserPromptSubmit', payload())
  first.observe('UserPromptSubmit', payload())
  await first.flush()

  clock.at += 3_600_000
  const second = createController(io) // a new chat = a new process, same data folder
  await second.init({ sid: 'chat-2', cwd: '/w' })
  assert.equal(second.pet.name, 'Biscuit')
  assert.equal(second.pet.character, 'claude')
  assert.equal(second.pet.id, first.pet.id)
  assert.equal(second.model().stats.rows.find(r => r.id === 'prompts').value, '0', 'session scope starts fresh')
  second.setUi({ scope: 'all' })
  assert.equal(second.model().stats.rows.find(r => r.id === 'prompts').value, '2', 'lifetime remains')
})

test('resuming an old chat continues the same record instead of making a second session', async () => {
  const { io, clock } = fakeHost()
  const a = createController(io)
  await a.init({ sid: 'chat-1', cwd: '/w' })
  a.observe('UserPromptSubmit', payload())
  await a.flush()
  clock.at += 86_400_000
  const b = createController(io)
  await b.init({ sid: 'chat-1', cwd: '/w' })
  b.observe('SessionStart', payload({ source: 'resume' }))
  b.observe('UserPromptSubmit', payload())
  b.setUi({ scope: 'all' })
  const rows = b.model().stats.rows
  assert.equal(rows.find(r => r.id === 'sessions').value, '1')
  assert.equal(rows.find(r => r.id === 'prompts').value, '2')
})

test('settings: validated, saved at once, and the same when another chat opens', async () => {
  const { io, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  await ctl.setPet({ name: '  A very very long pet name indeed  ', character: 'claude', colors: { body: '#123456', accent: 'nope' } })
  assert.equal(ctl.pet.name.length, 16)
  assert.equal(ctl.pet.colors.accent, null)
  const saved = JSON.parse(files.get('/data/.codepuff/pet.json'))
  assert.equal(saved.character, 'claude')
  assert.equal(saved.colors.body, '#123456')
  const other = createController(io)
  await other.init({ sid: 'b', cwd: '/w' })
  assert.equal(other.model().pet.character, 'claude')
  assert.equal(other.model().pet.name, 'A very very long')
})

test('commands: text control of name, character, palette and restore', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.match((await ctl.command('name Mochi')).text, /Mochi/)
  assert.equal(ctl.pet.name, 'Mochi')
  assert.match((await ctl.command('character claude')).text, /Statistics and progress are unchanged/)
  assert.match((await ctl.command('palette mint')).text, /Mint/)
  assert.equal(ctl.pet.colors.body, '#7be0b8')
  assert.match((await ctl.command('body red')).text, /Use a color/)
  assert.match((await ctl.command('character dragon')).text, /Characters/)
  await ctl.command('restore')
  assert.deepEqual({ n: ctl.pet.name, c: ctl.pet.character, b: ctl.pet.colors.body }, { n: '', c: 'classic', b: null })
  assert.equal((await ctl.command('')).open, true)
  assert.match((await ctl.command('wat')).text, /Unknown option/)
  assert.match((await ctl.command('help')).text, /export/)
})

test('statistics view text is complete and shows Unavailable instead of inventing numbers', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PostToolUse', payload({ ...tool('c', 'Bash', { command: 'git commit -m x' }), tool_response: {} }))
  await new Promise(r => setTimeout(r, 5))
  const text = (await ctl.command('stats all')).text
  assert.match(text, /Prompts submitted: 1/)
  assert.match(text, /Git commits observed: 0 \(\+1 not verifiable\)/)
  assert.match(text, /Lines added in those commits: —/)
})

test('a commit is read from git through the host when possible, once', async () => {
  const hash = 'd'.repeat(40)
  const host = fakeHost({
    run: async () => ({ exitCode: 0, stdout: `${hash}\x1f${Math.floor(T0 / 1000)}\x1f${'e'.repeat(40)}\n\n7\t1\ta.js\n` }),
  })
  const ctl = createController(host.io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PostToolUse', payload({ ...tool('c1', 'Bash', { command: 'git commit -m x' }), tool_response: {} }))
  await new Promise(r => setTimeout(r, 10))
  ctl.setUi({ scope: 'all' })
  const rows = ctl.model().stats.rows
  assert.equal(rows.find(r => r.id === 'commits').value, '1')
  assert.equal(rows.find(r => r.id === 'added').value, '7')
  assert.equal(rows.find(r => r.id === 'removed').value, '1')
})

test('without a way to run git, line counts read Unavailable', async () => {
  const ctl = createController(fakeHost().io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('PostToolUse', payload({ ...tool('c1', 'Bash', { command: 'git commit -m x' }), tool_response: {} }))
  await new Promise(r => setTimeout(r, 5))
  assert.equal(ctl.health.git, 'unavailable')
})

test('export, import and reset work through the host file API, with a safety backup before a reset', async () => {
  const { io, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload({ session_id: 'a' }))
  await ctl.flush()
  const exported = await ctl.command('export')
  const path = /to (\S+)/.exec(exported.text)[1]
  assert.ok(files.get(path).includes('codepuff-backup'))

  assert.match((await ctl.command('reset stats')).text, /Run: \/codepuff reset stats confirm/, 'asks for confirmation first')
  assert.equal(ctl.model().stats.rows.length > 0, true)
  const reset = await ctl.command('reset stats confirm')
  assert.match(reset.text, /Statistics reset/)
  assert.equal(files.get('/data/.codepuff/sessions/claude/a.json'), '', 'emptied, not deleted: the host cannot delete')
  ctl.setUi({ scope: 'all' })
  assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '0')
  assert.equal(ctl.pet.name, '', 'the pet is untouched')

  const imported = await ctl.command('import ' + path)
  assert.match(imported.text, /Imported 1 sessions/)
  assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '1')
  assert.match((await ctl.command('import /nope.json')).text, /Could not read/)
  files.set('/bad.json', '{"format":"nope"}')
  assert.match((await ctl.command('import /bad.json')).text, /not a CodePuff backup/)
})

test('pat is a visual reaction only: no counters change and a permission wait still wins', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.pat()
  assert.equal(ctl.model().me.state, 'petted')
  clock.at += 1000
  assert.equal(ctl.model().me.state, 'idle')
  assert.equal(ctl.model().today.prompts, 0)
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PermissionRequest', payload(tool('p', 'Bash', { command: 'rm x' })))
  ctl.pat()
  assert.equal(ctl.model().me.state, 'permission')
})

test('patting again and again escalates: a pat, a giggle, then overjoyed; a pause starts over', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.pat()
  assert.equal(ctl.model().me.state, 'petted')
  clock.at += 300; ctl.pat(); clock.at += 300; ctl.pat()
  assert.equal(ctl.model().me.state, 'giggle')
  clock.at += 300; ctl.pat(); clock.at += 300; ctl.pat()
  assert.equal(ctl.model().me.state, 'delighted')
  assert.equal(ctl.model().me.label, 'Overjoyed!')
  clock.at += 5000
  assert.equal(ctl.model().me.state, 'idle', 'the reaction ends by itself')
  ctl.pat()
  assert.equal(ctl.model().me.state, 'petted', 'after a pause the count starts again')
})

test('observing never throws into the host, even for malformed events', async () => {
  const ctl = createController(fakeHost().io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  for (const bad of [undefined, null, 5, 'x', {}, { tool_input: { get command() { throw new Error('boom') } }, tool_name: 'Bash' }]) {
    assert.doesNotThrow(() => ctl.observe('PreToolUse', bad))
    assert.doesNotThrow(() => ctl.observe('NotAnEvent', bad))
  }
  assert.doesNotThrow(() => ctl.model())
})

test('time-based state changes are scheduled: the controller says when to look again', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.nextTick(), undefined, 'nothing pending while idle')
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PostToolUse', payload({ ...tool('t', 'Bash', { command: 'npm test' }), tool_response: {} }))
  const wait = ctl.nextTick()
  assert.ok(wait > 0 && wait <= WINDOWS.success)
  clock.at += wait + 1
  assert.notEqual(ctl.model().me.state, 'success')
})

test('storage failures are reported, not thrown', async () => {
  const { io } = fakeHost()
  const ctl = createController({ ...io, write: async () => { throw new Error('disk full') } })
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  await assert.doesNotReject(ctl.flush())
  assert.equal(ctl.health.storage, 'error')
})

test('the model is plain JSON, small, and the same for the same inputs', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  const a = JSON.stringify(ctl.model())
  assert.equal(a, JSON.stringify(ctl.model()))
  assert.ok(a.length < 10000, 'small (' + a.length + '): the achievements and what can be earned are most of it')
})

test('the pet looks tired when the plan is nearly used up, and only while it has nothing else to do', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().tired, null, 'no usage figures: rested')
  ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 42 }, { kind: 'seven_day', percentUsed: 30 }] })
  assert.equal(ctl.model().me.state, 'idle', 'under the threshold: rested')
  ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 86.4, resetsAt: new Date(clock.at + 3_600_000).toISOString() }, { kind: 'seven_day', percentUsed: 30 }] })
  const m = ctl.model()
  assert.equal(m.me.state, 'tired')
  assert.equal(m.me.label, 'Tired · 86% of the 5-hour limit used')
  assert.equal(m.tired.window, '5-hour limit')
  assert.equal(m.tired.exhausted, false)
  // Work still shows as work.
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PreToolUse', payload(tool('a', 'Bash', { command: 'npm test' })))
  assert.equal(ctl.model().me.state, 'testing')
  // A window that has already reset no longer tires it; spending limits (credits) count too.
  ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 99, resetsAt: new Date(clock.at - 1000).toISOString() }, { kind: 'spend_limit', percentUsed: 97 }] })
  assert.equal(ctl.model().tired.window, 'spending limit')
  assert.equal(ctl.model().tired.exhausted, true)
  ctl.setUsage(null)
  assert.equal(ctl.model().tired, null)
})

test('the model reports how tasks went, as the agent said: successes and failures of tool calls', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.model().outcome, { ok: 0, failed: 0 })
  ctl.observe('UserPromptSubmit', payload())
  for (const [id, name, input] of [['1', 'Read', { file_path: '/w/a.js' }], ['2', 'Read', { file_path: '/w/b.js' }], ['3', 'Grep', { pattern: 'x' }]]) {
    ctl.observe('PreToolUse', payload(tool(id, name, input)))
    clock.at += 50
    ctl.observe('PostToolUse', payload({ ...tool(id, name, input), tool_response: {} }))
  }
  ctl.observe('PreToolUse', payload(tool('4', 'Bash', { command: 'node broken.js' })))
  ctl.observe('PostToolUseFailure', payload({ ...tool('4', 'Bash', { command: 'node broken.js' }), error: 'Exit code 1' }))
  assert.deepEqual(ctl.model().outcome, { ok: 3, failed: 1 })
})

test('the tests tile says how many runs could not be confirmed: a piped command hides its exit code', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PostToolUse', payload(tool('t1', 'Bash', { command: 'npm test | tail -5' }), { tool_response: {} }))
  ctl.observe('PostToolUse', payload(tool('t2', 'Bash', { command: 'npm test' }), { tool_response: {} }))
  const tests = ctl.model().stats.tiles.find(tile => tile.id === 'tests')
  assert.equal(tests.value, '2')
  assert.match(tests.note, /1 passed/)
  assert.match(tests.note, /1 unconfirmed/)
})

test('the compact band size is a preference: small, medium or large, large by default', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.bandSize, 'large')
  assert.equal(ctl.model().pet.bandHeight, 128)
  assert.match((await ctl.command('band medium')).text, /medium/)
  assert.equal(ctl.model().pet.bandSize, 'medium')
  assert.equal(ctl.model().pet.bandHeight, 96)
  await ctl.setPet({ prefs: { bandSize: 'huge' } })
  assert.equal(ctl.model().pet.bandSize, 'large', 'an unknown size falls back to the default')
  await ctl.command('band small')
  assert.ok(ctl.model().pet.bandHeight < 96 &&ctl.model().pet.band)
})

test('plan limits: both windows are always shown by default, or only when they matter on request; the model keeps every window either way', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.plan, 'always', 'by default both windows are shown')
  ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 12, resetsAt: new Date(clock.at + 3_600_000).toISOString() }, { kind: 'seven_day', percentUsed: 3 }] })
  assert.deepEqual(ctl.model().plan.map(w => [w.id, w.percent]), [['five_hour', 12], ['seven_day', 3]], 'the windows are always in the model: what is shown is decided when drawing')
  assert.match((await ctl.command('plan auto')).text, /half/i)
  assert.equal(ctl.model().pet.plan, 'auto')
  assert.match((await ctl.command('plan always')).text, /always/i)
  assert.equal(ctl.model().pet.plan, 'always')
  assert.match((await ctl.command('plan 5h')).text, /5-hour/)
  assert.equal(ctl.model().pet.plan, 'five_hour')
  assert.match((await ctl.command('plan week')).text, /weekly/)
  assert.equal(ctl.model().pet.plan, 'seven_day')
  assert.match((await ctl.command('plan off')).text, /hidden/)
  assert.equal(ctl.model().pet.plan, 'off')
  await ctl.command('plan auto')
  assert.match((await ctl.command('plan sometimes')).text, /plan <auto\|always\|five_hour\|seven_day\|off>/, 'an unknown word shows the syntax')
  assert.equal(ctl.model().pet.plan, 'auto')
  await ctl.setPet({ prefs: { plan: 'nonsense' } })
  assert.equal(ctl.model().pet.plan, 'always', 'an unknown value falls back to the default')
  await ctl.command('plan always')
  const other = createController(io)
  await other.init({ sid: 'b', cwd: '/w' })
  assert.equal(other.model().pet.plan, 'always', 'the choice is kept between sessions')
})

test('the session cost estimate: shown for this session only, and never when the host reports none', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  const costTile = () => ctl.model().stats.tiles.find(tile => tile.id === 'cost')
  const costRow = () => ctl.model().stats.rows.find(row => row.id === 'cost')
  ctl.setUi({ scope: 'session' })
  assert.equal(costTile(), undefined, 'nothing read yet: no tile')
  assert.equal(ctl.model().sessionCost, null, 'nothing read yet: nothing for the band either')
  ctl.setUsage({ rateLimits: [], cost: { usd: 1.234 } })
  assert.equal(ctl.model().sessionCost, '$1.23', 'the compact band shows it, without the approximation sign')
  assert.equal(costTile().value, '≈ $1.23')
  assert.equal(costTile().note, 'estimate')
  assert.equal(costRow().value, '≈ $1.23')
  assert.match(costRow().label, /estimate/)
  const ids = ctl.model().stats.rows.map(row => row.id)
  assert.equal(ids[ids.indexOf('time') + 1], 'cost', 'right after the agent time')

  ctl.setUsage({ rateLimits: [], cost: { usd: 1234.5 } })
  assert.equal(costTile().value, '≈ $1,234.50')
  ctl.setUsage({ rateLimits: [], cost: { usd: 0 } })
  assert.equal(costTile().value, '≈ $0.00')

  ctl.setUi({ scope: '7d' })
  assert.equal(costTile(), undefined, 'a cost is of this session: no tile for a period')
  assert.equal(ctl.model().sessionCost, '$0.00', 'the band is about this session whatever period the statistics show')
  ctl.setUi({ scope: 'session' })
  ctl.setUsage({ rateLimits: [] })
  assert.equal(costTile(), undefined, 'no figure from the host: nothing, not zero')
  assert.equal(costRow(), undefined)
  assert.equal(ctl.model().sessionCost, null)
  assert.equal(ctl.model().pet.cost, undefined, 'there is no option for it')
})

test('sounds: the pet plays what the user chose when the agent asks something and when a turn ends well', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.model().pet.sounds, { question: 'pop', finish: 'tada', reset5h: 'chime', resetWeek: 'chime' }, 'all are on by default')
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PermissionRequest', payload(tool('p', 'Bash', { command: 'rm x' })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'pop', volume: 'low' }])
  assert.deepEqual(ctl.takeCues(), [], 'each moment is reported once')
  ctl.observe('PermissionRequest', payload(tool('p', 'Bash', { command: 'rm x' })))
  assert.deepEqual(ctl.takeCues(), [], 'still the same question: no second sound')
  ctl.observe('PostToolUse', payload(tool('p', 'Bash', { command: 'rm x' }), { tool_response: {} }))
  ctl.observe('Stop', payload())
  clock.at += 50
  assert.deepEqual(ctl.takeCues(), [{ moment: 'finish', sound: 'tada', volume: 'low' }])
  // The choice: another sound, or none.
  assert.match((await ctl.command('sound question bell')).text, /bell/)
  assert.match((await ctl.command('sound finish off')).text, /off/)
  assert.match((await ctl.command('sound finish nonsense')).text, /Usage/)
  clock.at += 4000
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PermissionRequest', payload(tool('q', 'Bash', { command: 'ls' })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'bell', volume: 'low' }])
  clock.at += 4000
  ctl.observe('PreToolUse', payload(tool('a', 'AskUserQuestion', { questions: [] })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'bell', volume: 'low' }], 'a question to the user too')
  assert.match((await ctl.command('volume high')).text, /high/)
  clock.at += 4000
  ctl.observe('PermissionRequest', payload(tool('z', 'Bash', { command: 'ls' })))
  assert.equal(ctl.takeCues()[0].volume, 'high', 'the volume the user chose')
  assert.match((await ctl.command('volume deafening')).text, /Usage/)
  await ctl.setPet({ prefs: { volume: 'deafening' } })
  assert.equal(ctl.model().pet.volume, 'low', 'an unknown volume falls back to the default (low)')
  ctl.observe('PostToolUse', payload(tool('q', 'Bash', { command: 'ls' }), { tool_response: {} }))
  ctl.observe('Stop', payload())
  assert.deepEqual(ctl.takeCues(), [], 'a sound set to off is not played')
  await ctl.setPet({ prefs: { sounds: { question: 'nonsense' } } })
  assert.equal(ctl.model().pet.sounds.question, 'pop', 'an unknown sound falls back to the default')
})

test('milestones: reaching a round number celebrates once, and what was reached before is not announced', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.takeToasts().filter(text => !/sounds/i.test(text)), [], 'a new pet has nothing to celebrate (only the word about the sounds)')
  ctl.observe('UserPromptSubmit', payload())
  for (let i = 0; i < 100; i++) {
    ctl.observe('PostToolUse', payload(tool('t' + i, 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  }
  clock.at += 6000
  ctl.observe('PostToolUse', payload(tool('last', 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  const toasts = ctl.takeToasts()
  assert.equal(toasts.length, 2, 'the milestone, and what it unlocked')
  assert.match(toasts[0], /100 tasks done together/)
  assert.match(toasts[1], /Unlocked: Flower/)
  assert.equal(ctl.model().me.state, 'delighted', 'the pet celebrates')
  assert.deepEqual(ctl.pet.milestones.includes('tools-100'), true, 'and remembers it')
  clock.at += 6000
  ctl.observe('PostToolUse', payload(tool('more', 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  assert.deepEqual(ctl.takeToasts(), [], 'only once')
  // A second controller on the same data (a restart) does not repeat it.
  const again = createController(io)
  await again.init({ sid: 'b', cwd: '/w' })
  assert.deepEqual(again.takeToasts(), [])
})

/** Gives the pet a hundred tool calls, which is the milestone that unlocks the flower. */
function reachHundredTasks(ctl, clock) {
  ctl.observe('UserPromptSubmit', payload())
  for (let i = 0; i < 100; i++) ctl.observe('PostToolUse', payload(tool('t' + i, 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  clock.at += 6000
  ctl.observe('PostToolUse', payload(tool('last', 'Read', { file_path: '/w/a' }), { tool_response: {} }))
}

test('accessories: earned with a milestone, worn only once earned, chosen with the button or /codepuff accessory', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.takeToasts()
  const flower = () => ctl.model().accessories.find(item => item.id === 'flower')
  assert.equal(flower().unlocked, false)
  assert.match((await ctl.command('accessory flower')).text, /still locked: 100 tasks/)
  assert.equal(ctl.model().pet.worn, null)
  // Saved before it was earned (an edited file), it is still not worn.
  await ctl.setPet({ prefs: { accessory: 'flower' } })
  assert.equal(ctl.model().pet.worn, null, 'a locked accessory is not worn')
  await ctl.setPet({ prefs: { accessory: 'none' } })

  reachHundredTasks(ctl, clock)
  assert.equal(flower().unlocked, true)
  assert.match((await ctl.command('accessory flower')).text, /Now wearing: Flower/)
  assert.equal(ctl.model().pet.worn, 'flower')
  assert.match((await ctl.command('accessory crown')).text, /still locked/)
  assert.match((await ctl.command('accessory nope')).text, /Available now: flower/)
  assert.match((await ctl.command('accessory none')).text, /Not wearing anything/)
  assert.equal(ctl.model().pet.worn, null)
  await ctl.setPet({ prefs: { accessory: 'party' } })
  assert.equal(ctl.model().pet.accessory, 'party', 'the choice is kept')
  assert.equal(ctl.model().pet.worn, null, 'but nothing is worn until the milestone for it is reached')
})

test('palettes and band frames are rewards too: locked until earned, chosen with the buttons or /codepuff palette and frame', async () => {
  const { io, clock, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  const model = () => ctl.model()
  assert.deepEqual([model().palettes.sunset, model().palettes.aurora, 'mint' in model().palettes], [false, false, false], 'the ones to earn are listed as locked; the free ones are not in the list')
  assert.match((await ctl.command('palette sunset')).text, /Sunset is still locked: 500 tasks done together!/)
  assert.equal(model().pet.colors.body, null, 'nothing changed')
  assert.match((await ctl.command('palette mint')).text, /Mint/)
  assert.ok(!(await ctl.command('palettes')).text.includes('sunset'), 'the list offers only what can be used')
  assert.match((await ctl.command('frame rainbow')).text, /Rainbow is still locked: 5,000 tasks done together!/)
  assert.match((await ctl.command('frame nope')).text, /Available now: -\./)
  assert.equal(model().pet.frame, null)
  // Earn silver for tasks: the Sunset palette opens (and a message says so), and the card frame comes with the diamond.
  const mark = JSON.parse(files.get('/data/.codepuff/pet.json'))
  files.set('/data/.codepuff/pet.json', JSON.stringify({ ...mark, milestones: ['tools-100', 'tools-500', 'tools-5000'], seen: [...mark.seen, 'milestones-2'] }))
  await ctl.syncPet()
  assert.equal(model().palettes.sunset, true)
  assert.match((await ctl.command('palette sunset')).text, /Sunset/)
  assert.equal(model().pet.colors.body, '#ff9a6b')
  assert.match((await ctl.command('frame rainbow')).text, /Band frame: Rainbow/)
  assert.equal(model().pet.frame, 'rainbow')
  assert.match((await ctl.command('frame none')).text, /No band frame/)
  assert.equal(model().pet.frame, null)
  await ctl.setPet({ prefs: { frame: 'gold' } })
  assert.equal(model().pet.frame, null, 'a frame that is not earned is not used')
  await ctl.setPet({ prefs: { frame: 'rainbow' } })
  await ctl.command('card')
  assert.ok(files.get('/data/.codepuff/cards/codepuff-classic.svg').includes('url(#rainbow)'), 'the card wears the frame')
  clock.at += 1
})

test('achievements: every milestone with whether it was reached, and what it unlocks', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().achievements.done, 0)
  assert.equal(ctl.model().achievements.total, 33)
  reachHundredTasks(ctl, clock)
  const { done, groups } = ctl.model().achievements
  assert.equal(done, 1)
  // One card for each thing that is counted, and it levels up: bronze after 100 tasks, then silver at 500, gold at 1000, diamond at 5000.
  assert.deepEqual(groups.map(g => g.kind), ['tools', 'streak', 'prompts', 'tests', 'commits', 'files', 'lines', 'days', 'time', 'helpers', 'projects'])
  const tools = groups.find(g => g.kind === 'tools')
  assert.deepEqual([tools.title, tools.tier, tools.tierName, tools.complete], ['Tasks together', 0, 'Bronze', false])
  assert.deepEqual(tools.levels.map(level => [level.n, level.tier, level.reached]), [[100, 0, true], [500, 1, false], [1000, 2, false], [5000, 3, false]])
  assert.deepEqual([tools.current, tools.target, tools.nextName, tools.reward], [101, 500, 'Silver', 'Sunset'], 'the count so far, toward the next level (and what it unlocks: a palette)')
  const streak = groups.find(g => g.kind === 'streak')
  assert.deepEqual([streak.tier, streak.tierName, streak.current, streak.target, streak.nextName, streak.reward], [null, null, 1, 3, 'Bronze', 'Bow'], 'nothing yet: the next level is bronze, and it unlocks the bow')
  assert.equal(groups.find(g => g.kind === 'tests').current, 0)
  assert.ok(JSON.stringify(ctl.model().achievements).length < 4500, 'small')
  // The other things that are counted: files changed, lines in commits, active days, hours of work, helpers called, projects.
  const files = groups.find(g => g.kind === 'files')
  assert.deepEqual([files.title, files.tier, files.target], ['Files changed', null, 10])
  assert.deepEqual(groups.find(g => g.kind === 'lines').levels.map(level => level.n), [1000, 10000, 100000])
  assert.deepEqual(groups.find(g => g.kind === 'time').levels.map(level => level.tier), [0, 1, 2])
  assert.equal(groups.find(g => g.kind === 'days').levels.length, 4)
  ctl.setUi({ tab: 'achievements' })
  assert.equal(ctl.model().ui.tab, 'achievements', 'a tab of its own')
  ctl.setUi({ tab: 'settings' })
  assert.equal(ctl.model().ui.tab, 'settings', 'and so are the settings')
  ctl.setUi({ tab: 'nope' })
  assert.equal(ctl.model().ui.tab, 'stats')
  const text = (await ctl.command('achievements')).text
  assert.match(text, /Achievements · 1 of 33 reached/)
  assert.match(text, /✔ 100 tasks done together!/)
  assert.match(text, /· 500 tasks done together!/)
})

test('the break reminder: off by default; set to any number of minutes, a long stretch of work gets a message and a stretch, and a pause of the chosen length starts the count again', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.takeToasts()
  const work = () => ctl.observe('PostToolUse', payload(tool('w' + clock.at, 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  const MIN = 60_000
  work()
  for (let i = 0; i < 12; i++) { clock.at += 5 * MIN; work() }
  assert.equal(ctl.checkBreak(), false, 'off by default')
  assert.match((await ctl.command('breaks 1h')).text, /after 1h of work/)
  assert.equal(ctl.model().pet.breakEvery, 60)
  // Any length from 15 minutes to 8 hours, in the ways people write it.
  for (const [text, minutes] of [['45m', 45], ['45', 45], ['90 min', 90], ['1h30', 90], ['1h 30m', 90], ['1.5h', 90], ['2h', 120], ['15', 15], ['8h', 480]]) {
    await ctl.command('breaks ' + text)
    assert.equal(ctl.model().pet.breakEvery, minutes, text)
  }
  for (const bad of ['soon', '10', '9h', '0', '1h99x']) {
    const before = ctl.model().pet.breakEvery
    assert.match((await ctl.command('breaks ' + bad)).text, /breaks <off\|45m\|1h\|1h30\|90>/, bad)
    assert.equal(ctl.model().pet.breakEvery, before, bad + ' changes nothing')
  }
  await ctl.command('breaks 1h')
  assert.equal(ctl.checkBreak(), true, 'an hour of work with no pause')
  assert.match(ctl.takeToasts().at(-1), /without a break/)
  assert.equal(ctl.model().me.state, 'stretch')
  assert.equal(ctl.checkBreak(), false, 'it does not nag')
  // A pause of ten minutes (the default rest) or more ends the stretch: the count starts over.
  assert.equal(ctl.model().pet.breakRest, 10)
  clock.at += 30 * MIN
  work()
  for (let i = 0; i < 6; i++) { clock.at += 5 * MIN; work() }
  assert.equal(ctl.checkBreak(), false, 'half an hour into the new stretch')
  for (let i = 0; i < 6; i++) { clock.at += 5 * MIN; work() }
  assert.equal(ctl.checkBreak(), true, 'and an hour into it')
  // The rest that ends a stretch can be longer: with 30 minutes, a pause of 20 is not a break and the count goes on.
  assert.match((await ctl.command('breakrest 30')).text, /30 min or more counts as a break/)
  assert.equal(ctl.model().pet.breakRest, 30)
  assert.match((await ctl.command('breakrest 3')).text, /breakrest <5 to 60 minutes>/)
  assert.match((await ctl.command('breakrest 90')).text, /breakrest <5 to 60 minutes>/)
  clock.at += 20 * MIN
  work()
  for (let i = 0; i < 8; i++) { clock.at += 5 * MIN; work() }
  assert.equal(ctl.checkBreak(), true, 'a pause of 20 minutes did not end the stretch, so the hour was over')
  assert.match((await ctl.command('breaks off')).text, /is off/)
  assert.equal(ctl.model().pet.breakEvery, 0)
  for (let i = 0; i < 14; i++) { clock.at += 5 * MIN; work() }
  assert.equal(ctl.checkBreak(), false)
})

test('the status line says what the pet is doing, then what is worth a glance: the context, the plan limits, the cost', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().statusLine, 'Classic · Resting', 'nothing reported yet: just the pet')
  ctl.setUsage({
    rateLimits: [{ kind: 'five_hour', percentUsed: 24, resetsAt: new Date(clock.at + 3_600_000).toISOString() }, { kind: 'seven_day', percentUsed: 31, resetsAt: new Date(clock.at + 86_400_000).toISOString() }],
    context: { window: 200000, tokens: 124000, percent: 62 }, cost: { usd: 0.314 },
  })
  assert.equal(ctl.model().statusLine, 'Classic · Resting · ctx 62% · 5h 24% · week 31% · $0.31')
  ctl.setUsage({ rateLimits: [], context: { window: 200000 } })
  assert.equal(ctl.model().statusLine, 'Classic · Resting', 'what the host does not report is left out')
})

test('the band frame is the chosen frame as soon as it is earned, and "none" turns it off', async () => {
  const { io, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  await ctl.syncPet() // (waits for the saves under way, so the file edited below is not written over)
  assert.equal(ctl.model().pet.bandFrame, null, 'by default there is none')
  assert.match((await ctl.command('frame gold')).text, /Gold is still locked: 365 active days!/)
  const path = '/data/.codepuff/pet.json'
  const saved = JSON.parse(files.get(path))
  files.set(path, JSON.stringify({ ...saved, milestones: ['days-365', 'tools-5000'], seen: [...saved.seen, 'milestones-2'] }))
  await ctl.syncPet()
  assert.match((await ctl.command('frame gold')).text, /Band frame: Gold/)
  assert.equal(ctl.model().pet.bandFrame, 'gold', 'it frames the band at once: there is no other switch')
  assert.match((await ctl.command('frame none')).text, /No band frame/)
  assert.equal(ctl.model().pet.bandFrame, null)
  assert.match((await ctl.command('frameband on')).text, /codepuff|\//i, 'the old switch is gone: an unknown word shows the help')
})

test('a pet saved by an earlier version keeps its break reminder, and a new one starts with the plan limits always shown', async () => {
  const { io, files } = fakeHost()
  const first = createController(io)
  await first.init({ sid: 'a', cwd: '/w' })
  await first.syncPet()
  assert.deepEqual([first.pet.prefs.plan, first.pet.prefs.breakEvery, first.pet.prefs.breakRest], ['always', 0, 10])
  const path = '/data/.codepuff/pet.json'
  const saved = JSON.parse(files.get(path))
  const old = { ...saved, prefs: { ...saved.prefs, breaks: '2h' } }
  delete old.prefs.breakEvery
  delete old.prefs.breakRest
  files.set(path, JSON.stringify(old))
  const later = createController(io)
  await later.init({ sid: 'b', cwd: '/w' })
  assert.equal(later.pet.prefs.breakEvery, 120, 'the old "2h" is two hours')
  assert.equal(later.pet.prefs.breakRest, 10)
  files.set(path, JSON.stringify({ ...saved, prefs: { ...saved.prefs, breakEvery: 7, breakRest: 999 } }))
  const odd = createController(io)
  await odd.init({ sid: 'c', cwd: '/w' })
  assert.deepEqual([odd.pet.prefs.breakEvery, odd.pet.prefs.breakRest], [0, 60], 'too short is off; a rest is kept between 5 and 60 minutes')
})

test('a greeting that fits the time of day, when the host asks for one', async () => {
  const { io, clock } = fakeHost()
  const quiet = createController(io)
  await quiet.init({ sid: 'a', cwd: '/w' })
  assert.equal(quiet.model().me.state, 'idle', 'a controller that was not asked to greet does not')
  const ctl = createController(io, { greet: true })
  await ctl.init({ sid: 'b', cwd: '/w' })
  const expected = greetingAt(new Date(clock.at).getHours())
  assert.ok(['morning', 'afternoon', 'evening', 'night'].includes(expected))
  assert.equal(ctl.model().me.state, expected)
  assert.match(ctl.model().me.label, /!|\?/, 'it says something')
  ctl.observe('UserPromptSubmit', payload())
  assert.equal(ctl.model().me.state, 'thinking', 'a greeting gives way to the work')
  clock.at += REACTION_LENGTH[expected] + 100
  ctl.observe('Stop', payload())
  clock.at += 60_000 * 3
  assert.equal(ctl.model().me.state, 'idle', 'and then it is done')
  assert.deepEqual([4, 5, 11, 12, 16, 17, 21, 22, 23, 0].map(greetingAt), ['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night', 'night'])
})

test('the pet card is a self-contained SVG with the pet and a few numbers, and nothing private', async () => {
  const { io, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/secret/project-name' })
  await ctl.setPet({ name: 'Mochi <b>' })
  const reply = (await ctl.command('card')).text
  assert.match(reply, /Pet card saved: .*cards\/codepuff-mochi-b\.svg/)
  const svg = files.get('/data/.codepuff/cards/codepuff-mochi-b.svg')
  assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'))
  assert.ok(svg.includes('Mochi b') && !svg.includes('<b>'), 'the name has no markup in it')
  assert.ok(cardSvg({ name: 'A<b>&"x', character: 'fox', hearts: 5, streak: 1, ageDays: 1, prompts: 1, tools: 1, done: 0, total: 13 }).includes('A&lt;b&gt;&amp;&quot;x'), 'and whatever a name holds is escaped anyway')
  assert.match(svg, /together for/)
  assert.match(svg, /achievements/)
  assert.ok(!svg.includes('secret') && !svg.includes('project-name'), 'no project name or path')
})

test('when the list of milestones grows, what a pet had already reached is recorded quietly, not announced', async () => {
  const { io, clock, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  reachHundredTasks(ctl, clock)
  ctl.takeToasts()
  await ctl.flush()
  // A pet saved by an earlier version: it knows no milestone (an empty list) and has not seen this version of the list.
  const path = '/data/.codepuff/pet.json'
  const saved = JSON.parse(files.get(path))
  files.set(path, JSON.stringify({ ...saved, milestones: [], seen: saved.seen.filter(id => id !== 'milestones-2') }))
  const later = createController(io)
  await later.init({ sid: 'b', cwd: '/w' })
  assert.deepEqual(later.takeToasts().filter(text => !/sounds/i.test(text)), [], 'no pile of old news')
  assert.ok(later.pet.milestones.includes('tools-100'), 'but it is recorded')
  assert.ok(later.pet.seen.includes('milestones-2'))
  assert.equal(later.model().achievements.groups.find(g => g.kind === 'tools').tier, 0, 'and the badge is earned')
})

test('affection: unkind messages lower the hearts and hurt, thanks raise them, time heals, and it persists', async () => {
  const { io, clock, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.hearts, 5, 'it starts fond of you')
  // Swearing at a bug is not aimed at the assistant.
  ctl.observe('UserPromptSubmit', payload({ prompt: 'this stupid bug, fuck this, fix the login' }))
  assert.equal(ctl.model().pet.hearts, 5)
  // Harsh criticism of the work stings for a moment, but costs no hearts.
  ctl.observe('UserPromptSubmit', payload({ prompt: 'your code is garbage' }))
  assert.equal(ctl.model().me.state, 'hurt')
  assert.equal(ctl.model().pet.hearts, 5)
  ctl.observe('UserPromptSubmit', payload({ prompt: 'você é um idiota' }))
  assert.equal(ctl.model().me.state, 'hurt')
  assert.equal(ctl.model().me.label, 'That hurt…')
  assert.equal(ctl.model().pet.hearts, 5 - 0, 'one insult is 15 points: 85 is still five hearts')
  for (const rude of ['cala a boca', 'you are stupid', 'vai se foder', 'burro']) ctl.observe('UserPromptSubmit', payload({ prompt: rude }))
  assert.ok(ctl.model().pet.hearts <= 2, 'after several insults the hearts are few (' + ctl.model().pet.hearts + ')')
  ctl.observe('Stop', payload())
  clock.at += 3000
  assert.equal(ctl.model().me.state, 'sad', 'and the pet is sad when it has nothing else to do')
  assert.equal(ctl.model().me.label, 'Feeling down')
  // It still works while sad.
  ctl.observe('PreToolUse', payload(tool('t', 'Read', { file_path: '/w/a' })))
  assert.equal(ctl.model().me.state, 'reading')
  // The text is never kept.
  await ctl.flush()
  assert.ok(files && ![...files.values()].some(t => /idiota|burro|vai se foder|useless/.test(String(t))), 'the prompt text is not stored anywhere')
  // It persists: a new controller (another session) starts with the same hearts.
  await ctl.flush()
  const hearts = ctl.model().pet.hearts
  const next = createController(io)
  await next.init({ sid: 'b', cwd: '/w' })
  assert.equal(next.model().pet.hearts, hearts, 'the hearts survive a new session')
  // Thanks help; so does a night's sleep.
  next.observe('UserPromptSubmit', payload({ prompt: 'thanks, great job' }))
  assert.equal(next.model().me.state, 'petted')
  await new Promise(resolve => setImmediate(resolve)) // the save of the thanks finishes
  clock.at += 5 * 86_400_000
  const later = createController(io)
  await later.init({ sid: 'c', cwd: '/w' })
  assert.ok(later.model().pet.hearts > hearts, 'days without unkindness heal it')
})

test('mood switch and a change made by another process: off means no judging, and the newer affection wins', async () => {
  const { io, files, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  await ctl.command('mood off')
  assert.equal(ctl.model().pet.mood, false)
  ctl.observe('UserPromptSubmit', payload({ prompt: 'você é um idiota' }))
  assert.equal(ctl.model().pet.hearts, 5, 'nothing is judged while it is off')
  assert.notEqual(ctl.model().me.state, 'hurt')
  await ctl.command('mood on')
  // The Codex hook (another process) lowers the affection in the file; the mod adopts it.
  const file = [...files.keys()].find(name => name.endsWith('pet.json'))
  const saved = JSON.parse(files.get(file))
  saved.affection = { score: 20, day: saved.affection.day, at: clock.at + 1000 }
  files.set(file, JSON.stringify(saved))
  clock.at += 2000
  await ctl.refreshOthers()
  assert.equal(ctl.model().pet.hearts, 1, 'the hearts the other process left')
})

test('a first-run notice about the sounds is shown once', async () => {
  const { io } = fakeHost()
  const first = createController(io)
  await first.init({ sid: 'a', cwd: '/w' })
  assert.match(first.takeToasts().join(' '), /sounds/i)
  await first.flush()
  const second = createController(io)
  await second.init({ sid: 'b', cwd: '/w' })
  assert.deepEqual(second.takeToasts().filter(t => /sounds/i.test(t)), [], 'not shown again')
})

test('plan resets: a sound and a word when the 5-hour or the weekly limit resets, and only then', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.takeCues(); ctl.takeToasts()
  const iso = ms => new Date(ms).toISOString()
  const usage = (five, fiveEnds, week, weekEnds) => ({ rateLimits: [{ kind: 'five_hour', percentUsed: five, resetsAt: iso(fiveEnds) }, { kind: 'seven_day', percentUsed: week, resetsAt: iso(weekEnds) }], cost: null })
  const HOUR = 3_600_000
  ctl.setUsage(usage(60, clock.at + HOUR, 40, clock.at + 72 * HOUR))
  assert.deepEqual(ctl.takeCues(), [], 'the first reading announces nothing')
  clock.at += 0.5 * HOUR
  ctl.setUsage(usage(70, clock.at + 0.5 * HOUR, 41, clock.at + 71.5 * HOUR))
  assert.deepEqual(ctl.takeCues(), [], 'using more of a window is not a reset')
  clock.at += 1 * HOUR
  ctl.setUsage(usage(2, clock.at + 5 * HOUR, 41, clock.at + 70.5 * HOUR))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'reset5h', sound: 'chime', volume: 'low' }])
  assert.match(ctl.takeToasts().join(' '), /5-hour limit has reset/)
  clock.at += 71 * HOUR
  ctl.setUsage(usage(10, clock.at + 3 * HOUR, 1, clock.at + 168 * HOUR))
  const cues = ctl.takeCues().map(c => c.moment).sort()
  assert.ok(cues.includes('resetWeek'), 'the weekly reset is heard: ' + cues)
  await ctl.command('sound resetWeek off')
  clock.at += 169 * HOUR
  ctl.setUsage(usage(1, clock.at + 5 * HOUR, 0.5, clock.at + 168 * HOUR))
  ctl.setUsage(usage(0, clock.at + 5 * HOUR, 0, clock.at + 168 * HOUR))
  assert.ok(!ctl.takeCues().some(c => c.moment === 'resetWeek'), 'a sound set to off is not played')
})

test('hosted by Codex the order flips: Codex first, then Claude Code, then Combined, and this session belongs to Codex', async () => {
  const { io } = fakeHost()
  const ctl = createController(io, { host: 'codex' })
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.model().platforms, ['codex', 'claude', 'all'])
  assert.equal(ctl.model().ui.agent, 'codex')
  assert.deepEqual(ctl.model().periods, ['session', '7d', '30d', 'all'])
  ctl.setUi({ agent: 'claude' })
  assert.deepEqual(ctl.model().periods, ['7d', '30d', 'all'])
})

test('the statistics come as a few tiles, tool bars and a chart, with the long list kept apart', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PostToolUse', payload(tool('t1', 'Read', { file_path: '/w/a' }), { tool_response: {} }))
  ctl.observe('PostToolUse', payload(tool('t2', 'Edit', { file_path: '/w/a' }), { tool_response: {} }))
  const m = ctl.model()
  assert.deepEqual(m.stats.tiles.map(t => t.id), ['prompts', 'tools', 'files', 'commits', 'tests', 'time', 'subagents'])
  assert.equal(m.stats.tiles.find(t => t.id === 'tools').value, '2')
  assert.match(m.stats.tiles.find(t => t.id === 'tools').note, /100% succeeded/)
  assert.deepEqual(m.stats.bars.map(b => b.label).sort(), ['Edit', 'Read'])
  assert.ok(m.stats.bars.every(b => b.share > 0 && b.share <= 1))
  assert.equal(m.chart.length, 14)
  assert.equal(m.chart.at(-1).tools, 2, 'today is the last bar')
  assert.equal(m.ui.details, false, 'the long list is hidden until asked for')
  ctl.setUi({ details: true })
  assert.equal(ctl.model().ui.details, true)
})

test('the plan windows reach the model for the bars: used share and time to reset, and a window that already reset is left out', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.model().plan, [], 'no usage figures: no bars')
  const iso = ms => new Date(ms).toISOString()
  ctl.setUsage({ rateLimits: [
    { kind: 'five_hour', percentUsed: 93.4, resetsAt: iso(clock.at + 72 * 60_000) },
    { kind: 'seven_day', percentUsed: 41, resetsAt: iso(clock.at + 3 * 86_400_000) },
    { kind: 'seven_day_opus', percentUsed: 5, resetsAt: iso(clock.at + 86_400_000) },
    { kind: 'spend_limit', percentUsed: 12, resetsAt: iso(clock.at - 1000) },
  ], cost: null })
  const plan = ctl.model().plan
  assert.deepEqual(plan.map(w => [w.label, w.percent]), [['5h', 93], ['week', 41]], 'known windows only, and not the one that reset')
  assert.equal(plan[0].resetsInMs, 72 * 60_000)
})

test('hearts from another process are not overwritten by a stale copy: the latest score is read before a prompt is judged', async () => {
  const { io, files, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  await new Promise(resolve => setImmediate(resolve)) // the saves started by init finish
  clock.at += 60_000
  // The Codex hook lowers the hearts to 50 in the file; this controller has not looked since it started.
  const file = [...files.keys()].find(name => name.endsWith('pet.json'))
  const saved = JSON.parse(files.get(file))
  saved.affection = { score: 50, day: saved.affection.day, at: clock.at }
  files.set(file, JSON.stringify(saved))
  clock.at += 1000
  await ctl.syncPet()
  ctl.observe('UserPromptSubmit', payload({ prompt: 'você é um idiota' }))
  await new Promise(resolve => setImmediate(resolve))
  const after = JSON.parse(files.get(file)).affection.score
  assert.equal(after, 35, 'the insult is taken from the 50 in the file, not from a stale 100')
})

test('two windows share one pet: a setting saved in one is not undone by a stale save from the other', async () => {
  const { io, files } = fakeHost()
  const a = createController(io)
  const b = createController(io)
  await a.init({ sid: 'one', cwd: '/w' })
  await b.init({ sid: 'two', cwd: '/w' })
  await a.setPet({ prefs: { bandSize: 'large' } })
  // Window B has not looked since; it looks when a prompt arrives (or on a refresh), then saves its own change.
  await b.syncPet()
  assert.equal(b.model().pet.bandSize, 'large', 'B sees what A saved')
  await b.setPet({ prefs: { mood: false } })
  const saved = JSON.parse(files.get([...files.keys()].find(name => name.endsWith('pet.json'))))
  assert.equal(saved.prefs.bandSize, 'large', "A's setting survived B's save")
  assert.equal(saved.prefs.mood, false)
  // What was shown once stays shown, whoever showed it.
  await a.refreshOthers()
  assert.equal(a.model().pet.mood, false, 'A picks up B on its refresh')
  assert.equal(a.pet.seen.includes('sounds'), true)
})

test('the motion command takes full, calm or reduced (and the old names auto and off)', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.motion, 'calm')
  assert.match((await ctl.command('motion full')).text, /full/)
  assert.equal(ctl.model().pet.motion, 'full')
  await ctl.command('motion off')
  assert.equal(ctl.model().pet.motion, 'reduced')
  await ctl.command('motion auto')
  assert.equal(ctl.model().pet.motion, 'calm')
  assert.match((await ctl.command('motion wild')).text, /full, calm or reduced/)
})

test('the statistics say which days they cover, the tests tile tells runs from confirmed results, and day names are short', async () => {
  const { shortDay, statTiles } = await import('../src/core/format.js')
  const { emptyStats } = await import('../src/core/aggregate.js')
  assert.equal(shortDay('2026-11-24'), 'Nov 24')
  assert.equal(shortDay('2026-01-05'), 'Jan 5')
  assert.equal(shortDay('nonsense'), '')
  const s = emptyStats(); s.tests = { run: 145, passed: 0, failed: 0, unknown: 145 }
  const tile = statTiles(s).find(t => t.id === 'tests')
  assert.equal(tile.value, '145')
  assert.equal(tile.note, '0 passed · 145 unconfirmed', 'not "0 passed of 145": nothing failed, it just could not be confirmed')
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().rangeLabel, 'nothing yet', 'a session with nothing in it')
  ctl.observe('UserPromptSubmit', payload())
  assert.match(ctl.model().rangeLabel, /started /, 'this session: when it started')
  ctl.setUi({ scope: '7d' })
  assert.match(ctl.model().rangeLabel, /^[A-Z][a-z]{2} [0-9]+ – [A-Z][a-z]{2} [0-9]+$/, 'a week: from day to day')
  ctl.setUi({ scope: 'all' })
  assert.match(ctl.model().rangeLabel, /^since [A-Z][a-z]{2} [0-9]+$/, 'all time: since the first day with numbers')
})
