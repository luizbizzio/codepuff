// Roles -> colors. The user's body and accent colors become two five-tone ramps; everything else (paper, glass,
// screens, gold, sparkles) is fixed so props and details always look like what they are.

import { LEVEL, R, SPRITE_BASE } from './canvas.js'
import { SPRITES } from './sprites.js'
import { ink, isHex, ramp, recolorTone } from '../color.js'
import { CHARACTER_DEFAULTS } from './defaults.js'

const FIXED = {
  [R.WHITE]: '#ffffff',
  [R.PAPER]: '#f4f1ea', [R.PAPER2]: '#cfc8b8', [R.COVER]: '#5b6ee1', [R.COVER2]: '#3e4bb0',
  [R.METAL]: '#c9d1d9', [R.METAL2]: '#8b949e', [R.METAL3]: '#4b5563',
  [R.SCREEN]: '#0d1b2a', [R.GLOW]: '#3fb950', [R.GLOW2]: '#58a6ff',
  [R.GLASS]: '#a5d6ff', [R.LIQ]: '#57d98a', [R.LIQ2]: '#2fa763',
  [R.RED]: '#f85149', [R.YEL]: '#ffd33d', [R.GRN]: '#3fb950', [R.BLU]: '#58a6ff', [R.PINK]: '#ff8ab8',
  [R.GOLD]: '#ffcf4a', [R.GOLD2]: '#c98d1a', [R.CREAM]: '#ffe8cf', [R.CREAM2]: '#e9bf98',
  [R.BROWN]: '#8a5530', [R.BROWN2]: '#54301a', [R.TEAL]: '#3fe6d8', [R.TEAL2]: '#1b8f98',
  [R.NAVY]: '#34336e', [R.NAVY2]: '#1c1b45', [R.CYAN]: '#4be3ff', [R.CYAN2]: '#1798c4',
}

const toRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255] }

/**
 * @param {string} character a registered character id
 * @param {{ body?: string | null, accent?: string | null }} [colors] null / missing = the character's own
 * @param {{ gray?: number }} [options] gray 0..1 desaturates (used for the disconnected state)
 * @returns {number[][]} `[r, g, b, a]` per role (index it with a role)
 */
export function buildPalette(character, colors = {}, options = {}) {
  const own = Object.hasOwn(CHARACTER_DEFAULTS, character) ? CHARACTER_DEFAULTS[character] : CHARACTER_DEFAULTS.alpha
  const body = isHex(colors.body) ? colors.body : own.body
  const accent = isHex(colors.accent) ? colors.accent : own.accent
  const b = ramp(body)
  const a = ramp(accent)
  const table = new Array(LEVEL).fill(null)
  table[R.T] = [0, 0, 0, 0]
  table[R.OUT] = toRgb(b.dark); table[R.SHADE] = toRgb(b.shade); table[R.BASE] = toRgb(b.base); table[R.LIGHT] = toRgb(b.light); table[R.HI] = toRgb(b.highlight)
  table[R.AOUT] = toRgb(a.dark); table[R.ASHADE] = toRgb(a.shade); table[R.ABASE] = toRgb(a.base); table[R.ALIGHT] = toRgb(a.light)
  table[R.INK] = toRgb(ink(b.base))
  for (const [role, hex] of Object.entries(FIXED)) table[role] = toRgb(hex)
  table[R.SHADOW] = [0, 0, 0, 64]
  const sprite = Object.hasOwn(SPRITES, character) ? SPRITES[character] : undefined
  if (sprite) {
    sprite.slots.forEach(([tone, kind], i) => {
      const target = kind === 'body' ? colors.body : kind === 'accent' ? colors.accent : null
      table[SPRITE_BASE + i] = toRgb(isHex(target) ? recolorTone(tone, sprite.base[kind], target) : tone)
    })
  }
  const gray = options.gray ?? 0
  // Gray (for the disconnected state).
  if (gray > 0) {
    for (let role = 1; role < LEVEL; role++) {
      if (!table[role] || role === R.SHADOW) continue
      const [r, g, bl, alpha] = table[role]
      const y = 0.3 * r + 0.59 * g + 0.11 * bl
      table[role] = [r + (y - r) * gray, g + (y - g) * gray, bl + (y - bl) * gray, alpha]
    }
  }
  return table.map(color => color ?? [0, 0, 0, 0])
}

export const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
