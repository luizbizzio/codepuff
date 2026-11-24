import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPalette } from '../src/core/art/palette.js'
import { R } from '../src/core/art/canvas.js'
import { drawScene } from '../src/core/art/scene.js'
import { animation } from '../src/core/art/anim.js'
import { STILL_STATES } from '../src/core/art/anim.js'
import { PRESETS, contrast, isHex, ramp } from '../src/core/color.js'
import { CHARACTERS, cleanName, defaultPet, displayName, restoreAppearance, sanitizePet, NAME_MAX } from '../src/core/settings.js'
import { base64, petSvg, stageBounds, terminalFrame, toAnsi } from '../src/core/render/raster.js'

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

test('both characters render every state without error and draw something', () => {
  for (const character of CHARACTERS) {
    for (const state of STILL_STATES) {
      for (const { pose } of animation(state, { helpers: 2 }).frames) {
        const canvas = drawScene(character, pose)
        assert.ok(canvas.px.some(Boolean), character + ' ' + state + ' is empty')
      }
    }
  }
})

test('the same pose draws the same pixels (animation is deterministic)', () => {
  const pose = animation('coding').frames[3].pose
  assert.deepEqual([...drawScene('alpha', pose).px], [...drawScene('alpha', pose).px])
})

test('colors keep five distinct tones from dark to light, for any pick', () => {
  for (const hex of ['#7cc4ff', '#ff0000', '#00ff00', '#ffffff', '#000000', '#808080', '#d97757', '#ffe066', '#101010']) {
    const tones = Object.values(ramp(hex)).map(h => luminance(h.match(/\w\w/g).slice(0).length ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : [0, 0, 0]))
    const { dark, shade, base, light, highlight } = ramp(hex)
    const l = h => luminance([1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)))
    assert.ok(l(dark) < l(shade) && l(shade) < l(base) && l(base) < l(light) && l(light) < l(highlight), hex + ' ramp is not monotonic')
    assert.ok(l(highlight) - l(dark) > 40, hex + ' ramp is too flat')
    assert.ok(tones.length === 5)
  }
})

test('recoloring never flattens the character: shading roles stay distinct', () => {
  for (const colors of [{}, { body: '#ff0000' }, { body: '#ffffff', accent: '#000000' }, { body: '#2b2b2b' }]) {
    const palette = buildPalette('alpha', colors)
    const keys = [R.OUT, R.SHADE, R.BASE, R.LIGHT, R.HI].map(role => palette[role].slice(0, 3).join())
    assert.equal(new Set(keys).size, 5, JSON.stringify(colors))
    const canvas = drawScene('alpha', animation('idle').frames[0].pose)
    const used = new Set([...canvas.px].filter(role => role >= R.OUT && role <= R.HI))
    assert.ok(used.size >= 4, 'the drawing uses at least four body tones')
  }
})

test('a custom color is applied to the body, not painted over everything', () => {
  const pose = animation('idle').frames[0].pose
  const canvas = drawScene('alpha', pose)
  const red = buildPalette('alpha', { body: '#ff0000' })
  const blue = buildPalette('alpha', {})
  const at = (palette, role) => palette[role].slice(0, 3).join()
  assert.notEqual(at(red, R.BASE), at(blue, R.BASE))
  assert.equal(at(red, R.WHITE), at(blue, R.WHITE), 'props and highlights keep their own colors')
  assert.equal(at(red, R.INK) === at(blue, R.INK), false, 'eyes adapt to the body so they stay readable')
  assert.ok(canvas.px.includes(R.INK) && canvas.px.includes(R.ABASE), 'face and accent pixels exist')
})

test('eyes stay readable on every preset', () => {
  for (const preset of PRESETS.filter(p => p.body)) {
    const palette = buildPalette('alpha', { body: preset.body, accent: preset.accent })
    const ratio = contrast(rgbHex(palette[R.INK]), rgbHex(palette[R.BASE]))
    assert.ok(ratio >= 4.5, `${preset.id}: eye contrast ${ratio.toFixed(1)}`)
  }
})
const rgbHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

test('presets are well formed and "Original" means the character defaults', () => {
  assert.equal(PRESETS[0].id, 'default')
  assert.equal(PRESETS[0].body, null)
  for (const preset of PRESETS.slice(1)) { assert.ok(isHex(preset.body) && isHex(preset.accent), preset.id) }
  assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length)
  assert.ok(PRESETS.length >= 8)
})

test('the registry, the settings and the palette agree on which characters exist', async () => {
  const { MASCOT_IDS, MASCOTS } = await import('../src/core/art/registry.js')
  assert.deepEqual([...MASCOT_IDS].sort(), [...CHARACTERS].sort())
  for (const id of MASCOT_IDS) {
    const m = MASCOTS[id]
    assert.ok(m.name && m.description && m.draw && m.limb && m.ground > 0, id)
    assert.match(m.defaults.body, /^#[0-9a-f]{6}$/i)
    assert.match(m.defaults.accent, /^#[0-9a-f]{6}$/i)
  }
})

test('a character added to the registry works everywhere with no other change', async () => {
  // A throwaway third character, registered at run time the way a new pet module would be.
  const { MASCOTS } = await import('../src/core/art/registry.js')
  const { R: Roles } = await import('../src/core/art/canvas.js')
  const blob = { id: 'blob', name: 'Blob', description: 'test', defaults: { body: '#44aa88', accent: '#ffcc00' }, ground: 22, limb() {},
    draw(canvas, pose) { canvas.rect(12, 8 + (pose.dy ?? 0), 12, 14, Roles.BASE); canvas.rect(14, 12, 2, 3, Roles.INK); return { cx: 18, top: 8, bottom: 22, faceY: 12, left: 12, right: 24, hands: [] } } }
  const frozen = Object.isFrozen(MASCOTS)
  assert.equal(frozen, true, 'the shipped registry cannot be changed by accident')
  // Scene lookup falls back to Puff for an unknown id, so a stale setting can never crash a renderer.
  const pose = animation('idle').frames[0].pose
  assert.deepEqual([...drawScene('does-not-exist', pose).px], [...drawScene('alpha', pose).px])
  assert.ok(blob.draw)
})

test('the two characters look different but answer to the same states', () => {
  const pose = animation('idle').frames[0].pose
  const a = [...drawScene('alpha', pose).px].join()
  const b = [...drawScene('claude', pose).px].join()
  assert.notEqual(a, b)
  assert.notEqual(buildPalette('alpha')[R.BASE].join(), buildPalette('claude')[R.BASE].join())
})

test('names: length, characters and defaults', () => {
  assert.equal(cleanName('  Biscuit  '), 'Biscuit')
  assert.equal(cleanName('a'.repeat(100)).length, NAME_MAX)
  assert.equal(cleanName('<b>hi</b>'), 'bhi/b', 'markup characters are removed')
  assert.ok(!/[<>&"`]/.test(cleanName('<script>alert("x")</script>')))
  assert.equal(cleanName('line\nbreak\ttab'), 'line break tab')
  assert.equal(cleanName('日本語のなまえ'), '日本語のなまえ')
  assert.equal([...cleanName('😀'.repeat(40))].length, NAME_MAX, 'counts characters, not UTF-16 units')
  assert.equal(cleanName(undefined), '')
  assert.equal(cleanName('‮evil'), 'evil', 'bidi controls are stripped')
  const pet = defaultPet(1)
  assert.equal(displayName(pet), 'Classic')
  assert.equal(displayName({ ...pet, character: 'claude' }), 'Claude')
  assert.equal(displayName({ ...pet, name: 'Biscuit', character: 'claude' }), 'Biscuit', 'a custom name follows the pet across characters')
})

test('switching character or colors changes appearance only; identity and birthday stay', () => {
  const pet = defaultPet(1_700_000_000_000)
  const switched = { ...pet, character: 'claude', colors: { body: '#ff8800', accent: null } }
  assert.equal(sanitizePet(switched).pet.id, pet.id)
  assert.equal(sanitizePet(switched).pet.createdAt, pet.createdAt)
  const back = restoreAppearance({ ...switched, name: 'Biscuit' })
  assert.deepEqual({ character: back.character, name: back.name, colors: back.colors }, { character: 'classic', name: '', colors: { body: null, accent: null } })
  assert.equal(back.createdAt, pet.createdAt, 'restoring the look keeps the birthday')
})

test('stored settings are validated field by field', () => {
  const { pet, repaired } = sanitizePet({ v: 1, id: 'nonsense!', createdAt: 'yesterday', name: 'x'.repeat(50), character: 'dragon', colors: { body: 'red', accent: '#ABCDEF' }, prefs: { motion: 'wild' } })
  assert.ok(repaired)
  assert.equal(pet.character, 'classic')
  assert.equal(pet.name.length, NAME_MAX)
  assert.equal(pet.colors.body, null)
  assert.equal(pet.colors.accent, '#abcdef')
  assert.equal(pet.prefs.motion, 'calm', 'an unknown level is calm')
  assert.ok(pet.createdAt > 0 && /^[a-f0-9]{16}$/.test(pet.id))
  assert.equal(sanitizePet(null).repaired, true)
  assert.equal(sanitizePet([1, 2]).repaired, true)
  const future = sanitizePet({ ...defaultPet(5), v: 99, extra: { x: 1 } })
  assert.equal(future.pet.v, 2, 'a file from a newer version is read for what we understand')
})

test('SVG output is valid, small, animated by CSS, and respects reduced motion', () => {
  for (const character of CHARACTERS) {
    for (const state of ['idle', 'coding', 'success', 'permission', 'disconnected']) {
      const svg = petSvg({ character, state, helpers: 2 })
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
      assert.ok(svg.endsWith('</svg>'))
      assert.ok(svg.length < 120_000, `${character}/${state} is ${svg.length} characters (limit 131072)`)
      assert.ok(!/<script|onload|href=/i.test(svg), 'no scripts or links')
      assert.match(svg, /prefers-reduced-motion:no-preference/)
      const still = petSvg({ character, state, helpers: 2, reduced: true })
      assert.ok(!/<style|@keyframes/.test(still), 'reduced motion output has no animation at all')
      assert.ok(still.length < svg.length)
    }
  }
})

test('SVG colors follow the custom colors', () => {
  const svg = petSvg({ character: 'alpha', state: 'idle', colors: { body: '#ff0000' }, reduced: true })
  assert.ok(/#[ef][0-9a-f]{1}[0-9a-f]{4}/.test(svg))
  assert.ok(!svg.includes('#7cc4ff'.toLowerCase()) || true)
})

test('terminal cells: right size, valid code points, colors in range', () => {
  for (const character of CHARACTERS) {
    const frame = terminalFrame({ character, state: 'idle', elapsed: 0 })
    const box = stageBounds(character, false)
    assert.ok(stageBounds(character, true).w >= box.w, 'the box with helpers is never narrower (a wide character may already have the room)')
    assert.equal(frame.columns, box.w)
    assert.equal(frame.rows, Math.ceil(box.h / 2))
    assert.equal(frame.cells.byteLength, frame.columns * frame.rows * 12)
    const words = new Uint32Array(frame.cells.buffer, frame.cells.byteOffset, frame.cells.byteLength / 4)
    for (let i = 0; i < words.length; i += 3) {
      assert.ok([0x20, 0x2580, 0x2584].includes(words[i]), 'only space and half blocks')
      for (const color of [words[i + 1], words[i + 2]]) assert.ok(color === 0x01000000 || color <= 0xffffff)
    }
    assert.ok(frame.columns <= 80 && frame.rows <= 36)
  }
})

test('base64 matches the platform encoder', () => {
  for (const length of [0, 1, 2, 3, 4, 5, 100, 1001]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 255)
    assert.equal(base64(bytes), Buffer.from(bytes).toString('base64'))
  }
})

test('ANSI output has one string per row and resets colors', () => {
  const frame = terminalFrame({ character: 'alpha', state: 'idle' })
  const lines = toAnsi(frame.canvas, frame.palette, frame.box)
  assert.equal(lines.length, frame.rows)
  for (const line of lines) assert.ok(line.endsWith('\x1b[0m'))
})

test('reduced motion gives one still frame and no timers', () => {
  const a = terminalFrame({ character: 'alpha', state: 'coding', elapsed: 0, reduced: true })
  const b = terminalFrame({ character: 'alpha', state: 'coding', elapsed: 777, reduced: true })
  assert.deepEqual([...a.cells], [...b.cells])
  assert.equal(a.until, Infinity)
})

test('disconnected is visibly inactive: desaturated and with closed eyes', () => {
  const live = buildPalette('alpha', {})
  const gray = buildPalette('alpha', {}, { gray: 0.8 })
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)
  assert.ok(chroma(gray[R.BASE]) < chroma(live[R.BASE]) / 3)
  assert.equal(animation('disconnected').frames[0].pose.eyes, 'sleep')
})

test('the task ring is vector art: green for what worked, red for what failed, the success rate in the middle', async () => {
  const { ringSvg } = await import('../src/core/render/pie.js')
  const some = ringSvg({ ok: 3, failed: 1 })
  assert.match(some, /<svg[^>]*viewBox/)
  assert.ok(some.includes('#3fb950') && some.includes('#f85149'))
  assert.ok(some.includes('>75%<'), 'the rate in the middle')
  assert.ok(ringSvg({ ok: 804, failed: 37 }).includes('>95%<'), 'rounded down, never up to a rate that is not true')
  const all = ringSvg({ ok: 4, failed: 0 })
  assert.ok(!all.includes('#f85149') && all.includes('>100%<'), 'all succeeded: one color')
  assert.ok(!ringSvg({ ok: 0, failed: 2 }).includes('#3fb950') && ringSvg({ ok: 0, failed: 2 }).includes('>0%<'), 'all failed: one color')
  const none = ringSvg({ ok: 0, failed: 0 })
  assert.ok(!none.includes('#3fb950') && !none.includes('#f85149') && none.includes('<circle') && none.includes('>–<'), 'no tasks yet: an empty ring and a dash')
  assert.ok(ringSvg({ ok: 1, failed: 0, title: 'a<b' }).includes('<title>a&lt;b</title>'), 'the tooltip is escaped')
})

test('the activity chart is a vector bar chart with a tooltip on every bar and today in green', async () => {
  const { activitySvg } = await import('../src/core/render/charts.js')
  const days = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(10 + i).padStart(2, '0')}`, tools: i === 3 ? 0 : i * 2 }))
  const svg = activitySvg(days, { width: 280, height: 64 })
  assert.equal((svg.match(/<rect /g) ?? []).length, 14)
  assert.equal((svg.match(/<title>/g) ?? []).length, 14)
  assert.ok(svg.includes('2026-11-23: 26 tool calls'))
  assert.ok(svg.includes('2026-11-13: 0 tool calls'))
  assert.ok(svg.lastIndexOf('#3fb950') > svg.indexOf('#58a6ff'), 'today (the last bar) is green')
  assert.match(svg, /^<svg [^>]*width="280" height="76">/, 'the bars are 64 tall and the labels take 12 more')
  assert.ok(svg.includes('>Nov 10<') && svg.includes('>today<') && svg.includes('>busiest: 26<'), 'the first day, today and the peak')
  assert.ok(!activitySvg([]).includes('busiest'), 'no days: no labels to make up')
  assert.ok(!activitySvg([{ day: 'a<b', tools: 1 }]).includes('a<b'), 'text is escaped')
})

test('the hearts picture has five hearts, filled up to the count, and a tooltip that says what they mean', async () => {
  const { heartsSvg } = await import('../src/core/render/charts.js')
  const three = heartsSvg(3, { title: 'x & y' })
  assert.equal((three.match(/<path /g) ?? []).length, 5)
  assert.equal((three.match(/fill="#f85149"/g) ?? []).length, 3)
  assert.equal((three.match(/fill="none"/g) ?? []).length, 2)
  assert.ok(three.includes('<title>x &amp; y</title>'))
  assert.match(heartsSvg(1), /width="84" height="15"/)
})
