// Composes one frame: ground shadow, the character, what it is holding, its hands, helpers and effects.
// `pose` describes the frame; nothing here knows about agents or events.

import { Canvas, K, R } from './canvas.js'
import { disc } from './draw.js'

// Props, helpers and effects are icon-like and are drawn on the 36x28 design grid, then enlarged to the scene's pixels.
const W = 36
const H = 36
import { HI_FX, HI_PROPS, drawHiFx, drawHiProp } from './props.js'
import { mascot } from './registry.js'

const M = { '.': undefined, ' ': undefined }
const map = extra => ({ ...M, ...extra })

// ---- props ---------------------------------------------------------------------------------------------
const CODE = [
  ['GGG.GG..', '..GGGG.G'],
  ['GGG.GGGG', '..GGGG..'],
  ['GG..GGG.', 'GGG.G..G'],
  ['GGGGG.GG', '..G.GGG.'],
]
const SHELL = [
  ['G.GGG...', 'G.......'],
  ['G.GGG...', 'G.GG.GG.'],
  ['G.GGG...', 'G.GG.GG.'],
  ['G.GGGGG.', 'G_......'],
]

function laptop(c, a, f, kind) {
  const x = a.cx - 6
  const y = a.bottom - 4
  const lines = (kind === 'shell' ? SHELL : CODE)[f % 4]
  const glow = kind === 'shell' ? R.GRN : R.GLOW2
  // '.' in a line is dark screen, 'g' is glow.
  const line = text => text.replaceAll('_', 'g').replaceAll('G', 'g').replaceAll('.', 's')
  const rows = [
    '.MMMMMMMMMM.',
    'Ms' + line(lines[0]) + 'sM',
    'Ms' + line(lines[1]) + 'sM',
    'MMMMMMMMMMMM',
    'NNNNNNNNNNNN',
  ]
  c.patch(x, y, rows, map({ M: R.METAL, s: R.SCREEN, g: glow, N: R.METAL2 }))
}

const BOOK = [
  ['PPPPPCCPPPPP', 'PQQQPCCPQQQP', 'PPPPPCCPPPPP', 'PQQPPCCPPQQP', 'VVVVVVVVVVVV'],
  ['PPPPPCCPPPPP', 'PQQQPCCPQQPP', 'PPPPPCCPPPPP', 'PQQPPCCPPQQP', 'VVVVVVVVVVVV'],
  ['PPPPPCCWWPPP', 'PQQQPCCWWQQP', 'PPPPPCCWWPPP', 'PQQPPCCWWQQP', 'VVVVVVVVVVVV'],
  ['PPPPPCCPPPPP', 'PQQQPCCQQQQP', 'PPPPPCCPPPPP', 'PQPPPCCPQQPP', 'VVVVVVVVVVVV'],
]
function book(c, a, f) {
  c.patch(a.cx - 6, a.bottom - 3, BOOK[f % 4], map({ P: R.PAPER, Q: R.PAPER2, C: R.COVER2, V: R.COVER, W: R.WHITE }))
}

const FLASK = ['..MMMM..', '..M..M..', '..M..M..', '.M....M.', 'M.LLLL.M', 'MLLLLLLM', 'MLLLLLLM', 'MLQQQQLM', 'MMMMMMMM']
const BUBBLES = [[[3, 6], [5, 7]], [[4, 5], [2, 6]], [[3, 4], [5, 5]], [[4, 3], [3, 5]], [[3, 2], [4, 4]], [[4, 1], [3, 3]]]
function flask(c, a, f) {
  const x = Math.min(a.cx + 9, W - 8)
  const y = a.bottom - 8
  c.patch(x, y, FLASK, map({ M: R.METAL, L: R.LIQ, Q: R.LIQ2 }))
  for (const [bx, by] of BUBBLES[f % BUBBLES.length]) {
    const role = c.get(x + bx, y + by)
    if (role === R.LIQ || role === 0) c.set(x + bx, y + by, role === R.LIQ ? R.GLASS : R.WHITE)
  }
}

function magnifier(c, a, f) {
  const sweep = [0, 2, 4, 2][f % 4]
  const x = a.cx + 3 + sweep
  const y = a.bottom - 8
  c.patch(x, y, ['.MMMM.', 'MGGGGM', 'MGWGGM', 'MGGGGM', 'MGGGGM', '.MMMM.'], map({ M: R.METAL2, G: R.GLASS, W: R.WHITE }))
  c.patch(x + 5, y + 5, ['H.', '.H', '..'], map({ H: R.METAL3 }))
  c.set(x + 6, y + 6, R.METAL3); c.set(x + 7, y + 7, R.METAL3)
}

function globe(c, a, f) {
  const x = Math.min(a.cx + 9, W - 9)
  const y = a.bottom - 9
  for (let j = 0; j < 7; j++) {
    for (let i = 0; i < 7; i++) {
      const d = (i - 3) ** 2 + (j - 3) ** 2
      if (d > 11) continue
      const edge = d > 7.5
      const land = (((i + f * 2) * 7 + j * 13) % 5) < 2
      c.set(x + i, y + j, edge ? R.METAL2 : land ? R.GRN : R.BLU)
    }
  }
  c.rect(x + 2, y + 7, 3, 1, R.METAL2)
  c.rect(x + 1, y + 8, 5, 1, R.METAL3)
}

function clipboard(c, a, f) {
  const x = Math.min(a.cx + 9, W - 8)
  const y = a.bottom - 9
  c.patch(x, y, ['..MMMM..', 'DDDDDDDD', 'DPPPPPPD', 'DPGPQQPD', 'DPPPPPPD', 'DPGPQQPD', 'DPPPPPPD', 'DPXPQQPD', 'DPPPPPPD', 'DDDDDDDD'], map({ M: R.METAL, D: R.COVER2, P: R.PAPER, Q: R.PAPER2, G: R.GRN, X: f % 4 >= 2 ? R.GRN : R.PAPER2 }))
}

function drawProp(c, a, prop) {
  const f = prop.f ?? 0
  switch (prop.id) {
    case 'laptop': return laptop(c, a, f, 'code')
    case 'shell': return laptop(c, a, f, 'shell')
    case 'book': return book(c, a, f)
    case 'flask': return flask(c, a, f)
    case 'magnifier': return magnifier(c, a, f)
    case 'globe': return globe(c, a, f)
    case 'clipboard': return clipboard(c, a, f)
    default:
  }
}

// ---- effects -------------------------------------------------------------------------------------------
const BUBBLE_DOT = ['.M.', 'MWM', '.M.']
function dots(c, a, n) {
  const spots = [[a.cx + 8, a.top + 1, 1], [a.cx + 11, a.top - 2, 2], [a.cx + 14, a.top - 6, 3]]
  for (let i = 0; i < Math.min(n, 3); i++) {
    const [x, y, size] = spots[i]
    if (size === 1) { c.set(x, y, R.METAL2); c.set(x + 1, y, R.METAL2) }
    else if (size === 2) c.patch(x, y, ['.MM.', 'MWWM', 'MWWM', '.MM.'], map({ M: R.METAL2, W: R.WHITE }))
    else c.patch(x, y, ['..MMMM..', '.MWWWWM.', 'MWMWMWWM', '.MWWWWM.', '..MMMM..'], map({ M: R.METAL2, W: R.WHITE }))
  }
}

const GLYPH = {
  excl: ['.RRR.', '.RRR.', '..R..', '..R..', '..R..', '.....', '..R..'],
  quest: ['.BBB.', 'B...B', '....B', '..BB.', '..B..', '.....', '..B..'],
}
function symbol(c, a, kind, f) {
  const x = Math.min(a.cx + 9, W - 9)
  const y = 1 + (f % 2)
  c.patch(x, y, ['.OOOOOOO.', 'OWWWWWWWO', 'OWWWWWWWO', 'OWWWWWWWO', 'OWWWWWWWO', 'OWWWWWWWO', 'OWWWWWWWO', 'OWWWWWWWO', '.OOOWOOO.', '....OO...'], map({ O: R.METAL2, W: R.WHITE }))
  c.patch(x + 2, y + 1, GLYPH[kind], map({ R: R.RED, B: R.BLU }))
}

function sparkle(c, x, y, size) {
  if (size <= 0) return
  if (size === 1) c.set(x, y, R.YEL)
  else if (size === 2) { c.set(x, y, R.YEL); c.set(x - 1, y, R.YEL); c.set(x + 1, y, R.YEL); c.set(x, y - 1, R.YEL); c.set(x, y + 1, R.YEL) }
  else { c.set(x, y, R.WHITE); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.set(x + dx, y + dy, R.YEL); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) c.set(x + dx, y + dy, R.ALIGHT) }
}

const CONFETTI = [R.RED, R.YEL, R.GRN, R.BLU, R.PINK]
function fx(c, a, item) {
  const f = item.f ?? 0
  switch (item.id) {
    case 'dots': return dots(c, a, item.n ?? 1)
    case 'excl': return symbol(c, a, 'excl', f)
    case 'quest': return symbol(c, a, 'quest', f)
    case 'sweat': c.patch(a.cx + 8, a.faceY - 3 + (f % 3), ['.B.', 'BBB', 'BWB', '.B.'], map({ B: R.BLU, W: R.WHITE })); return
    case 'sparkles': {
      const spots = [[a.cx - 12, a.top + 3], [a.cx + 12, a.top + 6], [a.cx + 9, a.top - 1], [a.cx - 10, a.bottom - 9]]
      spots.forEach(([x, y], i) => sparkle(c, x, y, [0, 1, 2, 3, 2, 1][(f + i * 2) % 6]))
      return
    }
    case 'confetti': {
      for (let i = 0; i < 14; i++) {
        const x = (i * 11 + 3) % 32 + 2
        const y = ((i * 5) % 9 + f * 3 + (i % 3)) % 24
        c.set(x, y, CONFETTI[i % CONFETTI.length])
        if (i % 3 === 0) c.set(x + 1, y, CONFETTI[(i + 2) % CONFETTI.length])
      }
      return
    }
    case 'zzz': {
      const n = (f % 4) + 0
      const z = (x, y, big) => c.patch(x, y, big ? ['ZZZZ', '..Z.', '.Z..', 'ZZZZ'] : ['ZZZ', '.Z.', 'ZZZ'], map({ Z: R.BLU }))
      if (n >= 1) z(a.cx + 8, a.top + 2, false)
      if (n >= 2) z(a.cx + 12, a.top - 3, true)
      return
    }
    case 'heart': {
      const y = a.top - 1 - Math.min(f, 6)
      c.patch(a.cx + 7, y, ['.R.R.', 'RRRRR', '.RRR.', '..R..'], map({ R: R.RED }))
      c.set(a.cx + 8, y + 1, R.PINK)
      return
    }
    default:
  }
}

const MINI = ['.OOOO.', 'OLBBBO', 'OBIBIO', 'OBBBBO', '.OOOO.']
function helpers(c, a, count, f) {
  const spots = [[1, a.bottom - 4], [W - 7, a.bottom - 4], [W - 8, a.bottom - 11]]
  for (let i = 0; i < Math.min(count, 3); i++) {
    const [x, y] = spots[i]
    c.patch(x, y - (((f + i) % 2) === 0 ? 0 : 1), MINI, map({ O: R.OUT, L: R.LIGHT, B: R.BASE, I: R.INK }))
  }
}

/** Stamps a design-grid layer onto the scene, K x K pixels per cell. */
function enlarge(scene, layer) {
  for (let y = 0; y < layer.h; y++) for (let x = 0; x < layer.w; x++) { const role = layer.px[y * layer.w + x]; if (role) scene.rect(x * K, y * K, K, K, role) }
}

// Only these characters cast a shadow on the ground; the others stand on nothing.
export const SHADOWED = new Set(['slime', 'mage', 'aquatic'])

/**
 * Draws one frame to a fresh canvas.
 * @param {string} character
 * @param {object} pose
 * @param {'all' | 'under' | 'over'} [layer] 'under' is what stays on the ground (the shadow, the helpers), 'over' is the pet
 *   itself with what it holds and its effects; the SVG moves 'over' with a CSS transform so motion is smooth
 */
export function drawScene(character, pose, layer = 'all') {
  const who = mascot(character)
  const lift = Math.max(0, -(pose.dy ?? 0))
  const shadowW = Math.max(3, 8.5 - lift / 2)

  const shadow = new Canvas()
  const under = layer !== 'over'
  const over = layer !== 'under'
  if (under && SHADOWED.has(character)) {
    const shadowY = who.shadow ?? 25.5
    disc(shadow, 18 * K, shadowY * K, shadowW * K, 0.9 * K, R.SHADOW)
    disc(shadow, 18 * K, (shadowY + 0.1) * K, (shadowW - 2) * K, 1.25 * K, R.SHADOW)
  }

  const ground = new Canvas()
  if (under && pose.helpers) { const lo = new Canvas(W, H); helpers(lo, { bottom: who.ground }, pose.helpers, pose.f ?? 0); enlarge(ground, lo) }
  if (!over) { shadow.stamp(ground); return standOnLine(shadow, Math.round(who.ground * K)) }
  const body = new Canvas()
  const a = who.draw(body, pose)

  // What it holds, its hands, and the effects around it: drawn over the body.
  const held = new Canvas()
  if (pose.prop) {
    if (HI_PROPS.has(pose.prop.id)) {
      const centred = ['laptop', 'shell', 'book', 'branch', 'plug'].includes(pose.prop.id) && a.propCx !== undefined
      drawHiProp(held, centred ? { ...a, cx: a.propCx, bottom: a.propBottom } : a, pose.prop, character)
    } else { const lo = new Canvas(W, H); drawProp(lo, a, pose.prop); enlarge(held, lo) }
  }
  const hands = new Canvas()
  a.hands.forEach((hand, i) => who.limb(hands, a, i, hand))
  const effects = new Canvas()
  if (pose.fx?.length) {
    const lo = new Canvas(W, H)
    for (const item of pose.fx) if (!HI_FX.has(item.id)) fx(lo, a, item)
    enlarge(effects, lo)
    for (const item of pose.fx) if (HI_FX.has(item.id)) drawHiFx(effects, a, item)
  }

  shadow.stamp(ground); shadow.stamp(body); shadow.stamp(held); shadow.stamp(hands); shadow.stamp(effects)
  // Every character is moved onto the shared line.
  return standOnLine(shadow, Math.round(who.ground * K))
}

/** Every character stands on the same line, so the pictures of different characters line up and share one frame. */
export const STAND = 60

function standOnLine(c, feet) {
  const down = STAND - feet
  if (down <= 0) return c
  const moved = new Canvas(c.w, c.h)
  moved.px.set(c.px.subarray(0, c.px.length - down * c.w), down * c.w)
  return moved
}
