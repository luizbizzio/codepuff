// Draws the plugin icon (512x512 PNG) from Puff's own artwork. Usage: node scripts/make-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { animation } from '../src/core/art/anim.js'
import { buildPalette } from '../src/core/art/palette.js'
import { drawScene } from '../src/core/art/scene.js'
import { stageBounds, toRgba } from '../src/core/render/raster.js'
import { W } from '../src/core/art/canvas.js'
import { png } from './png.mjs'

const SIZE = 512
const bg = [22, 27, 34]
const box = stageBounds('alpha', false)
const scale = Math.floor((SIZE * 0.78) / Math.max(box.w, box.h))
const rgba = toRgba(drawScene('alpha', animation('idle').frames[0].pose), buildPalette('alpha'))
const rgb = Buffer.alloc(SIZE * SIZE * 3)
const ox = Math.floor((SIZE - box.w * scale) / 2)
const oy = Math.floor((SIZE - box.h * scale) / 2) + 6
const radius = 96
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Rounded square: outside the corners is a flat dark color (the format has no alpha).
    const cx = Math.min(Math.max(x, radius), SIZE - radius)
    const cy = Math.min(Math.max(y, radius), SIZE - radius)
    const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
    let color = inside ? bg : [13, 17, 23]
    const sx = Math.floor((x - ox) / scale) + box.x
    const sy = Math.floor((y - oy) / scale) + box.y
    if (inside && x >= ox && y >= oy && sx < box.x + box.w && sy < box.y + box.h) {
      const o = (sy * W + sx) * 4
      const a = rgba[o + 3] / 255
      if (a > 0) color = [0, 1, 2].map(k => Math.round(rgba[o + k] * a + color[k] * (1 - a)))
    }
    rgb.set(color, (y * SIZE + x) * 3)
  }
}
mkdirSync('.claude-plugin', { recursive: true })
writeFileSync('.claude-plugin/icon.png', png(SIZE, SIZE, rgb))
console.log('wrote .claude-plugin/icon.png', SIZE + 'x' + SIZE)
