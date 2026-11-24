// Props and effects at full resolution, drawn from shaded shapes, lines and discs so they carry the same level of detail
// as the characters: an open book with golden code, a laptop with a glowing </>, a flask with bubbles, a magnifier, and
// the speech bubbles and badges that mark thinking, waiting, failure and "needs you".

import { Canvas, K, R } from './canvas.js'
import { PI, arc, disc, line } from './draw.js'
import { BROWN, ell, paint, poly, rrect } from './shapes.js'

export const HI_PROPS = new Set(['book', 'laptop', 'shell', 'flask', 'magnifier', 'branch', 'plug'])
export const HI_FX = new Set(['excl', 'alert', 'rays', 'thought', 'spinner', 'glyphs'])

const flatRamp = (edge, fill) => [edge, fill, fill, fill, fill]
const PAGE = flatRamp(R.PAPER2, R.PAPER)
const stamp = (c, shapes) => { const t = new Canvas(); paint(t, shapes, null); c.stamp(t) }
const P = v => v * K

/** `</>` drawn with lines, centred at (cx, cy) in design units; `s` scales it. */
function code(c, cx, cy, s, role, thick = K * 0.5) {
  line(c, P(cx - 1.3 * s), P(cy - 0.9 * s), P(cx - 2.3 * s), P(cy), role, thick); line(c, P(cx - 2.3 * s), P(cy), P(cx - 1.3 * s), P(cy + 0.9 * s), role, thick)
  line(c, P(cx + 0.5 * s), P(cy - 1.1 * s), P(cx - 0.5 * s), P(cy + 1.1 * s), role, thick)
  line(c, P(cx + 1.3 * s), P(cy - 0.9 * s), P(cx + 2.3 * s), P(cy), role, thick); line(c, P(cx + 2.3 * s), P(cy), P(cx + 1.3 * s), P(cy + 0.9 * s), role, thick)
}

function book(c, a, f) {
  const x = a.cx
  const y = a.bottom - 0.2
  stamp(c, [
    rrect(x - 6.8, y - 5.8, 13.6, 6, 0.9, [R.BROWN2, R.BROWN, R.BROWN, R.BROWN, R.BROWN], { flat: true }),
    rrect(x - 6.1, y - 5.3, 5.9, 5, 0.6, PAGE, { flat: true }),
    rrect(x + 0.2, y - 5.3, 5.9, 5, 0.6, PAGE, { flat: true }),
  ])
  c.rect(P(x - 0.2), P(y - 5.3), P(0.4), P(5), R.PAPER2)
  if (f % 4 === 1) stamp(c, [poly([[x + 3.8, y - 5.3], [x + 6.1, y - 5.3], [x + 6.1, y - 3.2]], flatRamp(R.PAPER2, R.PAPER2), { flat: true })])
  if (f % 4 === 2) stamp(c, [rrect(x + 0.4, y - 6.6, 2.2, 6.4, 0.4, PAGE, { flat: true })])
  code(c, x - 3.1, y - 2.8, 0.85, R.GOLD)
  if (f % 4 !== 2) code(c, x + 3.1, y - 2.8, 0.85, R.GOLD)
  for (const dy of [-4.3, -1.5]) { c.rect(P(x - 5.1), P(y + dy), P(3.9), K * 0.5, R.PAPER2); c.rect(P(x + 1.1), P(y + dy), P(3.6), K * 0.5, R.PAPER2) }
}

function laptop(c, a, f, kind) {
  const x = a.cx
  const y = a.bottom
  stamp(c, [
    rrect(x - 6.6, y - 7.4, 13.2, 6.6, 1, [R.METAL2, R.NAVY2, R.NAVY2, R.NAVY2, R.NAVY2], { flat: true }),
    rrect(x - 7.8, y - 1, 15.6, 1.9, 0.7, [R.METAL3, R.METAL, R.METAL, R.METAL, R.METAL], { flat: true }),
  ])
  if (kind === 'shell') {
    line(c, P(x - 4.8), P(y - 5.6), P(x - 3.6), P(y - 4.7), R.GRN); line(c, P(x - 3.6), P(y - 4.7), P(x - 4.8), P(y - 3.8), R.GRN)
    c.rect(P(x - 2.6), P(y - 3.8), P(1.6 + (f % 2)), K * 0.5, R.GRN)
    for (const [i, len] of [[0, 5], [1, 3.4], [2, 4.4]]) c.rect(P(x - 4.8), P(y - 3 + i * 0.8 - (i ? 0 : 0.2)), P(len + (f % 3 === i ? 1.2 : 0)), K * 0.4, R.GLOW)
  } else {
    code(c, x, y - 5, 1.4, R.CYAN, K * 0.6)
    for (const [i, len] of [[0, 4.2], [1, 6.6], [2, 3.6]]) c.rect(P(x - 5.2), P(y - 3.2 + i * 0.85), P(len + (f % 4) * 0.5 * (i === 1 ? 1 : 0)), K * 0.45, i === 1 ? R.GLOW2 : R.CYAN2)
  }
}

function flask(c, a, f, character) {
  const x = Math.min(a.cx + 10, 32.5)
  const y = a.bottom
  stamp(c, [
    poly([[x - 1.1, y - 9.2], [x + 1.1, y - 9.2], [x + 1.3, y - 6.4], [x + 3.9, y - 0.3], [x - 3.9, y - 0.3], [x - 1.3, y - 6.4]], [R.METAL2, R.GLASS, R.GLASS, R.GLASS, R.GLASS], { flat: true }),
    poly([[x - 3.2, y - 3.4], [x + 3.2, y - 3.4], [x + 3.8, y - 0.8], [x - 3.8, y - 0.8]], flatRamp(R.LIQ2, R.LIQ), { flat: true, noEdge: true }),
    rrect(x - 1.5, y - 10, 3, 0.9, 0.3, flatRamp(R.METAL3, R.METAL), { flat: true }),
  ])
  disc(c, P(x - 1.4), P(y - 4.2), K * 0.55, K * 0.4, R.WHITE)
  for (const [i, bx] of [[0, -1.6], [1, 0.9], [2, -0.2]]) { const rise = ((f + i * 2) % 6) / 6; disc(c, P(x + bx), P(y - 1.4 - rise * 6.4), K * 0.4, K * 0.4, R.GLASS) }
  // Testing goggles on the pet (the fox already wears its own, the bot has a screen and the mage a hat).
  if (!['fox', 'bot', 'mage'].includes(character)) {
    const gy = a.faceY - 4.4
    line(c, P(a.cx - 8.6), P(gy + 0.2), P(a.cx + 8.6), P(gy + 0.2), R.BROWN2, K * 0.9)
    for (const side of [-1, 1]) {
      disc(c, P(a.cx + side * 3.5), P(gy), K * 2.7, K * 2.4, R.NAVY2)
      disc(c, P(a.cx + side * 3.5), P(gy), K * 2.1, K * 1.85, R.TEAL)
      disc(c, P(a.cx + side * 3.5 - 0.7), P(gy - 0.7), K * 0.6, K * 0.45, R.WHITE)
    }
  }
}

function magnifier(c, a, f) {
  const sweep = [0, 2, 4, 2][f % 4]
  const x = a.cx + 6 + sweep
  const y = a.bottom - 4.4
  line(c, P(x + 2.2), P(y + 2.2), P(x + 5.4), P(y + 5.4), R.METAL3, K * 1.4)
  disc(c, P(x), P(y), K * 3.5, K * 3.5, R.METAL2)
  disc(c, P(x), P(y), K * 2.8, K * 2.8, R.GLASS)
  disc(c, P(x - 1), P(y - 1), K * 0.8, K * 0.6, R.WHITE)
}

/** A speech bubble with a tail, at the top right of the pet. */
function bubble(c, a, ramp) {
  const x = Math.min(a.cx + 6.5, 36 - 10.4)
  const y = Math.max(0.6, a.top - 3)
  stamp(c, [rrect(x, y, 9.4, 5.8, 2.2, ramp, { flat: true }), poly([[x + 1.6, y + 5.2], [x + 3.8, y + 5.2], [x + 0.6, y + 7.4]], ramp, { flat: true })])
  return { x, y }
}

function badge(c, a, fill, glyph, f) {
  const x = Math.min(a.cx + 10, 36 - 4)
  const y = Math.max(3.6, a.top) + (f % 2) * 0.4
  disc(c, P(x), P(y), K * 3.3, K * 3.3, R.WHITE)
  disc(c, P(x), P(y), K * 2.8, K * 2.8, fill)
  line(c, P(x), P(y - 1.5), P(x), P(y + 0.5), glyph, K * 0.9)
  disc(c, P(x), P(y + 1.6), K * 0.55, K * 0.55, glyph)
}

function rays(c, a, f) {
  const x = a.cx + 10
  const y = a.top + 3
  const grow = 0.6 + 0.4 * Math.sin(f * 0.9)
  for (const [dx, dy] of [[-1.4, -2.6], [0.2, -3.2], [1.9, -2.5]]) line(c, P(x + dx * 0.5), P(y + dy * 0.5), P(x + dx * (0.8 + grow)), P(y + dy * (0.8 + grow)), R.GOLD, K * 0.7)
}


/** A commit graph on a small screen: a main line, a branch that splits off and rejoins, and a node that lights up in turn. */
function branch(c, a, f) {
  const x = a.cx
  const y = a.bottom
  stamp(c, [
    rrect(x - 6.6, y - 7.4, 13.2, 6.6, 1, [R.METAL2, R.NAVY2, R.NAVY2, R.NAVY2, R.NAVY2], { flat: true }),
    rrect(x - 7.8, y - 1, 15.6, 1.9, 0.7, [R.METAL3, R.METAL, R.METAL, R.METAL, R.METAL], { flat: true }),
  ])
  const main = y - 2.6
  const high = y - 5.4
  line(c, P(x - 5), P(main), P(x + 5), P(main), R.GLOW2, K * 0.6)
  line(c, P(x - 1.6), P(main), P(x + 0.2), P(high), R.GRN, K * 0.6)
  line(c, P(x + 0.2), P(high), P(x + 3), P(high), R.GRN, K * 0.6)
  line(c, P(x + 3), P(high), P(x + 4.6), P(main), R.GRN, K * 0.6)
  const nodes = [[x - 4.6, main], [x - 1.6, main], [x + 1.6, high], [x + 4.6, main]]
  nodes.forEach(([nx, ny], i) => {
    disc(c, P(nx), P(ny), K * 1.05, K * 1.05, R.NAVY2)
    disc(c, P(nx), P(ny), K * 0.8, K * 0.8, i === f % 4 ? R.WHITE : i === 2 ? R.GRN : R.GLOW2)
  })
}

/** A plug that slides into a socket and sparks when it connects. */
function plug(c, a, f) {
  const x = a.cx
  const y = a.bottom
  const reach = [0, 1.1, 2.2, 3.2][f % 4]
  stamp(c, [rrect(x + 0.8, y - 5.6, 5.8, 4.6, 0.9, [R.METAL3, R.METAL2, R.METAL2, R.METAL2, R.METAL2], { flat: true })])
  for (const dy of [-4.6, -2.6]) c.rect(P(x + 1.6), P(y + dy), P(1.8), P(0.8), R.NAVY2)
  const px = x - 7.6 + reach
  line(c, P(px - 4), P(y - 3.3), P(px), P(y - 3.3), R.METAL3, K * 0.9)
  stamp(c, [rrect(px, y - 5.6, 4.4, 4.6, 0.9, [R.GOLD2, R.GOLD, R.GOLD, R.GOLD, R.GOLD], { flat: true })])
  for (const dy of [-4.6, -2.6]) line(c, P(px + 4.4), P(y + dy + 0.4), P(px + 5.6), P(y + dy + 0.4), R.METAL, K * 0.6)
  if (f % 4 === 3) {
    for (const [dx, dy] of [[-1, -2.2], [0.4, -2.8], [1.8, -2.2]]) line(c, P(x + 0.8), P(y - 6), P(x + 0.8 + dx * 1.4), P(y - 7.2 + dy), R.YEL, K * 0.5)
  }
}

/** A thought cloud with a light bulb and a turning gear, at the top right of the pet. */
function thought(c, a, f) {
  const x = Math.min(a.cx + 6.5, 36 - 10.4)
  const y = Math.max(0.6, a.top - 3.5)
  disc(c, P(x + 4.7), P(y + 3), P(4.8), P(3.2), R.BLU)
  disc(c, P(x + 4.7), P(y + 3), P(4.4), P(2.8), R.WHITE)
  disc(c, P(x + 0.8), P(y + 7.2), K * 0.75, K * 0.75, R.BLU)
  disc(c, P(x + 0.8), P(y + 7.2), K * 0.55, K * 0.55, R.WHITE)
  disc(c, P(x - 0.6), P(y + 8.6), K * 0.5, K * 0.5, R.BLU)
  const cx = x + 4.7
  const cy = y + 3
  if (f % 2 === 0) {
    disc(c, P(cx), P(cy - 0.3), K * 1.5, K * 1.5, R.GOLD)
    disc(c, P(cx - 0.5), P(cy - 0.9), K * 0.45, K * 0.45, R.WHITE)
    c.rect(P(cx - 0.7), P(cy + 1.2), P(1.4), P(0.7), R.METAL2)
    if (f % 4 === 0) for (const dx of [-2.3, 0, 2.3]) line(c, P(cx + dx * 0.9), P(cy - 2.1), P(cx + dx * 1.15), P(cy - 2.7), R.GOLD, K * 0.4)
  } else {
    const turn = (f >> 1) * 0.4
    for (let i = 0; i < 4; i++) { const t = turn + (i * PI) / 2; line(c, P(cx), P(cy), P(cx + Math.cos(t) * 2.2), P(cy + Math.sin(t) * 2.2), R.METAL2, K * 0.9) }
    disc(c, P(cx), P(cy), K * 1.4, K * 1.4, R.METAL2)
    disc(c, P(cx), P(cy), K * 0.6, K * 0.6, R.WHITE)
  }
}

/** Eight dots in a ring with a bright head that runs around it. */
function spinner(c, a, f) {
  const x = Math.min(a.cx + 11, 36 - 4)
  const y = Math.max(4.2, a.top + 1.2)
  for (let i = 0; i < 8; i++) {
    const t = (i * PI) / 4 - PI / 2
    const age = (f - i + 8) % 8
    const r = K * (age === 0 ? 0.6 : 0.45)
    disc(c, P(x + Math.cos(t) * 2.4), P(y + Math.sin(t) * 2.4), r, r, age === 0 ? R.WHITE : age < 3 ? R.CYAN : age < 5 ? R.CYAN2 : R.METAL3)
  }
}

/** Little code symbols that float up from the pet while it types. */
function glyphs(c, a, f) {
  for (let k = 0; k < 3; k++) {
    const rise = (f + k * 2) % 6
    const gx = a.cx - 4.5 + k * 4.5
    const gy = a.top - 0.2 - rise * 0.55
    const role = rise > 4 ? R.CYAN2 : R.CYAN
    if (k === 0) { line(c, P(gx + 0.7), P(gy - 0.8), P(gx - 0.3), P(gy), role, K * 0.45); line(c, P(gx - 0.3), P(gy), P(gx + 0.7), P(gy + 0.8), role, K * 0.45) }
    if (k === 1) line(c, P(gx + 0.5), P(gy - 1), P(gx - 0.5), P(gy + 1), role, K * 0.45)
    if (k === 2) { line(c, P(gx - 0.7), P(gy - 0.8), P(gx + 0.3), P(gy), role, K * 0.45); line(c, P(gx + 0.3), P(gy), P(gx - 0.7), P(gy + 0.8), role, K * 0.45) }
  }
}

export function drawHiProp(c, a, prop, character) {
  const f = prop.f ?? 0
  switch (prop.id) {
    case 'book': return book(c, a, f)
    case 'laptop': return laptop(c, a, f, 'code')
    case 'shell': return laptop(c, a, f, 'shell')
    case 'flask': return flask(c, a, f, character)
    case 'magnifier': return magnifier(c, a, f)
    case 'branch': return branch(c, a, f)
    case 'plug': return plug(c, a, f)
    default:
  }
}

export function drawHiFx(c, a, item) {
  const f = item.f ?? 0
  switch (item.id) {
    case 'excl': return badge(c, a, R.YEL, R.NAVY2, f)
    case 'alert': return badge(c, a, R.RED, R.WHITE, f)
    case 'rays': return rays(c, a, f)
    case 'thought': return thought(c, a, f)
    case 'spinner': return spinner(c, a, f)
    case 'glyphs': return glyphs(c, a, f)
    default:
  }
}
