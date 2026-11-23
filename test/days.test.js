import test from 'node:test'
import assert from 'node:assert/strict'
import { activity, aggregate, petAge, series } from '../src/core/aggregate.js'
import { addDays, dayKey, daysBetween, isDayKey, streaks } from '../src/core/days.js'
import { newRecord, reduce } from '../src/core/session.js'
import { normalizeHook } from '../src/core/normalize.js'
import { hook, T0, withZone } from './helpers.js'

const DAY = 86_400_000

test('day keys follow the local calendar, not UTC', () => {
  const at = Date.UTC(2026, 5, 10, 2, 30) // 02:30 UTC
  withZone(-180, () => assert.equal(dayKey(at), '2026-06-09')) // UTC-3: still the 9th
  withZone(0, () => assert.equal(dayKey(at), '2026-06-10'))
  withZone(540, () => assert.equal(dayKey(at), '2026-06-10')) // UTC+9: 11:30 on the 10th
  withZone(840, () => assert.equal(dayKey(Date.UTC(2026, 5, 10, 11, 0)), '2026-06-11')) // UTC+14
})

test('a DST change never skips or repeats a day', () => {
  // America/Sao_Paulo-like: -180 normally, -120 during DST, switching at a known instant.
  const switchAt = Date.UTC(2026, 9, 18, 3, 0)
  const offset = ms => (ms < switchAt ? -180 : -120)
  withZone(offset, () => {
    const keys = []
    for (let ms = Date.UTC(2026, 9, 15, 12); ms < Date.UTC(2026, 9, 22, 12); ms += DAY) keys.push(dayKey(ms))
    assert.deepEqual(keys, ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'])
  })
  // Calendar arithmetic is immune to DST by construction.
  assert.equal(addDays('2026-03-07', 1), '2026-03-08')
  assert.equal(addDays('2026-03-08', 1), '2026-03-09')
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31)
  assert.equal(addDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addDays('2025-12-31', 1), '2026-01-01')
})

test('day keys validate', () => {
  assert.ok(isDayKey('2026-02-28'))
  assert.ok(!isDayKey('2026-02-30'))
  assert.ok(!isDayKey('26-1-1'))
  assert.ok(!isDayKey(undefined))
})

test('streaks: current, longest, and the grace of "yesterday"', () => {
  const today = '2026-11-23'
  assert.deepEqual(strip(streaks(['2026-11-21', '2026-11-22', '2026-11-23'], today)), { current: 3, longest: 3 })
  assert.deepEqual(strip(streaks(['2026-11-20', '2026-11-21', '2026-11-22'], today)), { current: 3, longest: 3 }, 'today has not started yet, the streak is still alive')
  assert.deepEqual(strip(streaks(['2026-11-19', '2026-11-20', '2026-11-21'], today)), { current: 0, longest: 3 }, 'a missed day ends it')
  assert.deepEqual(strip(streaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-23'], today)), { current: 1, longest: 4 })
  assert.deepEqual(strip(streaks([], today)), { current: 0, longest: 0 })
  assert.deepEqual(strip(streaks(['2026-11-23', '2026-11-23', 'garbage'], today)), { current: 1, longest: 1 })
  // Across a month and a leap day.
  assert.equal(streaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01').current, 3)
})
const strip = ({ current, longest }) => ({ current, longest })

function recordWithPromptsOn(days, now = T0) {
  const rec = newRecord(normalizeHook('claude', hook('SessionStart'), now))
  for (const offset of days) reduce(rec, normalizeHook('claude', hook('UserPromptSubmit'), now + offset * DAY))
  return rec
}

test('only real user activity makes a day active; background events do not', () => {
  const rec = newRecord(normalizeHook('claude', hook('SessionStart'), T0))
  // A day with only agent activity (tools, a turn end, a subagent) and no prompt.
  reduce(rec, normalizeHook('claude', hook('PostToolUse', { tool_name: 'Read', tool_use_id: 'x', tool_response: {} }), T0 + DAY))
  reduce(rec, normalizeHook('claude', hook('Stop'), T0 + DAY + 1000))
  reduce(rec, normalizeHook('claude', hook('SubagentStart', { agent_id: 'a' }), T0 + DAY + 2000))
  withZone(0, () => {
    const a = activity([rec], { today: '2026-11-24' })
    assert.equal(a.total, 0)
    assert.equal(a.current, 0)
    reduce(rec, normalizeHook('claude', hook('UserPromptSubmit'), T0 + DAY + 3000))
    assert.equal(activity([rec], { today: '2026-11-24' }).current, 1)
  })
})

test('the streak survives a restart: it is computed from stored data, not from memory', () => {
  withZone(0, () => {
    const rec = recordWithPromptsOn([0, 1, 2, 3])
    const reloaded = JSON.parse(JSON.stringify(rec)) // what a restart reads back from disk
    assert.equal(activity([reloaded], { today: '2026-11-26' }).current, 4)
    assert.equal(activity([reloaded], { today: '2026-11-27' }).current, 4, 'still alive the next morning')
    assert.equal(activity([reloaded], { today: '2026-11-28' }).current, 0)
    assert.equal(activity([reloaded], { today: '2026-11-28' }).longest, 4)
  })
})

test('Claude Code and Codex activity share one streak; each agent can also be asked alone', () => {
  withZone(0, () => {
    const claude = recordWithPromptsOn([0, 1])
    const codex = newRecord(normalizeHook('codex', hook('SessionStart', { session_id: 'c' }), T0))
    reduce(codex, normalizeHook('codex', hook('UserPromptSubmit', { session_id: 'c' }), T0 + 2 * DAY))
    assert.equal(activity([claude, codex], { today: '2026-11-25' }).current, 3)
    assert.equal(activity([claude, codex], { agent: 'codex', today: '2026-11-25' }).current, 1)
    assert.equal(activity([claude, codex], { agent: 'claude', today: '2026-11-25' }).current, 2, 'Claude Code alone: yesterday keeps its streak alive')
    assert.equal(activity([claude, codex], { agent: 'claude', today: '2026-11-26' }).current, 0)
  })
})

test('events across local midnight land on the right days', () => {
  // 23:30 and 00:30 local (UTC-3) are on different days even though they are one hour apart.
  withZone(-180, () => {
    const lateNight = Date.UTC(2026, 10, 24, 2, 30) // 23:30 on the 23rd local
    const rec = newRecord(normalizeHook('claude', hook('SessionStart'), lateNight))
    reduce(rec, normalizeHook('claude', hook('UserPromptSubmit'), lateNight))
    reduce(rec, normalizeHook('claude', hook('UserPromptSubmit'), lateNight + 3_600_000))
    assert.deepEqual(Object.keys(rec.days).sort(), ['2026-11-23', '2026-11-24'])
    assert.equal(activity([rec], { today: '2026-11-24' }).current, 2)
  })
})

test('the pet birthday and age are separate from the streak', () => {
  withZone(0, () => {
    const created = Date.UTC(2026, 7, 15, 10)
    const now = Date.UTC(2026, 10, 23, 8)
    const age = petAge(created, now)
    assert.equal(age.born, '2026-08-15')
    assert.equal(age.days, 100)
    const rec = recordWithPromptsOn([0])
    assert.equal(activity([rec], { today: '2026-11-23' }).current, 1, 'a 100-day-old pet with a 1-day streak')
  })
})

test('series gives one row per day with zeros for quiet days', () => {
  withZone(0, () => {
    const rec = recordWithPromptsOn([0, 2])
    const rows = series([rec], { days: 5, today: '2026-11-25' })
    assert.equal(rows.length, 5)
    assert.deepEqual(rows.map(r => r.prompts), [0, 0, 1, 0, 1])
    assert.equal(rows[0].day, '2026-11-21')
  })
})

test('aggregate handles records with damaged fields without throwing', () => {
  assert.doesNotThrow(() => aggregate([null, {}, { days: null }, { days: { 'not-a-day': { pr: 'x' } }, agent: 'claude' }], {}))
})
