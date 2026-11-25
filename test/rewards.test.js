import test from 'node:test'
import assert from 'node:assert/strict'
import { cardSvg } from '../src/core/card.js'
import { bandStyle } from '../src/core/frames.js'
import { PRESETS } from '../src/core/color.js'
import en from '../src/core/i18n/en.js'
import { MILESTONES } from '../src/core/milestones.js'
import { ACCESSORY_IDS, FRAME_IDS, FRAMES, PALETTE_REWARDS, REWARDS, frameOf, paletteOpen, rewardFor, unlockedOf, wornOf } from '../src/core/rewards.js'
import { drawScene } from '../src/core/art/scene.js'
import { animation } from '../src/core/art/anim.js'

test('every level of every achievement unlocks exactly one thing, and every thing exists', () => {
  assert.equal(REWARDS.length, MILESTONES.length, 'one reward for each level (the free rainbow frame is not one of them)')
  assert.deepEqual([...REWARDS.map(r => r.unlock)].sort(), MILESTONES.map(m => m.id).sort(), 'each level once')
  assert.equal(new Set(REWARDS.map(r => r.type + ':' + r.id)).size, REWARDS.length, 'no reward is given twice')
  const rest = animation('idle', { character: 'classic' }).frames[0].pose
  for (const reward of [...REWARDS, ...FRAMES.filter(f => f.unlock === null)]) {
    if (reward.unlock) assert.ok(en[rewardFor(reward.unlock).key], reward.id + ' has a name')
    if (reward.type === 'accessory') assert.ok(drawScene('classic', { ...rest, worn: reward.id }).px.some((role, i) => role !== drawScene('classic', rest).px[i]), reward.id + ' can be drawn')
    if (reward.type === 'palette') assert.ok(PRESETS.some(p => p.id === reward.id), reward.id + ' is a palette')
    if (reward.type === 'frame') assert.notEqual(cardSvg({ name: 'x', character: 'fox', frame: reward.id, hearts: 5, streak: 1, ageDays: 1, prompts: 1, tools: 1, done: 0, total: 1 }), cardSvg({ name: 'x', character: 'fox', hearts: 5, streak: 1, ageDays: 1, prompts: 1, tools: 1, done: 0, total: 1 }), reward.id + ' changes the card')
  }
  // Each of the three kinds is well represented.
  assert.deepEqual([ACCESSORY_IDS.length, PALETTE_REWARDS.length, FRAMES.length], [17, 9, 8], 'eight frames: rainbow is free, seven are earned')
})

test('a reward is only in use once its milestone is reached; palettes that are not rewards are always open', () => {
  assert.deepEqual(unlockedOf('accessory', null), [])
  assert.deepEqual(unlockedOf('accessory', ['tools-100', 'streak-3', 'tools-500']), ['flower', 'bow'])
  assert.deepEqual(unlockedOf('palette', ['tools-500']), ['sunset'])
  assert.equal(wornOf({ milestones: ['tools-100'], prefs: { accessory: 'flower' } }), 'flower')
  assert.equal(wornOf({ milestones: [], prefs: { accessory: 'flower' } }), null, 'chosen but not earned')
  assert.equal(frameOf({ milestones: [], prefs: { frame: 'rainbow' } }), 'rainbow', 'rainbow is free from the start')
  assert.equal(frameOf({ milestones: null, prefs: { frame: 'rainbow' } }), 'rainbow')
  assert.deepEqual(unlockedOf('frame', []), ['rainbow'])
  assert.equal(frameOf({ milestones: ['tools-5000'], prefs: { frame: 'crystal' } }), 'crystal')
  assert.equal(frameOf({ milestones: [], prefs: { frame: 'crystal' } }), null, 'an earned one is locked until then')
  assert.equal(frameOf({ milestones: ['tools-5000'], prefs: { frame: 'gold' } }), null)
  assert.equal(paletteOpen('mint', []), true, 'free')
  assert.equal(paletteOpen('sunset', []), false, 'a reward')
  assert.equal(paletteOpen('sunset', ['tools-500']), true, 'earned')
  assert.deepEqual(PRESETS.filter(p => paletteOpen(p.id, [])).map(p => p.id), ['default', 'sky', 'marshmallow', 'mint', 'lavender'], 'five are free from the start')
})

test('every frame has a look on the band too: a color, a background and a line style', () => {
  for (const id of FRAME_IDS) {
    const style = bandStyle(id)
    assert.match(style.border, /^#[0-9a-f]{6}$/, id)
    assert.match(style.background, /^#[0-9a-f]{6}$/, id)
    assert.ok(['round', 'single', 'double', 'bold', 'classic'].includes(style.line), id + ' uses a line style the host knows')
  }
  assert.equal(new Set(FRAME_IDS.map(id => bandStyle(id).border)).size, FRAME_IDS.length, 'no two frames share a color')
  assert.equal(bandStyle(null), null)
  assert.equal(bandStyle('nope'), null)
})

test('every card frame draws its own look, and no frame is the same as another', () => {
  const card = frame => cardSvg({ name: 'Mochi', character: 'classic', frame, hearts: 5, streak: 3, ageDays: 9, prompts: 40, tools: 400, done: 6, total: 33 })
  const all = [null, ...FRAME_IDS].map(card)
  assert.equal(new Set(all).size, all.length)
  for (const svg of all) assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>\n'))
  assert.ok(card('neon').includes('filter="url(#glow)"'))
  assert.ok(card('rainbow').includes('stroke="url(#rainbow)"'))
  assert.ok(card('pixel').includes('stroke-dasharray'))
})
