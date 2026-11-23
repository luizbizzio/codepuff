// The 3D style. The flat drawing is extruded backwards (up and to the right), like a thick toy cut-out: the
// top surfaces are lit and the right-hand sides are in shade, which is the same lit-block look the Metacognition
// critter had. Eyes, mouths and shines stay flat on the front, and effects (sparkles, bubbles) are drawn after.

import { R, TOP, SIDE } from './canvas.js'

const FLAT = new Set([R.T, R.SHADOW, R.INK, R.WHITE, R.CYAN])

/**
 * @param {import('./canvas.js').Canvas} src the finished front view
 * @param {number} depth how many pixels deep the toy is (2 or 3 reads well)
 */
export function extrude(src, depth) {
  const out = src.clone()
  const occupied = (x, y) => { const r = src.get(x, y); return r !== 0 && r !== R.SHADOW }
  // One-pixel-wide features (an antenna, a thin arm, a bubble's rim) stay flat: extruded they would become streaks.
  const thin = (x, y) => (!occupied(x - 1, y) && !occupied(x + 1, y)) || (!occupied(x, y - 1) && !occupied(x, y + 1))
  for (let k = depth; k >= 1; k--) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const role = src.px[y * src.w + x]
        if (!role || FLAT.has(role) || thin(x, y)) continue
        const tx = x + k
        const ty = y - k
        if (tx >= src.w || ty < 0 || src.get(tx, ty)) continue // never over the front view
        out.set(tx, ty, role + (occupied(x, y - 1) ? SIDE : TOP))
      }
    }
  }
  return out
}
