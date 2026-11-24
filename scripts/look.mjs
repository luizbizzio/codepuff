// Developer tool: one character, a few poses side by side, enlarged. Usage:
//   node scripts/look.mjs <character> [scale=8] [state,state,...]
import { mkdirSync, writeFileSync } from 'node:fs'
import { png } from './png.mjs'
import { animation } from '../src/core/art/anim.js'
import { W } from '../src/core/art/canvas.js'
import { buildPalette } from '../src/core/art/palette.js'
import { drawScene } from '../src/core/art/scene.js'
import { stageBounds, toRgba } from '../src/core/render/raster.js'

const [id = 'classic', scaleArg = '8', list = 'idle,success,error'] = process.argv.slice(2)
const scale = Number(scaleArg)
const states = list.split(',')
const box = stageBounds()
const cw = box.w * scale + 8
const ch = box.h * scale + 8
const width = cw * states.length
const rgb = Buffer.alloc(width * ch * 3)
for (let i = 0; i < width * ch; i++) { rgb[i * 3] = 13; rgb[i * 3 + 1] = 17; rgb[i * 3 + 2] = 23 }
states.forEach((state, n) => {
  const anim = animation(state, { character: id })
  const rgba = toRgba(drawScene(id, anim.frames[anim.still].pose), buildPalette(id, {}, { gray: anim.gray ? 0.8 : 0 }))
  for (let y = 0; y < box.h * scale; y++) for (let x = 0; x < box.w * scale; x++) {
    const o = ((box.y + Math.floor(y / scale)) * W + box.x + Math.floor(x / scale)) * 4
    const a = rgba[o + 3] / 255
    if (!a) continue
    const k = ((4 + y) * width + n * cw + 4 + x) * 3
    for (let c = 0; c < 3; c++) rgb[k + c] = Math.round(rgba[o + c] * a + rgb[k + c] * (1 - a))
  }
})
mkdirSync('out', { recursive: true })
writeFileSync('out/look.png', png(width, ch, rgb))
console.log('out/look.png', width + 'x' + ch)
