// Fingerprints of the art (used by scripts/art-hashes.mjs to write the fixture and by the characters test to check it).
import { REACTIONS, animation } from '../src/core/art/anim.js'
import { MASCOT_IDS } from '../src/core/art/registry.js'
import { drawScene } from '../src/core/art/scene.js'
import { STATES } from '../src/core/petstate.js'

/** FNV-1a over the pixels, as eight hex digits. */
function fnv(pixels) {
  let h = 0x811c9dc5
  for (const value of pixels) { h = Math.imul(h ^ (value & 255), 0x01000193); h = Math.imul(h ^ (value >> 8), 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function artHashes() {
  const out = {}
  for (const id of MASCOT_IDS) {
    for (const state of [...STATES, ...REACTIONS]) {
      const anim = animation(state, { character: id })
      let loop = 0x811c9dc5
      for (const frame of anim.frames) loop = Math.imul(loop ^ parseInt(fnv(drawScene(id, frame.pose).px), 16), 0x01000193)
      out[`${id}/${state}`] = fnv(drawScene(id, anim.frames[anim.still].pose).px) + '-' + (loop >>> 0).toString(16).padStart(8, '0')
    }
  }
  return out
}
