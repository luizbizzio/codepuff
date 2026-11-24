// Characters that are sprites: the artwork from the character sheets, shrunk to pixel art (sprites.js), placed on the
// scene and animated by the engine. What the engine adds on top of the artwork:
//   - squash, hop and shake (the sprite is resampled around its feet),
//   - a face for every expression (the sprite's own eyes and mouth were erased when it was built),
//   - recoloring of the body and accent colors that keeps the artwork's shading,

import { K, R, SPRITE_BASE, W } from './canvas.js'
import { SPRITES } from './sprites.js'
import { drawFace } from './faces.js'

export const HEADROOM = 10
const ALPHABET ='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** @param {string} id a key of SPRITES @param {{ ground?: number, depth?: number }} [options] ground is the feet row in design units */
export function defineSprite(id, { depth = 1.5 } = {}) {
  const S = SPRITES[id]
  const cells = new Uint8Array(S.w * S.h)
  S.rows.forEach((row, y) => { for (let x = 0; x < S.w; x++) cells[y * S.w + x] = row[x] === '.' ? 0 : ALPHABET.indexOf(row[x]) + 1 })
  const ox = Math.round(W / 2 - S.w / 2)
  // The feet stand HEADROOM pixels below the top of the sprite, so every sprite has the same room to hop and stretch.
  const feet = S.h + HEADROOM
  const ground = feet / K
  const oy = feet - S.h
  const pivotX = W / 2

  const draw = (canvas, pose) => {
    const sx = pose.sx ?? 1
    const sy = pose.sy ?? 1
    const dx = (pose.shake ?? 0) * K
    // The hop and the stretch never carry the sprite out of the top of the scene.
    const top = feet - (feet - oy) * sy
    const dy = Math.max((pose.dy ?? 0) * K, 1 - top)
    // Where a sprite pixel lands on the canvas (and the inverse, to resample).
    const toX = u => pivotX + (ox + u - pivotX) * sx + dx
    const toY = v => feet - (feet - (oy + v)) * sy + dy
    const x0 = Math.max(0, Math.floor(toX(0)) - 1)
    const x1 = Math.min(canvas.w - 1, Math.ceil(toX(S.w)) + 1)
    const y0 = Math.max(0, Math.floor(toY(0)) - 1)
    const y1 = Math.min(canvas.h - 1, Math.ceil(toY(S.h)) + 1)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = Math.floor(pivotX + (x + 0.5 - dx - pivotX) / sx - ox)
        const v = Math.floor(feet - (feet - (y + 0.5 - dy)) / sy - oy)
        if (u < 0 || v < 0 || u >= S.w || v >= S.h) continue
        const cell = cells[v * S.w + u]
        if (cell) canvas.px[y * canvas.w + x] = SPRITE_BASE + cell - 1
      }
    }
    const F = S.face
    const at = (u, v) => [toX(u) / K, toY(v) / K]
    const [lx, ly] = at(...F.eyeL)
    const [rx, ry] = at(...F.eyeR)
    const [mx, my] = at(...F.mouth)
    if (!pose.noFace) drawFace(canvas, pose, {
      set: F.set, eyeL: [lx, ly], eyeR: [rx, ry], mouth: [mx, my], defaultMouth: F.defaultMouth, defaultEyes: F.defaultEyes,
      eyeScale: F.eyeScale, mouthScale: F.mouthScale, ink: F.ink === 'cyan' ? R.CYAN : R.INK, mouthRole: F.ink === 'cyan' ? R.CYAN : undefined,
    })
    const bottom = toY(S.h) / K
    return {
      cx: toX(S.w / 2) / K, top: toY(0) / K, bottom, faceY: (ly + my) / 2 - 1.2, left: toX(0) / K, right: toX(S.w) / K,
      // Props held in front of the pet (laptop, book) go under the face, not under the middle of the sprite (the artwork's
      // face is off-center on most of them) and low enough to leave the mouth visible.
      propCx: Math.min(W / K - 8, Math.max(8, (lx + rx) / 2)),
      propBottom: Math.max(bottom, my + 9),
      hands: [], // the artwork has no separate hands; props sit in front of its belly
    }
  }
  return { draw, limb: () => {}, ground, shadow: ground + 2.9, depth }
}
