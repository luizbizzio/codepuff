// Developer tool: measures the one frame every character is drawn in (every character, state and frame) and prints
// the constants to keep in src/core/render/raster.js (STAGE). Run it after changing a character or an animation;
// the characters test fails when something no longer fits.
import { REACTIONS, animation } from '../src/core/art/anim.js'
import { H, W } from '../src/core/art/canvas.js'
import { MASCOT_IDS } from '../src/core/art/registry.js'
import { drawScene } from '../src/core/art/scene.js'
import { STATES } from '../src/core/petstate.js'

const measure = helpers => {
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1
  for (const id of MASCOT_IDS) {
    for (const state of [...STATES, ...REACTIONS]) {
      for (const { pose } of animation(state, { helpers, character: id }).frames) {
        const c = drawScene(id, pose)
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c.px[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      }
    }
  }
  y0 -= y0 % 2
  if ((y1 - y0 + 1) % 2) y1++
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
console.log(JSON.stringify({ narrow: measure(0), wide: measure(3) }))
