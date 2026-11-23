// Faces, drawn at full resolution: glossy eyes with two shines, soft cheeks, small expressive mouths and brows.
// A character picks an eye *set* (round, oval, dot, bar, arch); every set answers to the same expression names, so
// the animation layer never needs to know which character is on screen. Positions are in design units (K pixels).

import { K, R } from './canvas.js'
import { PI, arc, disc, line } from './draw.js'

// Half-width and half-height of each eye set, in design units.
const SIZES = { round: [2.1, 2.5], oval: [1.7, 2.3], dot: [1.05, 1.5], bar: [0.95, 2.2], arch: [1.7, 1.2] }

function eye(c, set, kind, cx, cy, role, side) {
  const [sx, sy] = SIZES[set]
  const rx = sx * K
  const ry = sy * K
  const t = K * 0.6
  if (set === 'arch') {
    // A screen face: glowing arcs and rings.
    switch (kind) {
      case 'blink': case 'sleep': case 'focus': line(c, cx - rx, cy, cx + rx, cy, role, t); return
      case 'wide': arc(c, cx, cy, rx * 0.8, ry * 1.1, 0, 2 * PI, role, t); return
      case 'ouch': line(c, cx - rx * 0.7, cy - ry, cx + rx * 0.7, cy + ry, role, t); line(c, cx + rx * 0.7, cy - ry, cx - rx * 0.7, cy + ry, role, t); return
      default: arc(c, cx, cy + ry * 0.6, rx, ry * 1.2, PI, 2 * PI, role, t * 1.2) // ^
    }
    return
  }
  if (set === 'bar') {
    const h = ry
    switch (kind) {
      case 'blink': case 'sleep': c.rect(cx - rx, cy + ry * 0.3, rx * 2, K, role); return
      case 'happy': arc(c, cx, cy + ry * 0.2, rx * 1.4, ry * 0.5, PI, 2 * PI, role, t); return
      case 'focus': c.rect(cx - rx, cy - ry * 0.2, rx * 2, ry * 1.2, role); return
      case 'wide': c.rect(cx - rx, cy - ry * 1.2, rx * 2, ry * 2.4, role); return
      case 'ouch': line(c, cx - rx, cy - h * 0.8, cx + rx, cy + h * 0.8, role, t); line(c, cx + rx, cy - h * 0.8, cx - rx, cy + h * 0.8, role, t); return
      default: c.rect(cx - rx, cy - ry, rx * 2, ry * 2, role); c.rect(cx - rx, cy - ry, K * 0.8, K * 0.8, R.WHITE) // a tiny shine
    }
    return
  }
  switch (kind) {
    case 'blink': case 'sleep': arc(c, cx, cy - ry * 0.2, rx, ry * 0.55, 0.1 * PI, 0.9 * PI, role, t); return
    case 'happy': arc(c, cx, cy + ry * 0.45, rx * 1.05, ry * 0.8, PI * 1.08, PI * 1.92, role, t * 1.25); return
    case 'ouch': line(c, cx - rx * 0.8, cy - ry * 0.8, cx + rx * 0.8, cy + ry * 0.8, role, t); line(c, cx + rx * 0.8, cy - ry * 0.8, cx - rx * 0.8, cy + ry * 0.8, role, t); return
    case 'focus': {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && y + 0.5 > cy - ry * 0.2) c.set(x, y, role)
      line(c, cx - rx * 1.05, cy - ry * 0.2, cx + rx * 1.05, cy - ry * 0.2, role, t)
      disc(c, cx - rx * 0.3, cy + ry * 0.15, rx * 0.26, rx * 0.26, R.WHITE)
      return
    }
    default: {
      const big = kind === 'wide' ? 1.22 : 1
      disc(c, cx, cy, rx * big, ry * big, role)
      disc(c, cx - rx * 0.32 * big, cy - ry * 0.38 * big, rx * 0.36 * big, rx * 0.36 * big, R.WHITE) // main shine
      disc(c, cx + rx * 0.38 * big, cy + ry * 0.42 * big, rx * 0.16 * big, rx * 0.16 * big, R.WHITE) // small shine
      if (side === undefined) return
    }
  }
}

function brow(c, kind, set, cx, cy, side, role) {
  if (!kind || kind === 'none' || set === 'arch') return
  const [sx, sy] = SIZES[set]
  const rx = sx * K
  const y = cy - sy * K * 1.55
  const t = K * 0.55
  if (kind === 'up') arc(c, cx, y + K * 0.6, rx, K * 0.8, PI * 1.1, PI * 1.9, role, t)
  // `side` is -1 for the left eye, +1 for the right; the inner end of a worried brow rises, of an angry one falls.
  else if (kind === 'worry') line(c, cx - side * rx, y + K * 0.9, cx + side * rx * -1, y - K * 0.5, role, t)
  else if (kind === 'focus') line(c, cx - side * rx, y - K * 0.5, cx + side * rx * -1, y + K * 0.9, role, t)
}

function mouth(c, kind, mx, my, role) {
  const t = K * 0.55
  switch (kind) {
    case 'none': return
    case 'smile': arc(c, mx, my - K * 0.5, K * 1.7, K * 1.2, 0.12 * PI, 0.88 * PI, role, t); return
    case 'grin': {
      for (let y = Math.floor(my - K); y <= Math.ceil(my + K * 1.6); y++) for (let x = Math.floor(mx - K * 1.8); x <= Math.ceil(mx + K * 1.8); x++) if (((x + 0.5 - mx) / (K * 1.8)) ** 2 + ((y + 0.5 - my) / (K * 1.6)) ** 2 <= 1 && y + 0.5 >= my - K * 0.2) c.set(x, y, role)
      disc(c, mx, my + K * 1.1, K * 0.8, K * 0.5, R.PINK)
      return
    }
    case 'flat': line(c, mx - K * 1.2, my, mx + K * 1.2, my, role, t); return
    case 'o': disc(c, mx, my, K * 0.85, K * 1.05, role); return
    case 'frown': arc(c, mx, my + K * 0.9, K * 1.5, K * 1, PI * 1.15, PI * 1.85, role, t); return
    default: // "cat": a small omega
      arc(c, mx - K * 0.85, my - K * 0.2, K * 0.85, K * 0.75, 0.05 * PI, 0.95 * PI, role, t)
      arc(c, mx + K * 0.85, my - K * 0.2, K * 0.85, K * 0.75, 0.05 * PI, 0.95 * PI, role, t)
  }
}

/**
 * Draws a character's face.
 * @param {object} spec `set` (eye set), `eyeL` / `eyeR` / `mouth` (centers, design units), optional `cheeks: [[x, y], [x, y]]`,
 *   `ink` (eye role), `mouthRole`, `defaultMouth`, `cheekRole`, `cheekBright`, `cheekR: [rx, ry]`.
 */
export function drawFace(c, pose, spec) {
  const lx = (pose.lookX ?? 0) * K
  const ly = (pose.lookY ?? 0) * K
  const role = spec.ink ?? R.INK
  const [ex, ey] = spec.eyeL
  const [fx, fy] = spec.eyeR
  if (spec.cheeks) {
    const [rx, ry] = spec.cheekR ?? [1.35, 0.85]
    const base = pose.cheeks === 'bright' ? (spec.cheekBright ?? R.PINK) : (spec.cheekRole ?? R.PINK)
    for (const [x, y] of spec.cheeks) {
      disc(c, x * K + lx, y * K + ly, rx * K, ry * K, base)
      disc(c, x * K + lx - rx * K * 0.35, y * K + ly - ry * K * 0.3, rx * K * 0.28, ry * K * 0.3, R.WHITE) // soft shine
    }
  }
  eye(c, spec.set, pose.eyes ?? 'open', ex * K + lx, ey * K + ly, role, -1)
  eye(c, spec.set, pose.eyes ?? 'open', fx * K + lx, fy * K + ly, role, 1)
  brow(c, pose.brows, spec.set, ex * K + lx, ey * K + ly, -1, role)
  brow(c, pose.brows, spec.set, fx * K + lx, fy * K + ly, 1, role)
  if (spec.mouth) mouth(c, pose.mouth ?? spec.defaultMouth ?? 'cat', spec.mouth[0] * K + lx, spec.mouth[1] * K + ly, spec.mouthRole ?? role)
}
