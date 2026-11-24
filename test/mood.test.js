import test from 'node:test'
import assert from 'node:assert/strict'
import { animation } from '../src/core/art/anim.js'
import { afterDays, afterMessage, heartsOf, judge } from '../src/core/mood.js'
import { sanitizePet, defaultPet } from '../src/core/settings.js'
import { T0 } from './helpers.js'

test('abuse aimed at the assistant is told apart from swearing at a bug, in English and Portuguese', () => {
  for (const rude of ['you are stupid', 'você é um idiota', 'vai se foder', 'burro', 'cala a boca', 'shut up', 'idiota!!', 'fuck you', 'você é burro'])
    assert.equal(judge(rude).insult, 2, rude)
  for (const fine of ['this stupid bug', 'fuck this bug', 'essa merda de erro', 'deu merda no deploy', 'you are not stupid', 'você não é burro', 'fix the login', '```idiota``` fix it', 'the trash can component', ''])
    assert.equal(judge(fine).insult, 0, fine)
  for (const harsh of ['that was a terrible answer from you', 'your code is garbage', 'vc é inútil', 'you are useless'])
    assert.equal(judge(harsh).insult, 1, harsh + ': harsh criticism, not abuse')
})

test('thanks are noticed, but not from someone who also insults', () => {
  for (const kind of ['thanks!', 'obrigado, perfeito', 'good job', 'valeu'])
    assert.equal(judge(kind).kind, true, kind)
  assert.equal(judge('thanks, you idiot').kind, false)
  assert.equal(judge('fix the login').kind, false)
})

test('hearts: one to five from a score; insults cost, thanks and days give back, and the score stays in range', () => {
  assert.deepEqual([1, 20, 21, 40, 60, 80, 81, 100].map(heartsOf), [1, 1, 2, 2, 3, 4, 5, 5])
  assert.equal(afterMessage(100, { insult: 2, kind: false }), 85)
  assert.equal(afterMessage(100, { insult: 1, kind: false }), 100, 'harsh criticism costs nothing')
  assert.equal(afterMessage(100, { insult: 0, kind: true }), 100, 'never above the top')
  assert.equal(afterMessage(5, { insult: 2, kind: false }), 1, 'never below the bottom: one heart is always left')
  assert.equal(heartsOf(afterMessage(1, { insult: 2, kind: false })), 1)
  assert.equal(afterDays(50, 2), 70)
  assert.equal(afterDays(95, 3), 100)
})

test('the affection is part of the saved pet, repaired when invalid, and a new pet starts at full', () => {
  assert.deepEqual(defaultPet(T0).affection, { score: 100, day: '', at: 0 })
  const odd = sanitizePet({ ...defaultPet(T0), affection: { score: 'lots', day: 'yesterday' } }, T0).pet
  assert.deepEqual(odd.affection, { score: 100, day: '', at: 0 })
  const wild = sanitizePet({ ...defaultPet(T0), affection: { score: -50, day: '2026-01-02' } }, T0).pet
  assert.deepEqual(wild.affection, { score: 1, day: '2026-01-02', at: 0 })
})

test('waiting is always a happy face: no thought dots, never a frown, never worried', () => {
  for (const { pose } of animation('waiting').frames) {
    assert.ok(!pose.fx.some(item => item.id === 'dots'), 'no bubble of dots')
    assert.ok(['smile', 'grin'].includes(pose.mouth), 'a smile (' + pose.mouth + ')')
    assert.ok(['open', 'blink', 'happy'].includes(pose.eyes))
    assert.equal(pose.brows, 'none')
  }
})

test('feeling down and hurt look sad: worried brows and a frown, with a tear', () => {
  for (const name of ['sad', 'hurt']) {
    const frames = animation(name).frames
    assert.ok(frames.some(f => f.pose.brows === 'worry' && ['frown', 'o'].includes(f.pose.mouth)), name)
    assert.ok(frames.some(f => f.pose.fx.some(item => item.id === 'sweat')), name + ' has a tear')
  }
})

test('sounds play one at a time, and a third that arrives while two are waiting is dropped', async () => {
  const { createSoundQueue } = await import('../src/claude/soundqueue.js')
  const log = []
  let running = 0
  let most = 0
  const play = createSoundQueue(async name => {
    running++; most = Math.max(most, running)
    log.push('start ' + name)
    await new Promise(resolve => setTimeout(resolve, 20))
    log.push('end ' + name)
    running--
  })
  assert.equal(play('a'), true)
  assert.equal(play('b'), true)
  assert.equal(play('c'), false, 'a third is dropped')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b'])
  assert.equal(most, 1, 'never two at once')
  assert.equal(play('d'), true, 'room again once they are done')
  const broken = createSoundQueue(() => { throw new Error('no player') })
  assert.equal(broken('x'), true)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(broken('y'), true, 'a failing player does not jam the queue')
})
