import test from 'node:test'
import assert from 'node:assert/strict'
import { animation } from '../src/core/art/anim.js'
import { buildPalette } from '../src/core/art/palette.js'
import { H, K, R, SIDE, TOP, W } from '../src/core/art/canvas.js'
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'
import { drawScene } from '../src/core/art/scene.js'
import { petSvg, terminalFrame } from '../src/core/render/raster.js'
import { STYLES } from '../src/core/settings.js'
import { openStore } from '../src/node/store.js'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { T0, tempDir } from './helpers.js'

test('there are eight characters: Puff Alpha, Classic, Fox, Bot, Slime, Mage, Aquático and Claude', () => {
  assert.deepEqual([...MASCOT_IDS].sort(), ['alpha', 'aquatic', 'bot', 'classic', 'claude', 'fox', 'mage', 'slime'])
  const names = MASCOT_IDS.map(id => MASCOTS[id].name)
  for (const name of ['Puff Alpha', 'Puff Classic', 'Puff Fox', 'Puff Bot', 'Puff Slime', 'Puff Mage', 'Puff Aquático', 'Claude']) assert.ok(names.includes(name), name)
})

test('the scene is drawn at twice the original resolution', () => {
  assert.equal(K, 2)
  assert.equal(W, 72)
  assert.equal(H, 56)
})

test('every character renders every state in both styles, with a face', () => {
  for (const id of MASCOT_IDS) {
    for (const style of STYLES) {
      for (const state of ['idle', 'thinking', 'reading', 'coding', 'testing', 'success', 'error', 'permission', 'finished', 'disconnected']) {
        for (const { pose } of animation(state, { helpers: 3 }).frames) {
          const canvas = drawScene(id, pose, style)
          const used = canvas.px.reduce((n, role) => n + (role ? 1 : 0), 0)
          assert.ok(used > 600, `${id}/${style}/${state} has only ${used} pixels`)
          assert.ok(canvas.px.includes(R.INK) || canvas.px.includes(R.CYAN) || canvas.px.includes(R.WHITE), `${id}/${style}/${state} has no eyes`)
        }
      }
    }
  }
})

test('characters have real detail: many distinct tones and a large, smoothly shaded body', () => {
  for (const id of MASCOT_IDS) {
    const canvas = drawScene(id, animation('idle').frames[0].pose, 'pixel')
    const tones = new Set(canvas.px.filter(Boolean))
    assert.ok(tones.size >= 9, `${id} uses only ${tones.size} tones`)
    assert.ok(canvas.px.filter(Boolean).length > 900, `${id} is only ${canvas.px.filter(Boolean).length} pixels (a 16-bit sprite is about 300)`)
  }
})

test('3D is the same character extruded: lit tops and shaded sides, with the face still flat', () => {
  for (const id of MASCOT_IDS) {
    const pose = animation('idle').frames[0].pose
    const flat = drawScene(id, pose, 'pixel')
    const solid = drawScene(id, pose, '3d')
    const tops = solid.px.filter(role => role >= TOP && role < SIDE).length
    const sides = solid.px.filter(role => role >= SIDE).length
    assert.ok(tops > 40 && sides > 40, `${id}: tops ${tops}, sides ${sides}`)
    assert.equal(flat.px.filter(role => role >= TOP).length, 0, 'the pixel style has no 3D faces')
    assert.ok(solid.px.includes(R.INK) || solid.px.includes(R.CYAN), 'eyes stay on the front')
    assert.notDeepEqual([...flat.px], [...solid.px])
  }
})

test('3D tones come from the same colors: top lighter than the front, side darker', () => {
  const palette = buildPalette('fox', {})
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  for (const role of [R.BASE, R.LIGHT, R.ABASE, R.CREAM, R.GOLD]) {
    assert.ok(lum(palette[role + TOP]) > lum(palette[role]), `top of role ${role}`)
    assert.ok(lum(palette[role + SIDE]) < lum(palette[role]), `side of role ${role}`)
  }
})

test('the 3D style recolors like the pixel style', () => {
  const custom = petSvg({ character: 'slime', state: 'idle', colors: { body: '#ff3344' }, reduced: true, style: '3d' })
  assert.ok(custom.includes('<path'))
  assert.notEqual(custom, petSvg({ character: 'slime', state: 'idle', reduced: true, style: '3d' }))
})

test('SVG pictures of every character stay under the host limit, in both styles', () => {
  for (const id of MASCOT_IDS) {
    for (const style of STYLES) {
      for (const [state, helpers] of [['idle', 0], ['coding', 0], ['success', 3], ['delegating', 3], ['permission', 0]]) {
        const svg = petSvg({ character: id, state, helpers, style })
        assert.ok(svg.length < 125_000, `${id}/${style}/${state}: ${svg.length} characters (limit 131072)`)
      }
    }
  }
})

test('a hi-res pet shrinks to fit a narrow terminal pane and shows full detail in a wide one', () => {
  const wide = terminalFrame({ character: 'fox', state: 'idle', columns: 120 })
  const narrow = terminalFrame({ character: 'fox', state: 'idle', columns: 24 })
  assert.equal(wide.factor, 1)
  assert.ok(narrow.columns <= 24 && narrow.factor > 1)
  assert.ok(wide.columns > narrow.columns)
  const short = terminalFrame({ character: 'fox', state: 'idle', columns: 200, rows: 8 })
  assert.ok(short.rows <= 8, 'the row budget is respected too')
})

test('the compact band uses the head only, in both styles', () => {
  const height = svg => Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1])
  for (const style of STYLES) {
    const head = petSvg({ character: 'bot', state: 'idle', crop: 'head', scale: 1, reduced: true, style })
    const full = petSvg({ character: 'bot', state: 'idle', scale: 1, reduced: true, style })
    assert.ok(height(head) < height(full), 'the head crop is shorter than the whole pet')
  }
})

test('a pet saved by version 1 (the single "puff") is migrated to Puff Alpha, keeping its identity and look', () => {
  const { dir, done } = tempDir()
  try {
    writeFileSync(join(dir, 'pet.json'), JSON.stringify({ v: 1, id: 'abcdef0123456789', createdAt: T0, name: 'Biscuit', character: 'puff', colors: { body: '#ff8800', accent: null }, prefs: { motion: 'reduced', scope: 'session', line: true } }))
    const pet = openStore(dir).ensurePet()
    assert.equal(pet.character, 'alpha')
    assert.equal(pet.v, 2)
    assert.equal(pet.name, 'Biscuit')
    assert.equal(pet.id, 'abcdef0123456789')
    assert.equal(pet.createdAt, T0)
    assert.equal(pet.colors.body, '#ff8800')
    assert.equal(pet.prefs.motion, 'reduced')
    assert.equal(pet.prefs.style, 'pixel', 'new preferences get defaults')
    assert.equal(pet.prefs.band, true)
    assert.equal(pet.prefs.line, true)
  } finally { done() }
})

test('style and band preferences are validated and survive a restore of the default appearance', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    store.writePet({ ...store.ensurePet(T0), prefs: { motion: 'auto', scope: 'session', line: false, band: false, style: '3d' } })
    assert.equal(store.ensurePet().prefs.style, '3d')
    assert.equal(store.ensurePet().prefs.band, false)
    store.writePet({ ...store.ensurePet(), prefs: { ...store.ensurePet().prefs, style: 'holographic' } })
    assert.equal(store.ensurePet().prefs.style, 'pixel', 'an unknown style falls back')
    store.writePet({ ...store.ensurePet(), character: 'fox', prefs: { ...store.ensurePet().prefs, style: '3d' } })
    const restored = store.resetAppearance()
    assert.equal(restored.character, 'alpha')
    assert.equal(restored.prefs.style, 'pixel')
    assert.equal(restored.createdAt, T0)
  } finally { done() }
})
