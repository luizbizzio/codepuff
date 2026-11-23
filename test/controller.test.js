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
    ctl.setUi({ scope: 'session' })
    assert.equal(ctl.model().stats.rows.find(r => r.id === 'prompts').value, '1', 'this session is only this chat')
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
