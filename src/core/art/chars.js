// The seven Puffs. Each is a few shaded shapes plus hand-placed details and a face, described as data and drawn by
// `define`. They are original drawings (a pixel-art interpretation of the character sheets the project was given).
// Colors are roles, so a user's body and accent colors recolor them without losing their shading.

import { K, R } from './canvas.js'
import { disc } from './draw.js'
import { ACC, BODY, BROWN, CREAM, CYAN, GOLD, NAVY, TEAL, cachedBody, ell, flat, paint, poly, rrect, transform } from './shapes.js'
import { drawFace } from './faces.js'

const round = Math.round

/** Hand positions (top-left of a 4x3 mitten) for each hand pose, relative to the body. */
function handsFor(kind, { cx, cy, bottom, half }) {
  const s = half / 9.4
  switch (kind) {
    case 'type0': return [[cx - 5, bottom - 3], [cx + 2, bottom - 2]]
    case 'type1': return [[cx - 5, bottom - 2], [cx + 2, bottom - 3]]
    case 'hold': return [[cx - 8 * s, bottom - 4], [cx + 5 * s, bottom - 4]]
    case 'up0': return [[cx - half - 2.5, cy - 5], [cx + half - 0.5, cy - 2]]
    case 'up1': return [[cx - half - 2.5, cy - 2], [cx + half - 0.5, cy - 5]]
    case 'point': return [[cx - half - 1.5, cy + 2], [cx + half - 0.5, cy - 1]]
    case 'wave': return [[cx - half - 1.5, cy + 2], [cx + half - 0.5, cy - 4]]
    default: return [[cx - half - 1.5, cy + 2], [cx + half - 2.5, cy + 2]]
  }
}

// A hand: a small shaded blob with an outline.
function mitten(c, x, y, out, fill) {
  disc(c, (x + 2) * K, (y + 1.5) * K, 2.1 * K, 1.6 * K, out)
  disc(c, (x + 2) * K, (y + 1.5) * K, 1.5 * K, 1.1 * K, fill)
  disc(c, (x + 1.5) * K, (y + 1.1) * K, 0.5 * K, 0.35 * K, R.WHITE)
}

/** Design-unit drawing for icon-like details. */
const design = c => ({ patch: (x, y, rows, map) => c.patchK(x, y, rows, map), rect: (x, y, w, h, role) => c.rectK(x, y, w, h, role), set: (x, y, role) => c.setK(x, y, role) })

/** Turns a character definition into the `draw(canvas, pose)` the scene calls. */
function define(def) {
  const draw = (canvas, pose) => {
    const tf = transform(pose, def.pivot)
    const key = [def.id, pose.dy ?? 0, pose.sx ?? 1, pose.sy ?? 1, pose.shake ?? 0].join('|')
    canvas.stamp(cachedBody(key, body => paint(body, def.shapes(), tf)))
    def.details?.(design(canvas), tf, pose)
    drawFace(canvas, pose, def.face(tf))
    const A = def.anchors
    // Anchors stay in design units: props, hands and effects are placed on the 36x28 design grid.
    const cx = tf.X(A.cx)
    const cy = tf.Y(A.cy)
    const bottom = tf.Y(A.bottom)
    return { cx, top: tf.Y(A.top), bottom, faceY: tf.Y(A.faceY), left: tf.X(A.left), right: tf.X(A.right), hands: handsFor(pose.hands ?? 'rest', { cx, cy, bottom, half: A.half }) }
  }
  const limb = (canvas, anchors, index, hand) => mitten(canvas, hand[0], hand[1], def.hand[0], def.hand[1])
  return { draw, limb, ground: def.ground, depth: def.depth ?? 2 }
}

const star = (c, x, y, bright = R.GOLD, dark = R.GOLD2) => c.patch(x, y, ['..Y..', '.YYY.', 'YYYYY', '.YYY.', '.Y.Y.'], { Y: bright, y: dark })

// ---- Puff Alpha ---------------------------------------------------------------------------------------------------
export const ALPHA = define({
  id: 'alpha', pivot: [18, 22.4], ground: 22, hand: [R.OUT, R.LIGHT],
  shapes: () => [
    ell(13.6, 22, 2.9, 1.7, ACC), ell(22.4, 22, 2.9, 1.7, ACC),
    ell(18, 14.2, 9.9, 8.3, BODY),
    ell(18, 19, 5.6, 3.2, flat(R.LIGHT), { noEdge: true }),
    ell(16.2, 4.9, 2.3, 1.2, ACC), ell(20.2, 4.1, 2.3, 1.2, ACC), ell(18.2, 6.2, 0.7, 1.4, flat(R.ASHADE), { noEdge: true }),
  ],
  details: c => c.patch(15.5, 18.6, ['.##.#', '#..#.', '#..#.', '.##.#'], { '#': R.ALIGHT }),
  face: tf => ({ set: 'round', eyeL: [tf.X(13), tf.Y(13.2)], eyeR: [tf.X(23), tf.Y(13.2)], mouth: [tf.X(18), tf.Y(17.4)], cheeks: [[tf.X(10.2), tf.Y(16.6)], [tf.X(25.8), tf.Y(16.6)]], cheekRole: R.ABASE, cheekBright: R.ALIGHT }),
  anchors: { cx: 18, cy: 14.2, top: 4, bottom: 22.4, faceY: 11.2, left: 8, right: 28, half: 9.9 },
})

// ---- Puff Classic: a cloud with headphones and a curl --------------------------------------------------------------------
const ring = (cx, cy, rx, ry, t, ymax, ramp) => {
  cx *= K; cy *= K; rx *= K; ry *= K; ymax *= K
  return { inside: (x, y) => { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; return d <= 1 && d >= (1 - t) ** 2 && y <= ymax }, c: [cx, cy], r: [rx, ry], ramp, border: false }
}
export const CLASSIC = define({
  id: 'classic', pivot: [18, 22.4], ground: 22, hand: [R.OUT, R.LIGHT],
  shapes: () => [
    ell(18, 15, 9, 8, BODY), ell(10.4, 16.6, 4.4, 4.8, BODY), ell(25.6, 16.6, 4.4, 4.8, BODY),
    ell(13.6, 20.8, 4, 2.8, BODY), ell(22.4, 20.8, 4, 2.8, BODY), ell(18, 21.4, 3.4, 2.4, BODY),
    ring(18, 13.4, 11, 9.6, 0.11, 12.5, ACC),
    rrect(5.8, 10.6, 4.6, 8.4, 1.5, ACC, { border: true }), rrect(25.6, 10.6, 4.6, 8.4, 1.5, ACC, { border: true }),
  ],
  details: c => {
    c.patch(7.2, 13.4, ['.#', '#.', '.#'], { '#': R.CYAN }); c.patch(26.8, 13.4, ['#.', '.#', '#.'], { '#': R.CYAN })
    c.patch(16.5, 0.4, ['.sSSs.', 'sS..Ss', '....Ss', '...sS.'], { s: R.SHADE, S: R.LIGHT })
  },
  face: tf => ({ set: 'oval', eyeL: [tf.X(13.4), tf.Y(14.4)], eyeR: [tf.X(22.6), tf.Y(14.4)], mouth: [tf.X(18), tf.Y(18.4)], defaultMouth: 'grin', cheeks: [[tf.X(10.6), tf.Y(17.2)], [tf.X(25.4), tf.Y(17.2)]] }),
  anchors: { cx: 18, cy: 15, top: 1, bottom: 22.4, faceY: 12.4, left: 6.2, right: 29.8, half: 10.5 },
})

// ---- Puff Fox ---------------------------------------------------------------------------------------------------------------
export const FOX = define({
  id: 'fox', pivot: [18, 22.4], ground: 22, hand: [R.CREAM2, R.CREAM],
  shapes: () => [
    ell(8.2, 19.2, 4.8, 3.9, BODY), ell(5.4, 20.8, 2.4, 2, CREAM),
    poly([[9, 10], [10.4, 0.6], [15.4, 8.2]], BODY), poly([[27, 10], [25.6, 0.6], [20.6, 8.2]], BODY),
    poly([[10.8, 8.2], [11.2, 3.4], [13.6, 7.4]], flat(R.CREAM2), { noEdge: true }), poly([[25.2, 8.2], [24.8, 3.4], [22.4, 7.4]], flat(R.CREAM2), { noEdge: true }),
    ell(18, 14.6, 9.8, 7.2, BODY),
    ell(12.2, 18.2, 3.6, 2.6, CREAM, { noEdge: true }), ell(23.8, 18.2, 3.6, 2.6, CREAM, { noEdge: true }), ell(18, 18.6, 5.2, 3.4, CREAM, { noEdge: true }),
    ell(13.8, 22.6, 2.6, 1.4, CREAM), ell(22.2, 22.6, 2.6, 1.4, CREAM),
    rrect(9.4, 19.6, 17.2, 3, 1, NAVY, { border: true }), poly([[21, 21.5], [25, 21.5], [24.4, 24]], NAVY),
    rrect(8.6, 8.6, 18.8, 2.4, 0.8, flat(R.BROWN2), { noEdge: true }),
    ell(13.4, 8.9, 3.3, 2.7, TEAL, { border: true }), ell(22.6, 8.9, 3.3, 2.7, TEAL, { border: true }),
  ],
  details: c => {
    c.patch(15, 20, ['.#', '#.', '.#'], { '#': R.CREAM }); c.patch(20, 20, ['#.', '.#', '#.'], { '#': R.CREAM })
    c.rect(17, 16.4, 2, 1, R.INK)
    c.set(12, 8, R.WHITE); c.set(21, 8, R.WHITE)
  },
  face: tf => ({ set: 'oval', eyeL: [tf.X(13.4), tf.Y(14.4)], eyeR: [tf.X(22.6), tf.Y(14.4)], mouth: [tf.X(18), tf.Y(18.8)], defaultMouth: 'smile', cheeks: [[tf.X(10.8), tf.Y(17.4)], [tf.X(25.2), tf.Y(17.4)]] }),
  anchors: { cx: 18, cy: 15, top: 0.6, bottom: 22.4, faceY: 12.4, left: 3.6, right: 27.8, half: 9.8 },
})

// ---- Puff Bot ------------------------------------------------------------------------------------------------------------------
export const BOT = define({
  id: 'bot', pivot: [18, 24], ground: 23, hand: [R.AOUT, R.ABASE],
  shapes: () => [
    rrect(18.6, 3.8, 1, 3, 0.2, flat(R.NAVY2)), ell(19.1, 2.8, 1.9, 1.9, CYAN),
    rrect(6.2, 8.2, 3.8, 6.4, 1.2, ACC, { border: true }), rrect(26, 8.2, 3.8, 6.4, 1.2, ACC, { border: true }),
    rrect(9.4, 5.6, 17.2, 11.6, 3.2, BODY),
    rrect(11.4, 8, 13.2, 7.6, 1.8, flat(R.NAVY2), { noEdge: true }),
    rrect(12.4, 17.4, 11.2, 5.2, 1.6, BODY), rrect(15.6, 18.4, 4.8, 2.8, 0.8, ACC, { border: true }),
    rrect(9.6, 17.8, 2.6, 4.6, 1.1, ACC, { border: true }), rrect(23.8, 17.8, 2.6, 4.6, 1.1, ACC, { border: true }),
    rrect(12.6, 22, 4.4, 2.2, 1, flat(R.NAVY2)), rrect(19, 22, 4.4, 2.2, 1, flat(R.NAVY2)),
  ],
  details: c => { c.patch(16.6, 19, ['#.#.#'], { '#': R.CYAN }) },
  face: tf => ({ set: 'arch', ink: R.CYAN, eyeL: [tf.X(14.4), tf.Y(10.2)], eyeR: [tf.X(21.6), tf.Y(10.2)], mouth: [tf.X(18), tf.Y(13.6)], defaultMouth: 'smile', mouthRole: R.CYAN }),
  anchors: { cx: 18, cy: 12, top: 1, bottom: 24, faceY: 9.2, left: 6.2, right: 29.8, half: 8 },
})

// ---- Puff Slime -------------------------------------------------------------------------------------------------------------------
export const SLIME = define({
  id: 'slime', pivot: [18, 23.4], ground: 23, hand: [R.OUT, R.LIGHT],
  shapes: () => [
    ell(11.4, 22.6, 2.8, 1.4, BODY), ell(25.6, 22.7, 3.2, 1.3, BODY),
    ell(18, 16.2, 10.8, 7.2, BODY),
    ell(12.8, 12.6, 3.8, 2.1, flat(R.HI), { noEdge: true }), ell(10.4, 14.6, 1, 1, flat(R.WHITE), { noEdge: true }),
  ],
  details: c => {
    c.patch(7, 3, ['.BBB.', 'B...B', 'B.w.B', 'B...B', '.BBB.'], { B: R.CYAN, w: R.WHITE })
    c.patch(4, 9, ['.B.', 'B.B', '.B.'], { B: R.CYAN }); c.patch(3, 14, ['.B', 'B.'], { B: R.CYAN })
    c.patch(23, 4.5, ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..yyy..', '.yy.yy.'], { Y: R.GOLD, y: R.GOLD2 })
  },
  face: tf => ({ set: 'oval', eyeL: [tf.X(13.4), tf.Y(14.6)], eyeR: [tf.X(22.6), tf.Y(14.6)], mouth: [tf.X(18), tf.Y(18.6)], defaultMouth: 'cat', cheeks: [[tf.X(10.6), tf.Y(17.2)], [tf.X(25.4), tf.Y(17.2)]] }),
  anchors: { cx: 18, cy: 16.2, top: 9, bottom: 23.4, faceY: 12.6, left: 7.2, right: 28.8, half: 10.8 },
})

// ---- Puff Mage --------------------------------------------------------------------------------------------------------------------------
export const MAGE = define({
  id: 'mage', pivot: [18, 23.4], ground: 23, hand: [R.OUT, R.LIGHT],
  shapes: () => [
    poly([[11.5, 19.2], [24.5, 19.2], [27.6, 23.4], [8.4, 23.4]], ACC),
    ell(18, 16.6, 6.3, 5.3, BODY),
    ell(18, 11.4, 11.2, 2.7, ACC, { border: true }),
    poly([[12.4, 11.6], [23.6, 11.6], [22.2, 7], [23.4, 3.8], [21.2, 1.6], [18.4, 4.2], [15.6, 8.4]], ACC),
    rrect(12.8, 9.6, 10.4, 2, 0.6, flat(R.NAVY2), { noEdge: true }), rrect(17, 9.2, 3.8, 2.8, 0.4, GOLD, { border: true }),
    rrect(19.4, 17.8, 8, 5.4, 0.8, BROWN, { border: true }),
  ],
  details: c => {
    star(c, 21.8, 0, R.GOLD, R.GOLD2)
    c.patch(21.4, 19.4, ['.Y.', 'Y.Y', '.Y.'], { Y: R.GOLD })
  },
  face: tf => ({ set: 'dot', eyeL: [tf.X(15.2), tf.Y(16.4)], eyeR: [tf.X(20.8), tf.Y(16.4)], mouth: [tf.X(18), tf.Y(19.6)], defaultMouth: 'smile', cheeks: [[tf.X(13), tf.Y(18.6)], [tf.X(23), tf.Y(18.6)]], cheekR: [1.1, 0.7] }),
  anchors: { cx: 18, cy: 16.6, top: 1, bottom: 23.4, faceY: 15, left: 6.8, right: 29.2, half: 9.2 },
})

// ---- Puff Aquático ----------------------------------------------------------------------------------------------------------------------------
const CURLS = [[9.4, 11], [10.8, 7.8], [13.6, 5.8], [17, 5.2], [20.4, 6], [23, 8.4], [8.2, 14.4], [8.6, 18], [10.4, 21], [13.4, 22.4], [24.4, 11.4], [12, 9.4], [15.4, 7.6], [19, 8], [22, 10.6]]
export const AQUATIC = define({
  id: 'aquatic', pivot: [17, 22.6], ground: 22, hand: [R.OUT, R.LIGHT],
  shapes: () => [
    poly([[23.2, 13.6], [31.2, 9.6], [32.4, 16], [31.2, 22], [23.4, 18.2]], BODY),
    poly([[14.6, 7.8], [18.2, 3.4], [21.4, 8.4]], BODY),
    ell(16.4, 14.8, 8.8, 7.8, BODY),
    ell(16.4, 19.2, 5, 3, flat(R.LIGHT), { noEdge: true }),
    ...CURLS.map(([x, y]) => ell(x, y, 2.4, 2.4, ACC, { border: true })),
  ],
  details: c => {
    for (const [x, y] of CURLS) c.set(x - 0.8, y - 0.9, R.ALIGHT)
  },
  face: tf => ({ set: 'round', eyeL: [tf.X(12.2), tf.Y(14.4)], eyeR: [tf.X(21.8), tf.Y(14.4)], mouth: [tf.X(17), tf.Y(18.6)], cheeks: [[tf.X(9.4), tf.Y(17.6)], [tf.X(24.6), tf.Y(17.6)]] }),
  anchors: { cx: 16.5, cy: 15, top: 3.4, bottom: 22.6, faceY: 12.4, left: 6.2, right: 32.4, half: 8.8 },
})
