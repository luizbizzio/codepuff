// Developer tool: renders contact sheets into ./out so the art can be looked at.
//   node scripts/preview.mjs [scale]            all characters, pixel and 3D, in a few states
//   node scripts/preview.mjs 5 fox              every state of one character, pixel above 3D
import { mkdirSync, writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { animation, STILL_STATES } from '../src/core/art/anim.js'
import { MASCOT_IDS } from '../src/core/art/registry.js'
import { buildPalette } from '../src/core/art/palette.js'
import { drawScene } from '../src/core/art/scene.js'
import { toRgba } from '../src/core/render/raster.js'
import { W, H } from '../src/core/art/canvas.js'

const scale = Number(process.argv[2] ?? 5)
const only = process.argv[3]
const BG = [13, 17, 23]
const CW = W * scale + 6
const CH = H * scale + 6

function sheet(rows, cols, name) {
  const width = cols * CW
  const height = rows.length * CH
  const rgb = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) { rgb[i * 3] = BG[0]; rgb[i * 3 + 1] = BG[1]; rgb[i * 3 + 2] = BG[2] }
  rows.forEach((row, r) => row.forEach((cell, col) => {
    if (!cell) return
    const anim = animation(cell.state, { helpers: cell.helpers ?? 0 })
    const palette = buildPalette(cell.character, {}, { gray: anim.gray ? 0.8 : 0 })
    const frame = anim.frames[Math.min(anim.frames.length - 1, cell.frame ?? anim.still)]
    const rgba = toRgba(drawScene(cell.character, frame.pose, cell.style), palette)
    for (let y = 0; y < H * scale; y++) {
      for (let x = 0; x < W * scale; x++) {
        const o = ((Math.floor(y / scale)) * W + Math.floor(x / scale)) * 4
        const a = rgba[o + 3] / 255
        if (a === 0) continue
        const k = ((r * CH + 3 + y) * width + col * CW + 3 + x) * 3
        for (let ch = 0; ch < 3; ch++) rgb[k + ch] = Math.round(rgba[o + ch] * a + BG[ch] * (1 - a))
      }
    }
  }))
  mkdirSync('out', { recursive: true })
  writeFileSync(`out/${name}.png`, png(width, height, rgb))
  console.log(`out/${name}.png  ${width}x${height}`)
}

if (only) {
  const states = STILL_STATES.filter(s => s !== 'petted')
  const half = Math.ceil(states.length / 2)
  for (const [n, list] of [['a', states.slice(0, half)], ['b', states.slice(half)]]) {
    sheet(['pixel', '3d'].flatMap(style => [list.map(state => ({ character: only, state, style }))]), list.length, `${only}-states-${n}`)
  }
} else {
  const states = ['idle', 'coding', 'success', 'error']
  sheet(MASCOT_IDS.map(character => [...['pixel', '3d'].flatMap(style => states.slice(0, 3).map(state => ({ character, state, style })))]), 6, 'characters')
}
