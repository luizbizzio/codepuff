// Small drawing primitives in pixel coordinates: discs, lines and arcs. They are what the hi-res faces, props and
// limbs are built from.

import { K } from './canvas.js'

/** Fills an ellipse (pixel centers). */
export function disc(c, cx, cy, rx, ry, role) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.set(x, y, role)
    }
  }
}

/** A line of the given thickness (in pixels). */
export function line(c, x0, y0, x1, y1, role, thick = K * 0.55) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
  const r = Math.max(0.5, thick / 2)
  for (let i = 0; i <= steps; i++) disc(c, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r, r, role)
}

/** An elliptical arc from angle a0 to a1 (radians; y points down, so 0..PI is the lower half). */
export function arc(c, cx, cy, rx, ry, a0, a1, role, thick = K * 0.55) {
  const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * 1.5))
  let px = cx + rx * Math.cos(a0)
  let py = cy + ry * Math.sin(a0)
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    const x = cx + rx * Math.cos(a)
    const y = cy + ry * Math.sin(a)
    line(c, px, py, x, y, role, thick)
    px = x; py = y
  }
}

export const PI = Math.PI
