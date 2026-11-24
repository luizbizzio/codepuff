// "Claude": a boxy orange pixel critter built like a small vinyl toy: a lit top, a flat front, a shaded side, stubby
// legs and bar-shaped eyes. It is an original drawing in the spirit of the pixel companion from the Metacognition
// project. It is not official artwork, and not affiliated with or endorsed by Anthropic. A small antenna light on its
// head shows state with a color (green ok, red failure, yellow waiting), which is a real signal.

import { K, R } from './canvas.js'
import { drawFace } from './faces.js'
import { disc, line } from './draw.js'
import { ACC, cachedBody, paint, poly, rrect, transform } from './shapes.js'

const LED = { ok: R.GRN, error: R.RED, wait: R.YEL, think: R.BLU, off: R.METAL2 }
const FRONT = Object.freeze([R.OUT, R.BASE, R.BASE, R.BASE, R.BASE])
const TOPFACE = Object.freeze([R.OUT, R.LIGHT, R.LIGHT, R.LIGHT, R.LIGHT])
const SIDEFACE = Object.freeze([R.OUT, R.SHADE, R.SHADE, R.SHADE, R.SHADE])

export function drawClaude(c, pose) {
  const tf = transform(pose, [18, 24])
  const d = 3 // depth in design units
  const key = ['claude', pose.dy ?? 0, pose.sx ?? 1, pose.sy ?? 1, pose.shake ?? 0].join('|')
  c.stamp(cachedBody(key, body => {
    const shapes = [
      rrect(12, 21, 4.6, 3.2, 0.7, ACC, { border: true }), rrect(19.4, 21, 4.6, 3.2, 0.7, ACC, { border: true }),
    ]
    shapes.push(
      poly([[26, 9], [26 + d, 9 - d], [26 + d, 21 - d], [26, 21]], SIDEFACE, { flat: true }),
      poly([[10, 9], [10 + d, 9 - d], [26 + d, 9 - d], [26, 9]], TOPFACE, { flat: true }),
    )
    shapes.push(rrect(10, 9, 16, 12, 0.6, FRONT, { flat: true }))
    paint(body, shapes, tf)
  }))
  const detail = (x, y, w, h, role) => c.rect(tf.X(x) * K, tf.Y(y) * K, w * K, h * K, role)
  // Bevel on the front: a bright top edge and a lighter left edge.
  detail(10.6, 9.6, 14.8, 0.7, R.HI)
  detail(10.6, 10.3, 0.8, 9.6, R.LIGHT)
  // Antenna with a status light.
  const ay = 4.6
  detail(19.5, ay, 0.9, 2.2, R.METAL3)
  detail(18.6, ay - 2, 2.8, 2, LED[pose.led ?? 'ok'] ?? R.GRN)
  detail(18.8, ay - 1.9, 0.9, 0.8, R.WHITE)
  drawFace(c, pose, {
    set: 'bar', eyeL: [tf.X(14), tf.Y(13)], eyeR: [tf.X(22), tf.Y(13)], mouth: [tf.X(18), tf.Y(16.8)], defaultMouth: 'cat',
    cheeks: pose.cheeks === 'bright' ? [[tf.X(11.6), tf.Y(16.6)], [tf.X(24.4), tf.Y(16.6)]] : undefined, cheekRole: R.ALIGHT, cheekBright: R.ALIGHT, cheekR: [1, 0.6],
  })
  return {
    cx: tf.X(18), top: tf.Y(9 - d - 4), bottom: tf.Y(24), faceY: tf.Y(13), left: tf.X(10), right: tf.X(26 + d),
    hands: handsFor(pose.hands ?? 'rest', tf.X(18), tf.Y(9), tf.Y(23)),
    arms: { left: [tf.X(10), tf.Y(14)], right: [tf.X(26 + d), tf.Y(14)] },
  }
}

/** Hand positions (top-left of a 4x3 block), in design units. */
function handsFor(kind, cx, fy0, bottom) {
  const y = fy0 + 6
  switch (kind) {
    case 'type0': return [[cx - 6, bottom - 3], [cx + 2, bottom - 2]]
    case 'type1': return [[cx - 6, bottom - 2], [cx + 2, bottom - 3]]
    case 'hold': return [[cx - 9, bottom - 4], [cx + 6, bottom - 4]]
    case 'up0': return [[cx - 13, fy0 - 2], [cx + 12, fy0 + 2]]
    case 'up1': return [[cx - 13, fy0 + 2], [cx + 12, fy0 - 2]]
    case 'point': return [[cx - 12, y], [cx + 11, fy0 + 2]]
    case 'wave': return [[cx - 12, y], [cx + 11, fy0 - 2]]
    default: return [[cx - 12, y], [cx + 11, y]]
  }
}

/** An arm: a limb from the shoulder to the hand, then the hand. All in design units. */
function limb(c, anchors, index, hand) {
  const shoulder = index === 0 ? anchors.arms.left : anchors.arms.right
  const hx = hand[0] + 2
  const hy = hand[1] + 1.5
  line(c, shoulder[0] * K, shoulder[1] * K, hx * K, hy * K, R.AOUT, 2.4 * K * 0.6 + 1)
  line(c, shoulder[0] * K, shoulder[1] * K, hx * K, hy * K, R.ABASE, 1.4 * K * 0.6)
  disc(c, hx * K, hy * K, 2.1 * K, 1.6 * K, R.AOUT)
  disc(c, hx * K, hy * K, 1.5 * K, 1.1 * K, R.ABASE)
  disc(c, (hx - 0.5) * K, (hy - 0.5) * K, 0.5 * K, 0.35 * K, R.ALIGHT)
}

export const CLAUDE = { draw: drawClaude, limb, ground: 23, depth: 3 }
