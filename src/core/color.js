// Colors for the mascots. A user picks one or two colors; the mascot needs a whole *ramp* per color
// (highlight, light, base, shade, outline) so that shading survives any choice. Ramps follow the usual
// pixel-art rules: lights drift warm, shadows drift cool and a little more saturated, and the outline is
// a deep version of the hue, never black.

/**
 * Moves one tone of a sprite from its default body (or accent) color to the user's color, keeping the sprite's shading:
 * the default color maps to the user's color, white and black stay fixed, and tones in between follow. Hue offsets inside
 * the ramp (warm lights, cool shadows) are kept, so the result still looks painted, not tinted.
 */
export function recolorTone(tone, base, target) {
  const [h, s, l] = rgbToHsl(hexToRgb(tone))
  const [hb, sb, lb] = rgbToHsl(hexToRgb(base))
  const [ht, st, lt] = rgbToHsl(hexToRgb(target))
  const mapL = l >= lb ? lt + (l - lb) * ((1 - lt) / Math.max(1e-3, 1 - lb)) : lt * (l / Math.max(1e-3, lb))
  const hue = ht + (((h - hb + 540) % 360) - 180) * 0.35
  const sat = Math.max(0, Math.min(1, sb < 0.04 ? st * (0.4 + s) : st * (s / sb)))
  return rgbToHex(hslToRgb([hue, sat, Math.max(0.03, Math.min(0.97, mapL))]))
}

export const isHex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = t => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Moves hue `from` toward hue `to` along the short arc by `amount` (0..1). */
function hueToward(from, to, amount) {
  const diff = ((to - from + 540) % 360) - 180
  return (from + diff * amount + 360) % 360
}

/**
 * Five tones from one color. The base keeps the user's hue and (almost) their lightness, clamped so a
 * very dark or very light pick still leaves room for a visible highlight and shadow.
 * @returns {{ highlight: string, light: string, base: string, shade: string, dark: string }}
 */
export function ramp(hex) {
  const [h, s, l0] = rgbToHsl(hexToRgb(isHex(hex) ? hex : '#888888'))
  // Steps are proportional to the room left above and below the base, so a very light or very dark pick
  // still gets five distinguishable tones, and a saturated one never washes out to white.
  const l = clamp(l0, 0.24, 0.9)
  const make = (hue, sat, light) => rgbToHex(hslToRgb([hue, clamp(sat, 0, 1), clamp(light, 0.05, 0.96)]))
  return {
    highlight: make(hueToward(h, 55, 0.1), s * 0.8, l + (1 - l) * 0.5),
    light: make(hueToward(h, 55, 0.06), s * 0.92, l + (1 - l) * 0.24),
    base: make(h, s, l),
    shade: make(hueToward(h, 265, 0.08), s * 0.98, l * 0.8),
    dark: make(hueToward(h, 265, 0.14), s * 0.8, l * 0.46),
  }
}

/** A readable ink for eyes and mouths on any body color: a deep tint of the body hue, or near-white for dark bodies. */
export function ink(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(isHex(hex) ? hex : '#888888'))
  return l < 0.2 ? '#f4f1ff' : rgbToHex(hslToRgb([h, clamp(s, 0.2, 0.6), 0.1]))
}

/** WCAG relative luminance contrast of two hex colors. */
export function contrast(a, b) {
  const lum = hex => {
    const [r, g, bl] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/**
 * Ready-made looks. Each pairs a body color with an accent (cheeks, feet and tuft on Puff; arms and legs
 * on Claude). `default` means "the character's own colors".
 */
export const PRESETS = Object.freeze([
  { id: 'default', name: 'Original', body: null, accent: null },
  { id: 'sky', name: 'Sky', body: '#7cc4ff', accent: '#ff9ec0' },
  { id: 'marshmallow', name: 'Marshmallow', body: '#f6e7ff', accent: '#ffa8d8' },
  { id: 'mint', name: 'Mint', body: '#7be0b8', accent: '#ffd36e' },
  { id: 'sunset', name: 'Sunset', body: '#ff9a6b', accent: '#ff5d8f' },
  { id: 'lavender', name: 'Lavender', body: '#b69cff', accent: '#6fd8ff' },
  { id: 'lemon', name: 'Lemon', body: '#ffe066', accent: '#ff9b54' },
  { id: 'ocean', name: 'Ocean', body: '#3f8fe0', accent: '#7be9e0' },
  { id: 'berry', name: 'Berry', body: '#d4568f', accent: '#ffb4cf' },
  { id: 'ember', name: 'Ember', body: '#d97757', accent: '#c4633f' },
  { id: 'graphite', name: 'Graphite', body: '#7d8590', accent: '#58a6ff' },
  { id: 'aurora', name: 'Aurora', body: '#59e0c5', accent: '#a78bfa' },
  { id: 'cotton', name: 'Cotton candy', body: '#ffb3de', accent: '#8fe3ff' },
  { id: 'galaxy', name: 'Galaxy', body: '#a38bff', accent: '#ff7ad9' },
])
