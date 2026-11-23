// Shaded shapes. A character is a handful of ellipses, rounded rectangles and polygons, each painted with a
// five-tone ramp lit from the upper left (so the shading is the same under any color), outlined on the
// silhouette, and squashed or hopped as a whole by a transform. Face and hands are placed on top by the character.

import { Canvas, K, R, W, H } from './canvas.js'

export const BODY = Object.freeze([R.OUT, R.SHADE, R.BASE, R.LIGHT, R.HI])
export const ACC = Object.freeze([R.AOUT, R.ASHADE, R.ABASE, R.ALIGHT, R.ALIGHT])
export const CREAM = Object.freeze([R.CREAM2, R.CREAM2, R.CREAM, R.CREAM, R.WHITE])
export const TEAL = Object.freeze([R.TEAL2, R.TEAL2, R.TEAL, R.TEAL, R.WHITE])
export const NAVY = Object.freeze([R.NAVY2, R.NAVY2, R.NAVY, R.NAVY, R.NAVY])
export const CYAN = Object.freeze([R.CYAN2, R.CYAN2, R.CYAN, R.CYAN, R.WHITE])
export const GOLD = Object.freeze([R.GOLD2, R.GOLD2, R.GOLD, R.GOLD, R.WHITE])
export const BROWN = Object.freeze([R.BROWN2, R.BROWN2, R.BROWN, R.BROWN, R.BROWN])
export const flat = role => Object.freeze([role, role, role, role, role])

const make = (inside, c, r, ramp, o) => ({ inside, c, r, ramp, ...o })

export const ell = (cx, cy, rx, ry, ramp, o = {}) => { cx *= K; cy *= K; rx *= K; ry *= K; return make((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, [cx, cy], [rx, ry], ramp, o) }

export function rrect(x0, y0, w, h, rad, ramp, o = {}) {
  x0 *= K; y0 *= K; w *= K; h *= K; rad *= K
  const x1 = x0 + w
  const y1 = y0 + h
  const inside = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const dx = Math.max(x0 + rad - x, 0, x - (x1 - rad))
    const dy = Math.max(y0 + rad - y, 0, y - (y1 - rad))
    return dx * dx + dy * dy <= rad * rad
  }
  return make(inside, [x0 + w / 2, y0 + h / 2], [w / 2, h / 2], ramp, o)
}

export function poly(rawPoints, ramp, o = {}) {
  const points = rawPoints.map(([x, y]) => [x * K, y * K])
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const inside = (x, y) => {
    let hit = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i]
      const [xj, yj] = points[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  return make(inside, [cx, cy], [(Math.max(...xs) - Math.min(...xs)) / 2 || 1, (Math.max(...ys) - Math.min(...ys)) / 2 || 1], ramp, o)
}

/**
 * A pose's hop, squash and shake as a transform around the feet. `to(x, y)` maps a base coordinate to the
 * drawn one; `from` is its inverse, used to ask each shape "are you here?".
 */
export function transform(pose, pivot) {
  const sx = pose.sx ?? 1
  const sy = pose.sy ?? 1
  const dx = (pose.shake ?? 0) * K
  const dy = (pose.dy ?? 0) * K
  const px = pivot[0] * K
  const py = pivot[1] * K
  return {
    to: (x, y) => [px + (x - px) * sx + dx, py - (py - y) * sy + dy],
    from: (x, y) => [px + (x - dx - px) / sx, py - (py - (y - dy)) / sy],
    X: x => (px + (x * K - px) * sx + dx) / K,
    Y: y => (py - (py - y * K) * sy + dy) / K,
  }
}

/** Paints shapes (later ones over earlier ones) onto the canvas. */
export function paint(c, shapes, tf) {
  const label = new Int16Array(W * H).fill(-1)
  const at = new Float32Array(W * H * 2)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [bx, by] = tf ? tf.from(x + 0.5, y + 0.5) : [x + 0.5, y + 0.5]
      at[(y * W + x) * 2] = bx
      at[(y * W + x) * 2 + 1] = by
      for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].inside(bx, by)) { label[y * W + x] = i; break }
    }
  }
  const lab = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : label[y * W + x])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = label[y * W + x]
      if (i < 0) continue
      const s = shapes[i]
      const around = [lab(x - 1, y), lab(x + 1, y), lab(x, y - 1), lab(x, y + 1)]
      if (!s.noEdge && around.includes(-1)) { c.set(x, y, s.ramp[0]); continue }
      if (s.border && around.some(l => l >= 0 && l !== i && shapes[l] !== s)) { c.set(x, y, s.ramp[0]); continue }
      if (s.flat) { c.set(x, y, s.ramp[2]); continue }
      const bx = at[(y * W + x) * 2]
      const by = at[(y * W + x) * 2 + 1]
      const nx = Math.max(-1, Math.min(1, (bx - s.c[0]) / s.r[0]))
      const ny = Math.max(-1, Math.min(1, (by - s.c[1]) / s.r[1]))
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx * 0.85 - ny * ny * 0.85))
      const light = -0.45 * nx - 0.62 * ny + 0.64 * nz
      c.set(x, y, light > 0.9 ? s.ramp[4] : light > 0.58 ? s.ramp[3] : light > 0.1 ? s.ramp[2] : s.ramp[1])
    }
  }
}

const memo = new Map()
/** Paints a body once per transform and hands back a copy, so animation frames that only change the face cost almost nothing. */
export function cachedBody(key, build) {
  let hit = memo.get(key)
  if (!hit) {
    hit = new Canvas()
    build(hit)
    if (memo.size > 400) memo.clear()
    memo.set(key, hit)
  }
  return hit.clone()
}
