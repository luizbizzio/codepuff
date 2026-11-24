// Frames -> things a host can draw. Three outputs from one frame:
//   svg    vector markup with CSS keyframes, for the Claude desktop pane and the web UI (no JavaScript runs)
//   cells  half-block terminal cells, as the packed form Claude Code's `Raster` element takes
//   ansi   the same cells as escape sequences, for the companion terminal
// All three read the same canvas, so what you see is the same drawing everywhere.

import { buildPalette, toHex } from '../art/palette.js'
import { drawScene } from '../art/scene.js'
import { REACTIONS, animation, frameAt } from '../art/anim.js'
import { Canvas, K, R, W } from '../art/canvas.js'
import { STAND } from '../art/scene.js'
import { partsOf } from '../art/parts.js'
import { STATES } from '../petstate.js'

// ---- bounds ----------------------------------------------------------------------------------------------


/**
 * The frame every character is drawn in. It is the same for all of them (and for every state), so changing character
 * never changes the size of the picture, and the pet stands on the same line whoever it is. `scripts/stage-box.mjs`
 * measures it; the characters test fails if a character, a state or a frame ever draws outside it.
 */
export const STAGE = Object.freeze({ x: 0, y: 0, w: 72, h: 68 })

const f1 = n => String(Math.round(n * 10) / 10)
const bandBoxes = new Map()
const ESSENTIAL = new Set(['thought', 'excl', 'alert', 'spinner', 'sweat'])

/**
 * The tight box around one character for the compact band: everything it ever draws (body, what it holds, effects) with
 * the body at rest, no empty margins. The band shows the picture at a fixed height, so a tight box means a bigger pet in
 * the same space. With `helpers` the box also holds the subagent helpers at the edges.
 */
export function bandBox(character, helpers = false) {
  const key = character + ':' + helpers
  const known = bandBoxes.get(key)
  if (known) return known
  // Sideways the box holds everything (the band is as wide as the window, so width costs nothing); vertically it holds the
  // body and what it holds, with the effects that say what it is doing (the decorations that rise higher are simply cut off).
  let x0 = STAGE.w; let x1 = -1; let y0 = STAGE.h; let y1 = -1
  for (const state of [...STATES, ...REACTIONS]) {
    for (const { pose } of animation(state, { helpers: helpers ? 3 : 0, character }).frames) {
      const at = { ...pose, dy: 0, sx: 1, sy: 1, shake: 0 }
      const withFx = drawScene(character, { ...at, fx: pose.fx.filter(item => item.id !== 'confetti') })
      // Vertically the box holds the effects that say what the pet is doing (a thought cloud, a badge), and drops the
      // decorations that rise far above it (confetti, sparkles, floating code).
      const without = drawScene(character, { ...at, fx: pose.fx.filter(item => ESSENTIAL.has(item.id)) })
      for (let y = 0; y < withFx.h; y++) {
        for (let x = 0; x < withFx.w; x++) {
          const i = y * withFx.w + x
          if (withFx.px[i] && withFx.px[i] !== R.SHADOW) { x0 = Math.min(x0, x); x1 = Math.max(x1, x) }
          if (without.px[i] && without.px[i] !== R.SHADOW) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
        }
      }
    }
  }
  x0 = Math.max(0, x0 - 2); x1 = Math.min(STAGE.w - 1, x1 + 2)
  y0 = Math.max(0, y0 - 3); y1 = Math.min(STAGE.h - 1, y1 + 1)
  const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  bandBoxes.set(key, box)
  return box
}

/** The frame every character is drawn in (the same for all of them). */
export function stageBounds() {
  return STAGE
}

// ---- rgba / png helpers ------------------------------------------------------------------------------------

/** Canvas -> RGBA bytes (alpha 0 where transparent). */
export function toRgba(canvas, palette) {
  const out = new Uint8ClampedArray(canvas.w * canvas.h * 4)
  for (let i = 0; i < canvas.px.length; i++) {
    const [r, g, b, a] = palette[canvas.px[i]] ?? [0, 0, 0, 0]
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a
  }
  return out
}

// ---- terminal cells ------------------------------------------------------------------------------------------

const DEFAULT = 0x01000000
const solid = color => !!color && color[3] >= 128
const packRgb = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)

/**
 * Terminal cells, two pixels per cell vertically (half blocks).  shrinks the picture by averaging, so a hi-res pet
 * fits a narrow pane (1 = every pixel, 2 = half the size).
 * @returns {{ columns: number, rows: number, cells: Uint8Array }} cells as little-endian u32 triplets
 *   [codePoint, foreground, background], row-major
 */
export function toCells(canvas, palette, box = { x: 0, y: 0, w: canvas.w, h: canvas.h }, factor = 1) {
  const rgba = toRgba(canvas, palette)
  const f = Math.max(1, factor)
  const cols = Math.ceil(box.w / f)
  const px = Math.ceil(box.h / f)
  const rows = Math.ceil(px / 2)
  // The picture, shrunk: premultiplied average of the source pixels each target pixel covers.
  const sample = (i, j) => {
    let r = 0; let g = 0; let b = 0; let a = 0; let n = 0
    for (let y = Math.floor(box.y + j * f); y < Math.min(canvas.h, Math.ceil(box.y + (j + 1) * f)); y++) {
      for (let x = Math.floor(box.x + i * f); x < Math.min(canvas.w, Math.ceil(box.x + (i + 1) * f)); x++) {
        const o = (y * canvas.w + x) * 4
        const al = rgba[o + 3] / 255
        r += rgba[o] * al; g += rgba[o + 1] * al; b += rgba[o + 2] * al; a += al; n++
      }
    }
    return a / Math.max(1, n) >= 0.5 ? (Math.round(r / a) << 16) | (Math.round(g / a) << 8) | Math.round(b / a) : -1
  }
  const words = new Uint32Array(cols * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < cols; x++) {
      const top = sample(x, r * 2)
      const bottom = sample(x, r * 2 + 1)
      const i = (r * cols + x) * 3
      if (top >= 0 && bottom >= 0) { words[i] = 0x2580; words[i + 1] = top; words[i + 2] = bottom }
      else if (top >= 0) { words[i] = 0x2580; words[i + 1] = top; words[i + 2] = DEFAULT }
      else if (bottom >= 0) { words[i] = 0x2584; words[i + 1] = bottom; words[i + 2] = DEFAULT }
      else { words[i] = 0x20; words[i + 1] = DEFAULT; words[i + 2] = DEFAULT }
    }
  }
  return { columns: cols, rows, cells: new Uint8Array(words.buffer) }
}

/** The smallest shrink factor (1 to 6) at which a picture  pixels wide fits  terminal columns. */
export const fitFactor = (width, columns, height = 0, rows = Infinity) => [1, 1.5, 2, 3, 4, 5, 6].find(f => Math.ceil(width / f) <= columns && Math.ceil(Math.ceil(height / f) / 2) <= rows) ?? 6

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** Standard padded base64 (no dependency on btoa or Buffer, so it runs inside a host's module sandbox). */
export function base64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=')
  }
  return out
}

/** ANSI truecolor text, one string per terminal row. */
export function toAnsi(canvas, palette, box, factor = 1) {
  const { columns, rows, cells } = toCells(canvas, palette, box, factor)
  const words = new Uint32Array(cells.buffer, cells.byteOffset, cells.byteLength / 4)
  const lines = []
  const rgb = (kind, value) => `\x1b[${kind};2;${(value >> 16) & 255};${(value >> 8) & 255};${value & 255}m`
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const i = (r * columns + x) * 3
      const [ch, fg, bg] = [words[i], words[i + 1], words[i + 2]]
      if (ch === 0x20) { line += '\x1b[0m '; continue }
      line += '\x1b[0m' + (fg === DEFAULT ? '' : rgb(38, fg)) + (bg === DEFAULT ? '' : rgb(48, bg)) + String.fromCodePoint(ch)
    }
    lines.push(line + '\x1b[0m')
  }
  return lines
}

// ---- SVG --------------------------------------------------------------------------------------------------------

/** Merges equal-colored pixels into as few rectangles as possible (horizontal runs, then vertical stacking). */
export function rects(canvas, box = { x: 0, y: 0, w: canvas.w, h: canvas.h }) {
  const open = new Map()
  const out = []
  for (let y = box.y; y < box.y + box.h; y++) {
    const seen = new Set()
    let x = box.x
    while (x < box.x + box.w) {
      const role = canvas.get(x, y)
      let end = x
      while (end + 1 < box.x + box.w && canvas.get(end + 1, y) === role) end++
      if (role) {
        const key = role + ':' + x + ':' + (end - x + 1)
        seen.add(key)
        const run = open.get(key)
        if (run) run.h++
        else { const item = { x: x - box.x, y: y - box.y, w: end - x + 1, h: 1, role }; open.set(key, item); out.push(item) }
      }
      x = end + 1
    }
    for (const key of [...open.keys()]) if (!seen.has(key)) open.delete(key)
  }
  return out
}

const rectsMarkup = (list, palette) => {
  const byRole = new Map()
  for (const item of list) {
    if (!byRole.has(item.role)) byRole.set(item.role, [])
    byRole.get(item.role).push(item)
  }
  let out = ''
  for (const [role, items] of byRole) {
    const color = palette[role]
    const opacity = color[3] < 255 ? ` fill-opacity="${(color[3] / 255).toFixed(2)}"` : ''
    out += `<path fill="${toHex(color)}"${opacity} d="${items.map(i => `M${i.x} ${i.y}h${i.w}v${i.h}h-${i.w}z`).join('')}"/>`
  }
  return out
}

/**
 * The pet as an SVG document. Animation is pure CSS, so the host animates it with no scripting and no repaint cost on our
 * side; reduced motion shows the still frame. The pet is drawn at rest in every frame (only its face, what it holds and its
 * effects change, swapped with step-end visibility), and its hop, squash and shake are one CSS transform that eases from
 * pose to pose, so motion is smooth and the picture stays small.
 * @param {{ character: string, colors?: { body?: string | null, accent?: string | null }, state: string, helpers?: number, scale?: number, reduced?: boolean, background?: string, crop?: 'band', height?: number, hover?: boolean }} options
 */
function buildSvg({ character, colors = {}, state, helpers = 0, scale = 4, reduced = false, background, crop, height, hover = false, title }) {
  const anim = animation(state, { helpers, character })
  const palette = buildPalette(character, colors, { gray: anim.gray ? 0.8 : 0 })
  const box = crop === 'band' ? bandBox(character, helpers > 0) : STAGE
  if (height) scale = height / box.h
  const total = anim.total
  const rest = pose => ({ ...pose, dy: 0, sx: 1, sy: 1, shake: 0 })

  // Parts that move on their own (a tail, an antenna): cut out of the body at rest, drawn apart and swung (see parts.js).
  const bare = drawScene(character, { ...rest(anim.frames[0].pose), fx: [], prop: null, hands: 'rest', helpers: 0 }, 'over')
  const parts = partsOf(character).map(part => {
    const canvas = new Canvas()
    const [x0, y0, x1, y1] = part.rect
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) canvas.px[y * canvas.w + x] = bare.px[y * bare.w + x]
    return { ...part, canvas }
  }).filter(part => part.canvas.px.some(Boolean))
  const withoutParts = canvas => {
    if (!parts.length) return canvas
    const out = new Canvas()
    out.px.set(canvas.px)
    for (const part of parts) for (let k = 0; k < out.px.length; k++) if (part.canvas.px[k] && out.px[k] === part.canvas.px[k]) out.px[k] = 0
    return out
  }

  // The pictures of one layer: every distinct frame once, and when each shows. What is the same in all of them is drawn once.
  const layer = (name, kind, shared) => {
    const unique = []
    const bySignature = new Map()
    const spans = []
    let at = 0
    for (const item of anim.frames) {
      const drawn = drawScene(character, rest(item.pose), kind)
      const canvas = kind === 'over' ? withoutParts(drawn) : drawn
      const signature = canvas.px.join(',')
      let index = bySignature.get(signature)
      if (index === undefined) { index = unique.length; bySignature.set(signature, index); unique.push(canvas) }
      spans.push([index, at, at + item.d])
      at += item.d
    }
    const animated = !reduced && unique.length > 1
    let base
    if (animated && shared) {
      base = new Canvas()
      for (let k = 0; k < base.px.length; k++) { const role = unique[0].px[k]; if (role && unique.every(u => u.px[k] === role)) base.px[k] = role }
    }
    const own = canvas => {
      if (!base) return canvas
      const part = new Canvas()
      for (let k = 0; k < part.px.length; k++) if (canvas.px[k] && !base.px[k]) part.px[k] = canvas.px[k]
      return part
    }
    const groups = unique.map(canvas => rectsMarkup(rects(own(canvas), box), palette))
    const stillIndex = spans[Math.min(anim.still, spans.length - 1)][0]
    if (!animated) return { css: '', markup: `<g>${groups[stillIndex]}</g>` }
    const css = `.g${name}{visibility:hidden}.s${name}{visibility:visible}@media (prefers-reduced-motion:no-preference){` +
      groups.map((_, n) => `.g${name}${n}{animation:a${name}${n} ${total}ms step-end infinite}`).join('') + '}' +
      groups.map((_, n) => {
        const points = spans.filter(span => span[0] === n).flatMap(([, s, e]) => [[s, 'visible'], [e, 'hidden']])
        const merged = new Map()
        for (const [ms, value] of points) merged.set(ms, merged.get(ms) === 'visible' ? 'visible' : value)
        if (!merged.has(0)) merged.set(0, 'hidden')
        // A span that ends exactly where another of the same group starts keeps the group visible.
        const keyframes = [...merged].sort((a, b) => a[0] - b[0]).filter(([ms]) => ms < total)
        return `@keyframes a${name}${n}{${keyframes.map(([ms, value]) => `${((ms / total) * 100).toFixed(3)}%{visibility:${value}}`).join('')}}`
      }).join('')
    const markup = (base ? `<g>${rectsMarkup(rects(base, box), palette)}</g>` : '') +
      groups.map((markup, n) => `<g class="g${name} g${name}${n}${n === stillIndex ? ' s' + name : ''}">${markup}</g>`).join('')
    return { css, markup }
  }
  const under = layer('u', 'under', false)
  const over = layer('o', 'over', true)

  // The pet's own motion: where its feet are the picture squashes and stretches, and hops and shakes sideways.
  const ox = f1(W / 2 - box.x)
  const oy = f1(STAND - box.y)
  const round = (n, p) => Math.round(n * p) / p
  const at = pose => ({ x: round((pose.shake ?? 0) * K, 100), y: round((pose.dy ?? 0) * K, 100), sx: round(pose.sx ?? 1, 1000), sy: round(pose.sy ?? 1, 1000) })
  const css3 = p => `translate(${p.x}px,${p.y}px) scale(${p.sx},${p.sy})`
  const attr3 = p => (p.x || p.y || p.sx !== 1 || p.sy !== 1 ? ` transform="translate(${p.x} ${p.y}) translate(${ox} ${oy}) scale(${p.sx} ${p.sy}) translate(-${ox} -${oy})"` : '')
  const moves = anim.frames.map(frame => at(frame.pose))
  const moving = !reduced && moves.some(m => css3(m) !== css3(moves[0]))
  let moveCss = ''
  if (moving) {
    let ms = 0
    const steps = anim.frames.map((frame, n) => { const out = `${((ms / total) * 100).toFixed(3)}%{transform:${css3(moves[n])};animation-timing-function:ease-in-out}`; ms += frame.d; return out })
    moveCss = `@media (prefers-reduced-motion:no-preference){.mv{transform-box:view-box;transform-origin:${ox}px ${oy}px;animation:mv ${total}ms linear infinite}}@keyframes mv{${steps.join('')}100%{transform:${css3(moves[0])}}}`
  }
  const stillMove = moves[Math.min(anim.still, moves.length - 1)]

  // The parts swing slowly while the pet is calm, and quickly when it is happy; they stay still when it is asleep.
  const lively = ['success', 'finished', 'petted', 'giggle', 'delighted', 'permission'].includes(state)
  const swinging = !reduced && state !== 'disconnected'
  const partsMarkup = parts.map((part, n) => `<g class="pt pt${n}">${rectsMarkup(rects(part.canvas, box), palette)}</g>`).join('')
  const partsCss = swinging && parts.length
    ? `@media (prefers-reduced-motion:no-preference){.pt{transform-box:view-box;animation-duration:${lively ? 0.45 : 3.2}s;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}` +
      parts.map((part, n) => `.pt${n}{transform-origin:${f1(part.pivot[0] - box.x)}px ${f1(part.pivot[1] - box.y)}px;animation-name:pt${n};animation-delay:-${n * 0.7}s}`).join('') + '}' +
      parts.map((part, n) => `@keyframes pt${n}{from{transform:rotate(${-part.swing * (lively ? 1.8 : 1)}deg)}to{transform:rotate(${part.swing * (lively ? 1.8 : 1)}deg)}}`).join('')
    : ''

  // Under the pointer (where the host draws the picture interactively) the pet hops, squashing and stretching on the way.
  const hop = hover && !reduced
  const hopCss = hop ? `@media (prefers-reduced-motion:no-preference){svg:hover .hv{transform-box:view-box;transform-origin:${ox}px ${oy}px;animation:hv .55s ease-out}}@keyframes hv{0%{transform:none}22%{transform:translateY(-3px) scale(.96,1.07)}48%{transform:scale(1.05,.93)}72%{transform:translateY(-1px) scale(.99,1.02)}100%{transform:none}}` : ''
  // A new state arrives with a short pop (a little lift and settle) as the picture is loaded, so a change of state is a gesture
  // and not a swap. Reactions have a motion of their own.
  const pop = !reduced && !REACTIONS.includes(state)
  const popCss = pop ? `@media (prefers-reduced-motion:no-preference){.en{transform-box:view-box;transform-origin:${ox}px ${oy}px;animation:en .32s ease-out}}@keyframes en{0%{transform:translateY(-2.5px) scale(1.04,.96)}55%{transform:translateY(.8px) scale(.99,1.015)}100%{transform:none}}` : ''
  const css = under.css + over.css + moveCss + partsCss + popCss + hopCss
  const still = under.markup + `<g class="mv"${attr3(stillMove)}>${partsMarkup}${over.markup}</g>`
  const body = pop ? `<g class="en">${still}</g>` : still
  const w = box.w * scale
  const h = box.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" height="${h}" shape-rendering="crispEdges">${title ? `<title>${escapeXml(title)}</title>` : ''}${css ? `<style>${css}</style>` : ''}${background ? `<rect x="0" y="0" width="${box.w}" height="${box.h}" fill="${background}"/>` : ''}${hop ? `<g class="hv">${body}</g>` : body}</svg>`
}

const escapeXml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

const svgCache = new Map()

export function petSvg(options) {
  // Building a picture draws every frame of the animation, so the same request is answered from memory.
  const key = JSON.stringify([options.character, options.colors?.body, options.colors?.accent, options.state, options.helpers, options.scale, options.reduced, options.background, options.crop, options.height, options.hover, options.title])
  const known = svgCache.get(key)
  if (known) return known
  const svg = buildSvg(options)
  if (svgCache.size > 60) svgCache.delete(svgCache.keys().next().value)
  svgCache.set(key, svg)
  return svg
}

// ---- frame stepping (terminals) --------------------------------------------------------------------------------

/** What a terminal needs to draw one moment of one state. */
export function terminalFrame({ character, colors = {}, state, helpers = 0, elapsed = 0, reduced = false, columns = Infinity, rows = Infinity }) {
  const anim = animation(state, { helpers, character })
  const palette = buildPalette(character, colors, { gray: anim.gray ? 0.8 : 0 })
  const step = reduced ? { index: anim.still, pose: anim.frames[anim.still].pose, until: Infinity } : frameAt(anim, elapsed)
  const canvas = drawScene(character, step.pose)
  const box = stageBounds()
  const factor = fitFactor(box.w, columns, box.h, rows)
  return { canvas, palette, box, factor, index: step.index, until: step.until, ...toCells(canvas, palette, box, factor) }
}
