// Puff Alpha: the one character drawn in code (shaded shapes plus a face), described as data and drawn by `define`.
// The other Puffs are sprites made from the character sheets (see spritechar.js). Colors are roles, so a user's body
// and accent colors recolor it without losing its shading.

import { K, R } from './canvas.js'
import { disc } from './draw.js'
import { ACC, BODY, cachedBody, ell, flat, paint, transform } from './shapes.js'
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
    const face = def.face(tf)
    if (!pose.noFace) drawFace(canvas, pose, face)
    const A = def.anchors
    // Anchors stay in design units: props, hands and effects are placed on the 36x28 design grid.
    const cx = tf.X(A.cx)
    const cy = tf.Y(A.cy)
    const bottom = tf.Y(A.bottom)
    return { cx, top: tf.Y(A.top), bottom, faceY: tf.Y(A.faceY), left: tf.X(A.left), right: tf.X(A.right), hands: handsFor(pose.hands ?? 'rest', { cx, cy, bottom, half: A.half }), head: { cx: cx * K, faceX: cx * K, top: tf.Y(A.headTop ?? A.top) * K, eyeY: face.eyeL[1] * K, gap: ((face.eyeR[0] - face.eyeL[0]) / 2) * K } }
  }
  const limb = (canvas, anchors, index, hand) => mitten(canvas, hand[0], hand[1], def.hand[0], def.hand[1])
  return { draw, limb, ground: def.ground, depth: def.depth ?? 2 }
}

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
  anchors: { cx: 18, cy: 14.2, top: 4, headTop: 6, bottom: 22.4, faceY: 11.2, left: 8, right: 28, half: 9.9 },
})

