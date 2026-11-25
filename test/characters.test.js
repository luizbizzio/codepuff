import test from 'node:test'
import assert from 'node:assert/strict'
import { REACTIONS, animation } from '../src/core/art/anim.js'
import { buildPalette } from '../src/core/art/palette.js'
import { Canvas, H, K, LEVEL, R, W } from '../src/core/art/canvas.js'
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'
import { partsOf } from '../src/core/art/parts.js'
import { artHashes } from './art-hashes.js'
import { STAND, drawScene } from '../src/core/art/scene.js'
import { bandBox, petSvg, stageBounds, terminalFrame } from '../src/core/render/raster.js'
import { STATES } from '../src/core/petstate.js'
import { ACCESSORY_IDS } from '../src/core/rewards.js'
import { openStore } from '../src/node/store.js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { T0, tempDir } from './helpers.js'

test('there are eight characters: Alpha, Classic, Foxy, Bot, Slime, Mage, Penny and Claude', () => {
  assert.deepEqual([...MASCOT_IDS].sort(), ['alpha', 'aquatic', 'bot', 'classic', 'claude', 'fox', 'mage', 'slime'])
  const names = MASCOT_IDS.map(id => MASCOTS[id].name)
  for (const name of ['Alpha', 'Classic', 'Foxy', 'Bot', 'Slime', 'Mage', 'Penny', 'Claude']) assert.ok(names.includes(name), name)
})

test('the scene is drawn at twice the original resolution', () => {
  assert.equal(K, 2)
  assert.equal(W, 72)
  assert.equal(H, 72)
})

test('sprites stay inside the scene in every state (no clipped hat, antenna or hop) and keep their shading when recolored', () => {
  for (const id of ['classic', 'fox', 'bot', 'slime', 'mage', 'aquatic']) {
    for (const state of ['idle', 'success', 'error', 'coding', 'thinking']) {
      for (const { pose } of animation(state, { character: id }).frames) {
        // Effects (sparkles, bubbles) may leave the scene; the character itself must not.
        const canvas = drawScene(id, { ...pose, fx: [], helpers: 0 })
        assert.ok(!canvas.px.subarray(0, W).some(Boolean), `${id}/${state} touches the top edge of the scene`)
        assert.ok(!canvas.px.subarray(W * (H - 1)).some(Boolean), `${id}/${state} touches the bottom edge of the scene`)
      }
    }
    // A user color moves the body tones toward it without flattening them: lighter tones stay lighter.
    const plain = buildPalette(id, {})
    const tinted = buildPalette(id, { body: '#d83a3a', accent: '#2fa763' })
    const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b
    const slots = [...new Set(canvasSlots(id))]
    const changed = slots.filter(slot => lum(plain[slot]) !== lum(tinted[slot]) || plain[slot].join() !== tinted[slot].join())
    assert.ok(changed.length > 0, `${id} follows the body color`)
    const ordered = changed.map(slot => [lum(plain[slot]), lum(tinted[slot])]).sort((a, b) => a[0] - b[0])
    const distinct = new Set(ordered.map(([, after]) => Math.round(after))).size
    assert.ok(distinct >= Math.min(4, ordered.length), `${id} keeps several tones after recoloring`)
  }
})

test('a held prop sits under the face, not under the middle of the sprite', () => {
  const frame = state => animation(state).frames[0].pose
  for (const id of ['aquatic', 'mage']) {
    const idle = mascotAnchors(id, frame('idle'))
    const coding = mascotAnchors(id, frame('coding'))
    assert.ok(coding.propCx !== undefined && Math.abs(coding.propCx - idle.cx) >= 1.5, `${id} lays the laptop under the face`)
    assert.ok(coding.propBottom >= coding.bottom, `${id} never lifts the laptop above its feet`)
  }
})

function canvasSlots(id) {
  const canvas = drawScene(id, animation('idle').frames[0].pose)
  return [...canvas.px].filter(role => role >= 43 && role < LEVEL)
}

function mascotAnchors(id, pose) {
  return MASCOTS[id].draw(new Canvas(), pose)
}

test('every character renders every state, with a face', () => {
  for (const id of MASCOT_IDS) {
    for (const state of ['idle', 'thinking', 'reading', 'coding', 'testing', 'success', 'error', 'permission', 'finished', 'disconnected']) {
      for (const { pose } of animation(state, { helpers: 3, character: id }).frames) {
        const canvas = drawScene(id, pose)
        const used = canvas.px.reduce((n, role) => n + (role ? 1 : 0), 0)
        assert.ok(used > 600, `${id}/${state} has only ${used} pixels`)
        assert.ok(canvas.px.includes(R.INK) || canvas.px.includes(R.CYAN) || canvas.px.includes(R.WHITE), `${id}/${state} has no eyes`)
      }
    }
  }
})

test('characters have real detail: many distinct tones and a large, smoothly shaded body', () => {
  for (const id of MASCOT_IDS) {
    const canvas = drawScene(id, animation('idle').frames[0].pose)
    const tones = new Set(canvas.px.filter(Boolean))
    assert.ok(tones.size >= 9, `${id} uses only ${tones.size} tones`)
    assert.ok(canvas.px.filter(Boolean).length > 900, `${id} is only ${canvas.px.filter(Boolean).length} pixels (a 16-bit sprite is about 300)`)
  }
})

test('what a pet holds is drawn over it, in front', () => {
  const pose = animation('coding').frames[0].pose
  const canvas = drawScene('mage', pose)
  assert.ok(canvas.px.includes(R.METAL), 'the laptop is on the scene')
  assert.ok(canvas.px.includes(R.SCREEN) || canvas.px.includes(R.NAVY2))
})

test('SVG pictures of every character stay under the host limit', () => {
  for (const id of MASCOT_IDS) {
    for (const [state, helpers] of [['idle', 0], ['coding', 0], ['success', 3], ['delegating', 3], ['permission', 0]]) {
      const svg = petSvg({ character: id, state, helpers })
      assert.ok(svg.length < 125_000, `${id}/${state}: ${svg.length} characters (limit 131072)`)
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

test('every accessory shows on every character, inside the shared frame, in every state', () => {
  const box = stageBounds('alpha')
  for (const id of MASCOT_IDS) {
    const rest = animation('idle', { character: id }).frames[0].pose
    const bare = drawScene(id, rest)
    for (const worn of ACCESSORY_IDS) {
      const dressed = drawScene(id, { ...rest, worn })
      assert.ok(dressed.px.some((role, i) => role !== bare.px[i]), `${id} wears ${worn}`)
      for (const state of STATES) {
        const frames = animation(state, { character: id, worn }).frames
        assert.equal(frames[0].pose.worn, worn, 'what is worn is in every pose')
        for (const { pose } of [frames[0], frames[frames.length >> 1]]) {
          const canvas = drawScene(id, pose)
          for (let y = 0; y < canvas.h; y++) for (let x = 0; x < canvas.w; x++) {
            if (canvas.px[y * canvas.w + x]) assert.ok(x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h, `${id} wearing ${worn} in ${state} draws outside the frame at ${x},${y}`)
          }
        }
      }
    }
  }
  // What is worn is part of the picture (and of its cache), and nothing changes for a pet that wears nothing.
  assert.notEqual(petSvg({ character: 'fox', state: 'idle', worn: 'crown' }), petSvg({ character: 'fox', state: 'idle' }))
  assert.equal(petSvg({ character: 'fox', state: 'idle', worn: null }), petSvg({ character: 'fox', state: 'idle' }))
  assert.equal(animation('idle', { character: 'fox' }).frames[0].pose.worn, null)
})

test('every character, state and frame fits one shared frame, and all of them stand on the same line', () => {
  const box = stageBounds('alpha')
  for (const id of MASCOT_IDS) {
    assert.deepEqual(stageBounds(id), box, 'one frame for everyone')
    for (const state of [...STATES, ...REACTIONS]) {
      for (const helpers of [0, 3]) {
        for (const { pose } of animation(state, { helpers, character: id }).frames) {
          const canvas = drawScene(id, pose)
          for (let y = 0; y < canvas.h; y++) for (let x = 0; x < canvas.w; x++) {
            if (!canvas.px[y * canvas.w + x]) continue
            assert.ok(x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h, `${id}/${state} draws outside the frame at ${x},${y}`)
          }
        }
      }
    }
  }
  // The feet rest on the shared line (the lowest row of the body at rest, before the shadow).
  const feet = id => { const c = drawScene(id, animation('idle', { character: id }).frames[0].pose); let last = 0; for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const r = c.px[y * c.w + x]; if (r && r !== R.SHADOW) last = Math.max(last, y) } return last }
  for (const id of MASCOT_IDS) assert.ok(Math.abs(feet(id) - (STAND - 1)) <= 6, `${id} stands near the shared line (${feet(id)})`)
})

test('the band crops tight, so the pet fills the band: the picture is shown at a fixed height and is scaled up to it', () => {
  const stage = stageBounds()
  for (const id of MASCOT_IDS) {
    const box = bandBox(id)
    assert.ok(box.h <= stage.h && box.w <= stage.w && box.x >= 0 && box.y >= 0, `${id} is inside the frame`)
    const svg = petSvg({ character: id, state: 'idle', crop: 'band', height: 68, reduced: true })
    const h = Number(/viewBox="-?[0-9.]+ -?[0-9.]+ [0-9.]+ ([0-9.]+)"/.exec(svg)[1])
    assert.equal(h, box.h)
    assert.ok(Math.abs(Number(/height="([0-9.]+)"/.exec(svg)[1]) - 68) < 0.5, 'drawn 68 pixels tall whatever the character')
    assert.ok(68 / box.h >= 1.0, `${id} is drawn at least as big as the whole frame would be (${(68 / box.h).toFixed(2)})`)
  }
})

test('a pet saved by version 1 (the single "puff") is migrated to Alpha, keeping its identity and look', () => {
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
    assert.equal(pet.prefs.band, true)
    assert.equal(pet.prefs.line, true)
  } finally { done() }
})

test('the band preference is validated and survives a restore of the default appearance; a style left by the 3D days is dropped', () => {
  const { dir, done } = tempDir()
  try {
    const store = openStore(dir)
    store.writePet({ ...store.ensurePet(T0), prefs: { motion: 'auto', scope: 'session', line: false, band: false, style: '3d' } })
    assert.equal(store.ensurePet().prefs.band, false)
    assert.ok(!('style' in store.ensurePet().prefs), 'the old style preference is gone')
    store.writePet({ ...store.ensurePet(), character: 'fox' })
    const restored = store.resetAppearance()
    assert.equal(restored.character, 'classic')
    assert.equal(restored.createdAt, T0)
  } finally { done() }
})

test('the picture is pixel art with crisp edges and no 3D leftovers', () => {
  for (const id of MASCOT_IDS) {
    const svg = petSvg({ character: id, state: 'coding', scale: 2 })
    assert.ok(svg.includes('crispEdges') && !svg.includes('<filter') && !svg.includes('<use'), id)
  }
})

test('a picture drawn for the pointer hops under it; without the option it carries no hover style', () => {
  const plain = petSvg({ character: 'fox', state: 'idle', scale: 2 })
  const hover = petSvg({ character: 'fox', state: 'idle', scale: 2, hover: true })
  assert.ok(!plain.includes(':hover'))
  assert.ok(hover.includes('svg:hover .hv') && hover.includes('class="hv"'))
  assert.ok(!petSvg({ character: 'fox', state: 'idle', scale: 2, hover: true, reduced: true }).includes(':hover'), 'reduced motion keeps it still')
  assert.ok(hover.length < 131072)
})

test('every character idles in its own manner, and every idle loop is well formed', () => {
  const seen = new Set()
  for (const id of MASCOT_IDS) {
    const anim = animation('idle', { character: id })
    assert.ok(anim.frames.length >= 8, id + ' has a loop of its own')
    for (const item of anim.frames) assert.ok(item.d >= 70, id + ' never flickers')
    const signature = JSON.stringify(anim.frames.map(f => [f.d, f.pose.lookX, f.pose.dy, f.pose.sx, f.pose.sy, f.pose.eyes, f.pose.mouth, f.pose.led, f.pose.hands]))
    assert.ok(!seen.has(signature), id + ' differs from the others')
    seen.add(signature)
    assert.notEqual(anim, animation('idle'), 'not the shared loop')
  }
  assert.equal(animation('coding', { character: 'fox' }), animation('coding'), 'working states are shared by all')
})

test('motion is smooth: the pet moves by an eased CSS transform, the shadow stays on the ground, pictures stay small', () => {
  const idle = petSvg({ character: 'slime', state: 'idle', scale: 2 })
  assert.ok(idle.includes('class="mv"') && idle.includes('@keyframes mv') && idle.includes('ease-in-out'), 'the body is moved by an eased transform')
  const reaction = petSvg({ character: 'slime', state: 'petted', scale: 2 })
  assert.ok(reaction.includes('translate(0px,-5px)') || /translate\(0px,-[0-9.]+px\)/.test(reaction), 'a hop is a translation')
  assert.ok(reaction.length < 40_000, 'a reaction is small (' + reaction.length + ')')
  // The shadow is not part of what hops.
  assert.ok(reaction.indexOf('fill-opacity') >= 0 && reaction.indexOf('fill-opacity') < reaction.indexOf('class="mv"'), 'the shadow is drawn before, outside the moving group')
  assert.ok(!petSvg({ character: 'slime', state: 'petted', scale: 2, reduced: true }).includes('@keyframes'), 'reduced motion has no animation')
  for (const state of REACTIONS) {
    const frames = animation(state).frames
    const first = frames[0].pose; const last = frames.at(-1).pose
    assert.equal(first.eyes, 'open', state + ' starts from open eyes, so it grows out of the pose the pet was in')
    assert.equal(last.eyes, 'open', state + ' ends with open eyes, so it settles back')
    assert.equal(last.dy, 0)
  }
})

test('a new state arrives with a pop, reactions do not, and a title becomes a tooltip', () => {
  assert.ok(petSvg({ character: 'fox', state: 'coding' }).includes('class="en"') && petSvg({ character: 'fox', state: 'coding' }).includes('@keyframes en'))
  assert.ok(!petSvg({ character: 'fox', state: 'petted' }).includes('class="en"'), 'a reaction has its own motion')
  assert.ok(!petSvg({ character: 'fox', state: 'coding', reduced: true }).includes('class="en"'), 'reduced motion: no pop')
  const tip = petSvg({ character: 'fox', state: 'idle', title: 'Foxy: <Resting> & "ready"' })
  assert.ok(tip.includes('<title>Foxy: &lt;Resting&gt; &amp; &quot;ready&quot;</title>'), 'escaped')
  assert.ok(!petSvg({ character: 'fox', state: 'idle' }).includes('<title>'))
})

test('some characters have a part that moves on its own: a tail, an antenna, a star, a fin, a curl', () => {
  const withParts = ['fox', 'classic', 'bot', 'mage', 'aquatic']
  for (const id of MASCOT_IDS) {
    const svg = petSvg({ character: id, state: 'idle' })
    if (withParts.includes(id)) {
      assert.ok(svg.includes('class="pt pt0"') && svg.includes('@keyframes pt0'), id + ' has a part that swings')
      const [x0, y0, x1, y1] = partsOf(id)[0].rect
      assert.ok(x0 >= 0 && y0 >= 0 && x1 < W && y1 < H, id + ': the part is inside the scene')
    } else assert.ok(!svg.includes('class="pt'), id + ' has none')
  }
  assert.ok(!petSvg({ character: 'fox', state: 'idle', reduced: true }).includes('@keyframes pt0'), 'reduced motion: still')
  assert.ok(!petSvg({ character: 'fox', state: 'disconnected' }).includes('@keyframes pt0'), 'asleep: still')
  // It swings farther and faster when the pet is happy.
  assert.ok(petSvg({ character: 'fox', state: 'success' }).includes('animation-duration:0.45s'))
  assert.ok(petSvg({ character: 'fox', state: 'idle' }).includes('animation-duration:3.2s'))
  // Cutting the part out loses nothing: the same pixels are drawn, only in two groups.
  const whole = petSvg({ character: 'fox', state: 'idle', reduced: true })
  assert.ok(whole.includes('class="pt pt0"'), 'the part is its own group even when still')
})

test('the art is what it was: every character in every state matches its fingerprint (run scripts/art-hashes.mjs after a meant change)', () => {
  const expected = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'art-hashes.json'), 'utf8'))
  const now = artHashes()
  const changed = Object.keys({ ...expected, ...now }).filter(key => expected[key] !== now[key])
  assert.deepEqual(changed, [], 'these changed: ' + changed.slice(0, 12).join(', '))
})

test('working states move the body too, not only the object and the face', () => {
  for (const state of ['thinking', 'reading', 'searching', 'investigating', 'coding', 'running', 'git', 'mcp', 'testing', 'web', 'delegating', 'planning']) {
    const poses = animation(state).frames.map(f => f.pose)
    const moves = poses.some(p => p.dy || p.shake || p.sx !== 1 || p.sy !== 1)
    assert.ok(moves, state + ' has body movement')
    const spread = Math.max(...poses.map(p => Math.abs(p.dy ?? 0) + Math.abs(p.shake ?? 0) + Math.abs((p.sy ?? 1) - 1) * 10))
    assert.ok(spread <= 3, state + ' stays subtle (' + spread.toFixed(2) + ')')
  }
})

test('every character waits for you in its own way, and always with a happy face', () => {
  const seen = new Set()
  for (const id of MASCOT_IDS) {
    const anim = animation('waiting', { character: id })
    assert.notEqual(anim, animation('waiting'), id + ' has its own waiting loop')
    for (const { pose, d } of anim.frames) {
      assert.ok(d >= 70)
      assert.ok(['smile', 'grin'].includes(pose.mouth) && ['open', 'blink', 'happy'].includes(pose.eyes) && pose.brows === 'none', id + ' waits happily')
      assert.ok(!pose.fx.some(item => item.id === 'dots'))
    }
    seen.add(JSON.stringify(anim.frames.map(f => [f.d, f.pose.dy, f.pose.lookX, f.pose.sx, f.pose.sy, f.pose.hands, f.pose.led])))
  }
  assert.equal(seen.size, MASCOT_IDS.length, 'all different')
})

test('the ! badge of an error or a question stays put (it does not blink), and the pet sways only a little to the sides', () => {
  for (const [state, id] of [['error', 'alert'], ['permission', 'excl']]) {
    const frames = animation(state).frames
    assert.ok(frames.every(f => f.pose.fx.some(item => item.id === id)), state + ': the badge is on in every frame')
    assert.equal(new Set(frames.map(f => f.pose.fx.find(item => item.id === id).f)).size, 1, state + ': and it never changes')
  }
  const LIMIT = { error: 0.6, giggle: 0.45 }
  for (const state of ['thinking', 'reading', 'searching', 'investigating', 'coding', 'running', 'git', 'mcp', 'testing', 'web', 'delegating', 'planning', 'idle', 'waiting', 'error', 'giggle']) {
    for (const id of MASCOT_IDS) {
      for (const { pose } of animation(state, { character: id }).frames) assert.ok(Math.abs(pose.shake ?? 0) <= (LIMIT[state] ?? 0.35), `${id}/${state} shakes ${pose.shake}`)
    }
  }
  for (const id of ['fox', 'classic', 'bot', 'mage', 'aquatic']) assert.ok(partsOf(id)[0].swing <= 5, id + "'s part swings gently")
})

test('the task ring keeps a margin all round, so its edge is never cut off', async () => {
  const { ringSvg } = await import('../src/core/render/pie.js')
  for (const size of [40, 58, 76]) {
    const svg = ringSvg({ ok: 891, failed: 39, size })
    const r = Number(/<circle[^>]*r="([0-9.]+)"/.exec(svg)[1])
    const stroke = Number(/stroke-width="([0-9.]+)"/.exec(svg)[1])
    assert.ok(r + stroke / 2 <= size / 2 - 1.5, `${size}: the outer edge (${r + stroke / 2}) is inside the picture (${size / 2})`)
  }
})

test('motion has three levels: full sways about twice as far as calm, and still does not move at all', async () => {
  const { sanitizePet, defaultPet, MOTIONS } = await import('../src/core/settings.js')
  const reach = svg => Math.max(...[...svg.matchAll(/translate\((-?[0-9.]+)px/g)].map(match => Math.abs(Number(match[1]))))
  const calm = petSvg({ character: 'fox', state: 'running', motion: 'calm' })
  const full = petSvg({ character: 'fox', state: 'running', motion: 'full' })
  assert.ok(reach(full) > reach(calm) * 1.5, `full ${reach(full)} against calm ${reach(calm)}`)
  assert.equal(petSvg({ character: 'fox', state: 'running' }), calm, 'calm is the default')
  assert.ok(!petSvg({ character: 'fox', state: 'running', motion: 'full', reduced: true }).includes('@keyframes'), 'still is still, whatever the level')
  assert.deepEqual([...MOTIONS], ['full', 'calm', 'reduced'])
  assert.equal(defaultPet(T0).prefs.motion, 'calm')
  assert.equal(sanitizePet({ ...defaultPet(T0), prefs: { motion: 'auto' } }, T0).pet.prefs.motion, 'calm', 'the old default, "auto", is calm')
  assert.equal(sanitizePet({ ...defaultPet(T0), prefs: { motion: 'full' } }, T0).pet.prefs.motion, 'full')
})

test("Foxy's errors float a 404 over its head (only Foxy's), steady apart from a slow drift, with the ! badge still there", () => {
  const frames = animation('error', { character: 'fox' }).frames
  assert.ok(frames.every(f => f.pose.fx.some(item => item.id === 'e404')), '404 in every frame')
  assert.ok(frames.every(f => f.pose.fx.some(item => item.id === 'alert')), 'and the ! with it')
  assert.ok(frames.every(f => f.d >= 70))
  assert.equal(frames.reduce((sum, f) => sum + f.d, 0), animation('error').frames.reduce((sum, f) => sum + f.d, 0), 'the same length as every other error')
  for (const id of MASCOT_IDS.filter(name => name !== 'fox')) assert.ok(!animation('error', { character: id }).frames.some(f => f.pose.fx.some(item => item.id === 'e404')), id + ' has no 404')
  // It is really drawn, above the head and inside the frame, and the band's tight crop keeps it.
  const withIt = drawScene('fox', frames.at(-1).pose)
  const without = drawScene('fox', animation('error').frames.at(-1).pose)
  let extra = 0
  for (let i = 0; i < withIt.px.length; i++) if (withIt.px[i] !== without.px[i]) extra++
  assert.ok(extra > 60, 'the 404 adds pixels (' + extra + ')')
  const band = bandBox('fox')
  const top = (() => { for (let y = 0; y < withIt.h; y++) for (let x = 0; x < withIt.w; x++) if (withIt.px[y * withIt.w + x] && withIt.px[y * withIt.w + x] !== R.SHADOW) return y })()
  assert.ok(band.y <= top, `the band crop starts at ${band.y}, the 404 at ${top}`)
})
