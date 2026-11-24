import test from 'node:test'
import assert from 'node:assert/strict'
import { createController } from '../src/claude/controller.js'
import { openStore } from '../src/node/store.js'
import { normalizeHook } from '../src/core/normalize.js'
import { WINDOWS } from '../src/core/petstate.js'
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
  assert.deepEqual({ n: ctl.pet.name, c: ctl.pet.character, b: ctl.pet.colors.body }, { n: '', c: 'alpha', b: null })
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
  assert.ok(a.length < 6000)
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

test('the compact band size is a preference: small, medium or large, medium by default', async () => {
  const { io } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.bandSize, 'medium')
  assert.equal(ctl.model().pet.bandHeight, 96)
  assert.match((await ctl.command('band large')).text, /large/)
  assert.equal(ctl.model().pet.bandSize, 'large')
  assert.ok(ctl.model().pet.bandHeight > 96)
  await ctl.setPet({ prefs: { bandSize: 'huge' } })
  assert.equal(ctl.model().pet.bandSize, 'medium', 'an unknown size falls back')
  await ctl.command('band small')
  assert.ok(ctl.model().pet.bandHeight < 96 && ctl.model().pet.band)
})

test('sounds: the pet plays what the user chose when the agent asks something and when a turn ends well', async () => {
  const { io, clock } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.deepEqual(ctl.model().pet.sounds, { question: 'chime', finish: 'tada', reset5h: 'ding', resetWeek: 'bell' }, 'all are on by default')
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PermissionRequest', payload(tool('p', 'Bash', { command: 'rm x' })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'chime', volume: 'medium' }])
  assert.deepEqual(ctl.takeCues(), [], 'each moment is reported once')
  ctl.observe('PermissionRequest', payload(tool('p', 'Bash', { command: 'rm x' })))
  assert.deepEqual(ctl.takeCues(), [], 'still the same question: no second sound')
  ctl.observe('PostToolUse', payload(tool('p', 'Bash', { command: 'rm x' }), { tool_response: {} }))
  ctl.observe('Stop', payload())
  clock.at += 50
  assert.deepEqual(ctl.takeCues(), [{ moment: 'finish', sound: 'tada', volume: 'medium' }])
  // The choice: another sound, or none.
  assert.match((await ctl.command('sound question bell')).text, /bell/)
  assert.match((await ctl.command('sound finish off')).text, /off/)
  assert.match((await ctl.command('sound finish nonsense')).text, /Usage/)
  clock.at += 4000
  ctl.observe('UserPromptSubmit', payload())
  ctl.observe('PermissionRequest', payload(tool('q', 'Bash', { command: 'ls' })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'bell', volume: 'medium' }])
  clock.at += 4000
  ctl.observe('PreToolUse', payload(tool('a', 'AskUserQuestion', { questions: [] })))
  assert.deepEqual(ctl.takeCues(), [{ moment: 'question', sound: 'bell', volume: 'medium' }], 'a question to the user too')
  assert.match((await ctl.command('volume low')).text, /low/)
  clock.at += 4000
  ctl.observe('PermissionRequest', payload(tool('z', 'Bash', { command: 'ls' })))
  assert.equal(ctl.takeCues()[0].volume, 'low', 'the volume the user chose')
  assert.match((await ctl.command('volume deafening')).text, /Usage/)
  await ctl.setPet({ prefs: { volume: 'deafening' } })
  assert.equal(ctl.model().pet.volume, 'medium', 'an unknown volume falls back')
  ctl.observe('PostToolUse', payload(tool('q', 'Bash', { command: 'ls' }), { tool_response: {} }))
  ctl.observe('Stop', payload())
  assert.deepEqual(ctl.takeCues(), [], 'a sound set to off is not played')
  await ctl.setPet({ prefs: { sounds: { question: 'nonsense' } } })
  assert.equal(ctl.model().pet.sounds.question, 'chime', 'an unknown sound falls back to the default')
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
  assert.equal(toasts.length, 1)
  assert.match(toasts[0], /100 tasks done together/)
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

test('affection: unkind messages lower the hearts and hurt, thanks raise them, time heals, and it persists', async () => {
  const { io, clock, files } = fakeHost()
  const ctl = createController(io)
  await ctl.init({ sid: 'a', cwd: '/w' })
  assert.equal(ctl.model().pet.hearts, 5, 'it starts fond of you')
  // Swearing at a bug is not aimed at the assistant.
  ctl.observe('UserPromptSubmit', payload({ prompt: 'this stupid bug, fuck this, fix the login' }))
  assert.equal(ctl.model().pet.hearts, 5)
  ctl.observe('UserPromptSubmit', payload({ prompt: 'você é um idiota' }))
  assert.equal(ctl.model().me.state, 'hurt')
  assert.equal(ctl.model().me.label, 'That hurt…')
  assert.equal(ctl.model().pet.hearts, 5 - 0, 'one insult is 15 points: 85 is still five hearts')
  for (const rude of ['cala a boca', 'you are useless', 'vai se foder', 'burro']) ctl.observe('UserPromptSubmit', payload({ prompt: rude }))
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
  assert.deepEqual(ctl.takeCues(), [{ moment: 'reset5h', sound: 'ding', volume: 'medium' }])
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
  assert.deepEqual(m.stats.tiles.map(t => t.id), ['prompts', 'tools', 'files', 'commits', 'tests', 'time'])
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
