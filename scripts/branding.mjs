// Developer tool: builds docs/images/banner.html, the page the README banner (docs/images/banner.png) is a picture of.
//   node scripts/branding.mjs
//   chrome --headless --screenshot=docs/images/banner.png --window-size=1600,640 --force-device-scale-factor=2 file:///.../docs/images/banner.html
// The pets are the real ones: the same pictures the Claude Code band draws, in their resting state.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { petSvg } from '../src/core/render/raster.js'

const ORDER = ['alpha', 'classic', 'fox', 'bot', 'slime', 'mage', 'aquatic', 'claude']
const pet = (character, state, height) => petSvg({ character, state, height, crop: 'band', reduced: true })

const row = ORDER.map((character, i) => {
  const big = character === 'classic'
  return `<div class="pet${big ? ' big' : ''}" style="--i:${i}">${pet(character, character === 'fox' ? 'idle' : 'idle', big ? 215 : 160)}</div>`
}).join('')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1600px; height: 640px; overflow: hidden; background:
      radial-gradient(900px 480px at 78% 108%, rgba(124, 92, 255, .32), transparent 70%),
      radial-gradient(700px 400px at 8% -10%, rgba(63, 185, 255, .18), transparent 70%),
      linear-gradient(180deg, #0d1117 0%, #10131c 100%);
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #e6edf3; position: relative; }
  .grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 40px 40px; mask-image: radial-gradient(ellipse at 50% 60%, black, transparent 78%); }
  .copy { position: absolute; left: 96px; top: 92px; width: 1100px; }
  .name { font-size: 132px; font-weight: 800; letter-spacing: -4px; line-height: 1; background: linear-gradient(90deg, #ffffff 0%, #c7b8ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tag { margin-top: 22px; font-size: 40px; font-weight: 500; color: #c9d1d9; letter-spacing: -.5px; }
  .sub { margin-top: 14px; font-size: 26px; color: #8b949e; }
  .sub b { color: #c9d1d9; font-weight: 600; }
  .pets { position: absolute; left: 70px; right: 70px; bottom: 38px; display: flex; align-items: flex-end; gap: 0; }
  .pet { flex: 1 1 0; min-width: 0; display: flex; align-items: flex-end; justify-content: center; }
  .pet.big { flex: 1.4 1 0; }
  .pet svg { display: block; max-width: 100%; height: auto; }
  .floor { position: absolute; left: 96px; right: 96px; bottom: 30px; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent); }
</style></head><body>
  <div class="grid"></div>
  <div class="copy">
    <div class="name">CodePuff</div>
    <div class="tag">A coding pet that lives next to your AI agent.</div>
    <div class="sub">For <b>Claude Code</b> and <b>OpenAI Codex</b> &nbsp;·&nbsp; 14 languages &nbsp;·&nbsp; 100% local</div>
  </div>
  <div class="floor"></div>
  <div class="pets">${row}</div>
</body></html>
`
writeFileSync(join(import.meta.dirname, '..', 'docs', 'images', 'banner.html'), html)
console.log('docs/images/banner.html')

// The animated pets of the README: one small SVG each (the same animated pictures the band draws), shown side by side.
const DEMO = [['classic', 'thinking'], ['fox', 'coding'], ['bot', 'reading'], ['slime', 'testing'], ['mage', 'success'], ['aquatic', 'waiting']]
for (const [character, state] of DEMO) {
  writeFileSync(join(import.meta.dirname, '..', 'docs', 'images', 'demo-' + character + '.svg'), petSvg({ character, state, height: 160, crop: 'band' }))
}
console.log('docs/images/demo-*.svg')

// "What you see": every state as its own small animated SVG (Foxy), six to a row. The README table that shows them is printed to
// docs/images/states/grid.md and pasted between the markers of the README.
const STATE_GRID = [
  ['idle', 'Idle'], ['thinking', 'Thinking'], ['reading', 'Reading'], ['searching', 'Searching'], ['investigating', 'Investigating'], ['coding', 'Coding'],
  ['running', 'Running'], ['git', 'Git'], ['mcp', 'Connected tool'], ['testing', 'Testing'], ['web', 'Web'], ['delegating', 'Subagents'],
  ['planning', 'Planning'], ['success', 'Success'], ['error', 'Error'], ['permission', 'Needs you'], ['waiting', 'Waiting'], ['finished', 'Finished'],
  ['tired', 'Tired'], ['sad', 'Sad'], ['disconnected', 'Disconnected'], ['petted', 'Petted'], ['giggle', 'Giggle'], ['delighted', 'Delighted'],
]
const COLUMNS = 6
mkdirSync(join(import.meta.dirname, '..', 'docs', 'images', 'states'), { recursive: true })
for (const [state] of STATE_GRID) {
  writeFileSync(join(import.meta.dirname, '..', 'docs', 'images', 'states', state + '.svg'), petSvg({ character: 'fox', state, helpers: state === 'delegating' ? 2 : 0, height: 120, crop: 'band' }))
}
const cell = ([state, label]) => `    <td align="center"><img src="docs/images/states/${state}.svg" alt="${label}" width="120"><br><sub>${label}</sub></td>`
const rows = []
for (let i = 0; i < STATE_GRID.length; i += COLUMNS) rows.push('  <tr>\n' + STATE_GRID.slice(i, i + COLUMNS).map(cell).join('\n') + '\n  </tr>')
writeFileSync(join(import.meta.dirname, '..', 'docs', 'images', 'states', 'grid.md'), '<table>\n' + rows.join('\n') + '\n</table>\n')
console.log('docs/images/states/*.svg + grid.md')
