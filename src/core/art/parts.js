// Parts of a character that move on their own (a tail, an antenna, a fin): small areas of the sprite, cut out of the body and
// swung gently around where they join it. Written in sprite pixels, as in sprites.js (`scripts/sprites` shows the rows).
// Each part is a rectangle [x0, y0, x1, y1] that holds the part and none of the body, the pivot it swings about, and how far
// (degrees) it swings.

import { W } from './canvas.js'
import { STAND } from './scene.js'
import { SPRITES } from './sprites.js'

const PARTS = {
  fox: [{ name: 'tail', rect: [0, 22, 9, 42], pivot: [10, 34], swing: 3.5 }],
  classic: [{ name: 'curl', rect: [25, 0, 36, 6], pivot: [30, 7], swing: 6 }],
  bot: [{ name: 'antenna', rect: [21, 0, 31, 10], pivot: [22, 11], swing: 6 }],
  mage: [{ name: 'star', rect: [38, 6, 48, 17], pivot: [43, 12], swing: 8 }],
  aquatic: [{ name: 'fin', rect: [42, 11, 55, 32], pivot: [42, 22], swing: 3.5 }],
}

/** The parts of a character in scene pixels (the same coordinates as the canvas), or an empty list. */
export function partsOf(character) {
  const S = SPRITES[character]
  const list = PARTS[character]
  if (!S || !list) return []
  const ox = Math.round(W / 2 - S.w / 2)
  const oy = STAND - S.h
  return list.map(part => ({
    name: part.name,
    rect: [part.rect[0] + ox, part.rect[1] + oy, part.rect[2] + ox, part.rect[3] + oy],
    pivot: [part.pivot[0] + ox, part.pivot[1] + oy],
    swing: part.swing,
  }))
}
