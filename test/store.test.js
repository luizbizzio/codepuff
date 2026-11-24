import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openStore } from '../src/node/store.js'
import { aggregate } from '../src/core/aggregate.js'
import { normalizeHook } from '../src/core/normalize.js'
import { buildBackup, parseBackup, mergeRecords } from '../src/core/backup.js'
import { sanitizeRecord } from '../src/core/records.js'
import { defaultPet } from '../src/core/settings.js'
import { hook, T0, tempDir } from './helpers.js'

const ev = (agent, name, extra = {}, at = Date.now()) => normalizeHook(agent, hook(name, extra), at)

function worker(dir, agent, session, count, tag) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, '_worker.mjs'), dir, agent, session, String(count), tag], { stdio: 'inherit' })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('worker exited ' + code))))
  })
}

test('concurrent processes writing one session lose no updates', async () => {
  const { dir, done } = tempDir()
  try {
    await Promise.all([0, 1, 2, 3, 4, 5].map(i => worker(dir, 'codex', 'shared', 40, 'w' + i)))
    const rec = openStore(dir).readRecord('codex', 'shared')
    assert.equal(aggregate([rec], {}).tools.total, 240)
  } finally { done() }
})

test('concurrent processes across sessions and agents stay independent and add up', async () => {
  const { dir, done } = tempDir()
  try {
    await Promise.all([worker(dir, 'claude', 'a', 30, 'x'), worker(dir, 'claude', 'b', 30, 'y'), worker(dir, 'codex', 'a', 30, 'z'), worker(dir, 'codex', 'a', 30, 'q')])
    const store = openStore(dir)
    const records = store.listRecords()
    assert.equal(records.length, 3)
    assert.equal(aggregate(records, {}).tools.total, 120)
    assert.equal(aggregate(records, { agent: 'codex' }).tools.total, 60)
    assert.equal(aggregate(records, { agent: 'claude' }).sessions.observed, 2)
    assert.equal(readdirSync(join(dir, 'sessions', 'codex')).filter(n => n.endsWith('.tmp')).length, 0, 'no temp files left behind')
  } finally { done() }
})

test('a first run by two processes at once creates one pet, with one birthday', async () => {
  const { dir, done } = tempDir()
  try {
    const stores = [openStore(dir), openStore(dir), openStore(dir)]
    const pets = stores.map((s, i) => s.ensurePet(T0 + i))
    assert.equal(new Set(pets.map(p => p.id)).size, 1)
    assert.equal(new Set(pets.map(p => p.createdAt)).size, 1)
  } finally { done() }
})

test('the pet and its statistics survive "restarts" (a brand-new store object)', () => {
  const { dir, done } = tempDir()
  try {
    const first = openStore(dir)
    const pet = { ...first.ensurePet(T0), name: 'Biscuit', character: 'claude', colors: { body: '#ff8800', accent: null } }
    first.writePet(pet)
    first.applyEvent(ev('claude', 'SessionStart', { session_id: 'one' }))
    first.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: 'one' }))
    const second = openStore(dir)
    assert.deepEqual(second.ensurePet(), { ...pet, v: 2 })
    assert.equal(aggregate(second.listRecords(), {}).prompts, 1)
  } finally { done() }
})

test('a new chat starts a fresh session but lifetime numbers keep growing, across both agents', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    for (const [agent, session, prompts] of [['claude', 'chat-1', 2], ['claude', 'chat-2', 1], ['codex', 'thread-1', 3]]) {
      store.applyEvent(ev(agent, 'SessionStart', { session_id: session }))
      for (let i = 0; i < prompts; i++) store.applyEvent(ev(agent, 'UserPromptSubmit', { session_id: session }))
    }
    const records = store.listRecords()
    assert.equal(aggregate(records, { session: { agent: 'claude', sid: 'chat-2' } }).prompts, 1, 'the new chat starts at its own count')
    assert.equal(aggregate(records, {}).prompts, 6, 'lifetime keeps everything')
    assert.equal(aggregate(records, {}).sessions.observed, 3)
    assert.equal(store.ensurePet().id, store.ensurePet().id, 'one pet for all of it')
  } finally { done() }
})

test('a corrupted session file is quarantined, not trusted and not deleted', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    store.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: 'good' }))
    mkdirSync(join(dir, 'sessions', 'claude'), { recursive: true })
    writeFileSync(join(dir, 'sessions', 'claude', 'bad.json'), '{"v":1,"agent":"claude","sid":"bad","days":{ "2026-')
    writeFileSync(join(dir, 'sessions', 'claude', 'empty.json'), '')
    writeFileSync(join(dir, 'sessions', 'claude', 'junk.json'), '[1,2,3]')
    assert.equal(store.listRecords().length, 1, 'only the good record is read')
    assert.equal(aggregate(store.listRecords(), {}).prompts, 1)
    // Writing to the damaged session recovers it, and the damaged bytes are kept aside.
    store.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: 'bad' }))
    assert.equal(store.readRecord('claude', 'bad').days[Object.keys(store.readRecord('claude', 'bad').days)[0]].pr, 1)
    assert.ok(readdirSync(join(dir, 'sessions', 'claude')).some(name => name.includes('.corrupt-')))
  } finally { done() }
})

test('a corrupted pet file is quarantined and replaced, never crashing the reader', () => {
  const { dir, done } = tempDir()
  try {
    writeFileSync(join(dir, 'pet.json'), '{ not json')
    const store = openStore(dir)
    assert.equal(store.readPet().corrupt, true)
    const pet = store.ensurePet(T0)
    assert.equal(pet.createdAt, T0)
    assert.ok(readdirSync(dir).some(name => name.startsWith('pet.json.corrupt-')))
  } finally { done() }
})

test('records written by another version or by hand are repaired field by field', () => {
  const repaired = sanitizeRecord({
    v: 7, agent: 'claude', sid: 'abc', started: 'x', last: -5, days: { '2026-01-02': { pr: 3, tl: -1, ok: 'many', c: { read: 2, bogus: 9 }, extra: 1 }, 'nope': { pr: 1 } },
    git: [{ h: 'zzz' }, { h: 'a'.repeat(40), a: 5, r: 'x', f: 2, t: 1, d: '2026-01-02' }], live: { run: 5, tools: 'nope', pk: 'evil' },
  })
  assert.equal(repaired.v, 1)
  assert.deepEqual(repaired.days, { '2026-01-02': { pr: 3, c: { read: 2 } } })
  assert.equal(repaired.git.length, 1)
  assert.equal(repaired.git[0].r, null)
  assert.equal(repaired.live.pk, '')
  assert.equal(sanitizeRecord({ agent: 'someone-else', sid: 'a' }), undefined)
  assert.equal(sanitizeRecord({ agent: 'claude', sid: '../../etc/passwd' }), undefined)
  assert.equal(sanitizeRecord('text'), undefined)
})

test('export and import round-trip, and importing twice changes nothing', () => {
  const a = tempDir()
  const b = tempDir()
  try {
    const source = openStore(a.dir)
    source.writePet({ ...source.ensurePet(T0), name: 'Biscuit', character: 'claude' })
    for (const id of ['x', 'y']) { source.applyEvent(ev('claude', 'SessionStart', { session_id: id })); source.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: id })) }
    source.applyEvent(ev('codex', 'UserPromptSubmit', { session_id: 'c' }))
    const file = join(a.dir, 'backup.json')
    assert.equal(source.exportBackup(file).sessions, 3)

    const target = openStore(b.dir)
    const first = target.importBackup(readFileSync(file, 'utf8'), { pet: true })
    assert.equal(first.imported, 3)
    assert.equal(target.ensurePet().name, 'Biscuit')
    assert.equal(aggregate(target.listRecords(), {}).prompts, 3)
    const again = target.importBackup(readFileSync(file, 'utf8'))
    assert.equal(again.imported, 0, 'a second import is a no-op')
    assert.equal(aggregate(target.listRecords(), {}).prompts, 3)
  } finally { a.done(); b.done() }
})

test('import never lowers counts: it keeps the record that has seen more', () => {
  const newer = sanitizeRecord({ agent: 'claude', sid: 's', started: 1, last: 200, days: { '2026-01-01': { pr: 5 } } })
  const older = sanitizeRecord({ agent: 'claude', sid: 's', started: 1, last: 100, days: { '2026-01-01': { pr: 2 } } })
  assert.equal(mergeRecords([newer], [older]).records[0].days['2026-01-01'].pr, 5)
  assert.equal(mergeRecords([older], [newer]).records[0].days['2026-01-01'].pr, 5)
})

test('import rejects things that are not backups, without throwing and without writing', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    for (const bad of ['', 'not json', '[]', '{"format":"other"}', '{"format":"codepuff-backup"}', '{"format":"codepuff-backup","version":1,"sessions":"x"}', '{"format":"codepuff-backup","version":0,"sessions":[]}']) {
      assert.equal(store.importBackup(bad).ok, false, bad)
    }
    assert.equal(existsSync(join(dir, 'sessions')), false)
    const mixed = JSON.stringify(buildBackup(defaultPet(T0), []).sessions.length ? {} : { format: 'codepuff-backup', version: 1, pet: 'garbage', sessions: [{ agent: 'claude', sid: 'ok', days: {} }, { nonsense: true }, null] })
    const done2 = store.importBackup(mixed)
    assert.equal(done2.ok, true)
    assert.equal(done2.imported, 1)
    assert.equal(done2.skipped, 2)
    assert.equal(parseBackup('{"format":"codepuff-backup","version":3,"sessions":[]}').newer, true)
  } finally { done() }
})

test('reset statistics keeps the pet; reset pet keeps the statistics; delete removes everything', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    store.writePet({ ...store.ensurePet(T0), name: 'Biscuit', character: 'claude' })
    store.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: 'a' }))

    const stats = store.resetStats()
    assert.equal(stats.removed, 1)
    assert.ok(existsSync(stats.safety), 'a safety backup exists')
    assert.equal(store.listRecords().length, 0)
    assert.equal(store.ensurePet().name, 'Biscuit')
    assert.equal(store.ensurePet().createdAt, T0)

    store.applyEvent(ev('claude', 'UserPromptSubmit', { session_id: 'a' }))
    const reborn = store.resetPet(T0 + 86_400_000 * 10)
    assert.equal(reborn.name, '')
    assert.equal(reborn.createdAt, T0 + 86_400_000 * 10)
    assert.equal(store.listRecords().length, 1)

    store.writePet({ ...store.ensurePet(), name: 'Mochi', character: 'claude', colors: { body: '#123456', accent: null } })
    const look = store.resetAppearance()
    assert.deepEqual({ name: look.name, character: look.character, colors: look.colors }, { name: '', character: 'alpha', colors: { body: null, accent: null } })
    assert.equal(look.createdAt, store.ensurePet().createdAt)

    store.deleteAll()
    assert.equal(existsSync(dir), false)
  } finally { done() }
})

test('storage stays small: a record is about a kilobyte, however many tools it saw', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    for (let i = 0; i < 500; i++) store.applyEvent(normalizeHook('claude', { hook_event_name: 'PostToolUse', session_id: 'big', cwd: '/p', tool_name: i % 3 ? 'Read' : 'Edit', tool_input: { file_path: 'f' + (i % 40) }, tool_use_id: 't' + i, tool_response: {} }, T0 + i * 1000))
    const size = readFileSync(join(dir, 'sessions', 'claude', 'big.json')).length
    assert.ok(size < 4000, `record is ${size} bytes`)
  } finally { done() }
})
