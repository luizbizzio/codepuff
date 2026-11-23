// The character registry. A character is a module that draws itself on a canvas and tells the scene where its hands,
// face and feet are. Adding a pet means: describe it (see chars.js: shapes, details, a face and anchors, or write
// `draw` yourself as claude.js does), add it here and in defaults.js (name, colors), and add its id to CHARACTERS in
// settings.js. Nothing else changes: events, statistics, animation states, colors, the pixel and 3D styles, the SVG
// and terminal renderers and every UI work with any registered character.
//
// A character's `draw(canvas, pose)` returns its anchors:
//   { cx, top, bottom, faceY, left, right, hands: [[x, y], [x, y]], arms?: { left, right } }
// and `limb(canvas, anchors, index, hand)` draws a hand (or arm) at one of the hand positions.

import { CHARACTER_BLURBS, CHARACTER_DEFAULTS, CHARACTER_NAMES } from './defaults.js'
import { ALPHA, AQUATIC, BOT, CLASSIC, FOX, MAGE, SLIME } from './chars.js'
import { CLAUDE as claude } from './claude.js'

const parts = { alpha: ALPHA, classic: CLASSIC, fox: FOX, bot: BOT, slime: SLIME, mage: MAGE, aquatic: AQUATIC, claude }

export const MASCOTS = Object.freeze(Object.fromEntries(Object.entries(parts).map(([id, part]) => [id, Object.freeze({
  id, name: CHARACTER_NAMES[id], description: CHARACTER_BLURBS[id], defaults: CHARACTER_DEFAULTS[id], ...part,
})])))

export const MASCOT_IDS = Object.freeze(Object.keys(MASCOTS))
export const mascot = id => MASCOTS[id] ?? MASCOTS.alpha
