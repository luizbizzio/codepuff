// A tiny indexed-color canvas. Every pixel holds a *role* (not a color): "body shade", "accent base",
// "paper", "glow". Colors are resolved only when drawing (see palette.js), which is what lets one
// drawing be recolored without losing its shading, and drawn flat (pixel) or extruded (3D).

// The scene is drawn at K times the resolution of the original 36x28 design grid. Characters are described in design
// units and drawn with K x K pixels per unit, which is what gives them smooth shading, glossy eyes and fine details.
export const K = 2
export const W = 36 * K
export const H = 28 * K

/** Pixel roles. The first block follows the user's colors; the rest are fixed. */
export const R = Object.freeze({
  T: 0,
  OUT: 1, SHADE: 2, BASE: 3, LIGHT: 4, HI: 5, // body ramp, darkest to lightest
  AOUT: 6, ASHADE: 7, ABASE: 8, ALIGHT: 9, // accent ramp
  INK: 10, WHITE: 11,
  PAPER: 12, PAPER2: 13, COVER: 14, COVER2: 15,
  METAL: 16, METAL2: 17, METAL3: 18,
  SCREEN: 19, GLOW: 20, GLOW2: 21,
  GLASS: 22, LIQ: 23, LIQ2: 24,
  RED: 25, YEL: 26, GRN: 27, BLU: 28, PINK: 29,
  SHADOW: 30,
  GOLD: 31, GOLD2: 32, CREAM: 33, CREAM2: 34, BROWN: 35, BROWN2: 36,
  TEAL: 37, TEAL2: 38, NAVY: 39, NAVY2: 40, CYAN: 41, CYAN2: 42,
})

/** In 3D, the lit top face and the shaded side face of a role are the role plus these offsets. */
export const TOP = 64
export const SIDE = 128

export class Canvas {
  constructor(w = W, h = H) {
    this.w = w
    this.h = h
    this.px = new Uint8Array(w * h)
  }

  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x] }

  set(x, y, role) {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = role
  }

  /** Draws a block of text rows. `map` gives a role for each character; '.' and ' ' are transparent. */
  patch(x, y, rows, map) {
    x = Math.round(x); y = Math.round(y)
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) {
        const role = map[rows[j][i]]
        if (role !== undefined) this.set(x + i, y + j, role)
      }
    }
  }

  rect(x, y, w, h, role) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, role)
  }

  // The same operations in design units: one unit is K x K pixels. Used for icon-like details.
  patchK(x, y, rows, map) {
    const px = Math.round(x * K); const py = Math.round(y * K)
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const role = map[rows[j][i]]; if (role !== undefined) this.rect(px + i * K, py + j * K, K, K, role) }
  }
  rectK(x, y, w, h, role) { this.rect(Math.round(x * K), Math.round(y * K), Math.round(w * K), Math.round(h * K), role) }
  setK(x, y, role) { this.rect(Math.round(x * K), Math.round(y * K), K, K, role) }

  /** Draws every non-transparent pixel of `other` on this canvas. */
  stamp(other, ox = 0, oy = 0) {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const role = other.px[y * other.w + x]
        if (role) this.set(x + ox, y + oy, role)
      }
    }
  }

  clone() {
    const copy = new Canvas(this.w, this.h)
    copy.px.set(this.px)
    return copy
  }
}

/** Silhouette edge pixels: inside, with at least one 4-neighbour outside. */
export function edges(grid, w, h) {
  const out = new Uint8Array(w * h)
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x])
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) out[y * w + x] = 1
    }
  }
  return out
}
