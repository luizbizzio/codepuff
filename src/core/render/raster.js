// Frames -> things a host can draw. Three outputs from one frame:
//   svg    vector markup with CSS keyframes, for the Claude desktop pane and the web UI (no JavaScript runs)
//   cells  half-block terminal cells, as the packed form Claude Code's `Raster` element takes
//   ansi   the same cells as escape sequences, for the companion terminal
// All three read the same canvas, so what you see is the same drawing everywhere.

import { buildPalette, toHex } from '../art/palette.js'
import { drawScene } from '../art/scene.js'
import { REACTIONS, animation, frameAt } from '../art/anim.js'
import { Canvas, R } from '../art/canvas.js'
import { STAND } from '../art/scene.js'
import { STATES } from '../petstate.js'

/** Renders one pose to a canvas. */
export const renderPose = (character, pose) => drawScene(character, pose)

// ---- bounds ----------------------------------------------------------------------------------------------


/**
 * The frame every character is drawn in. It is the same for all of them (and for every state), so changing character
 * never changes the size of the picture, and the pet stands on the same line whoever it is. `scripts/stage-box.mjs`
 * measures it; the characters test fails if a character, a state or a frame ever draws outside it.
 */
export const STAGE = Object.freeze({ x: 0, y: 0, w: 72, h: 68 })

const f1 = n => String(Math.round(n * 10) / 10)
const bandBoxes = new Map()
const ESSENTIAL = new Set(['dots', 'thought', 'excl', 'alert', 'spinner', 'sweat'])

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
 * The pet as an SVG document. Animation is pure CSS (`steps`), so the host animates it with no
 * scripting and no repaint cost on our side; reduced motion shows the still frame.
 * @param {{ character: string, colors?: { body?: string | null, accent?: string | null }, state: string, helpers?: number, scale?: number, reduced?: boolean, pose?: object }} options
 */
function buildSvg({ character, colors = {}, state, helpers = 0, scale = 4, reduced = false, background, crop, height, hover = false }, still) {
  const anim = animation(state, { helpers, character })
  const palette = buildPalette(character, colors, { gray: anim.gray ? 0.8 : 0 })
  const box = crop === 'band' ? bandBox(character, helpers > 0) : STAGE
  if (height) scale = height / box.h

  // Every distinct frame, once. What is the same in all of them (the body) is drawn once as a base layer; each frame then
  // adds only what differs (a face, a prop, an effect, a squashed body). That keeps a detailed picture far under the host's limit.
  const unique = []
  const bySignature = new Map()
  const spans = [] // [frame index, start ms, end ms]
  let at = 0
  for (const item of anim.frames) {
    // `still` keeps the body where it is (no hop, squash or shake) so that frames differ only by face, props and effects.
    const base0 = still ? { ...item.pose, dy: 0, sx: 1, sy: 1, shake: 0 } : item.pose
    const canvas = drawScene(character, base0)
    const signature = canvas.px.join(',')
    let index = bySignature.get(signature)
    if (index === undefined) { index = unique.length; bySignature.set(signature, index); unique.push(canvas) }
    spans.push([index, at, at + item.d])
    at += item.d
  }
  const animatedFrames = !reduced && unique.length > 1
  let base
  if (animatedFrames) {
    base = new Canvas()
    for (let i = 0; i < base.px.length; i++) { const role = unique[0].px[i]; if (role && unique.every(u => u.px[i] === role)) base.px[i] = role }
  }
  const layerOf = canvas => {
    if (!base) return canvas
    const layer = new Canvas()
    for (let i = 0; i < layer.px.length; i++) if (canvas.px[i] && !base.px[i]) layer.px[i] = canvas.px[i]
    return layer
  }
  const groups = unique.map(canvas => rectsMarkup(rects(layerOf(canvas), box), palette))
  const baseMarkup = base ? rectsMarkup(rects(base, box), palette) : ''
  const stillIndex = spans[Math.min(anim.still, spans.length - 1)][0]
  const animated = !reduced && groups.length > 1
  let css = ''
  if (animated) {
    const total = anim.total
    css = '<style>.g{visibility:hidden}.s{visibility:visible}@media (prefers-reduced-motion:no-preference){' +
      groups.map((_, i) => `.g${i}{animation:a${i} ${total}ms step-end infinite}`).join('') + '}' +
      groups.map((_, i) => {
        const points = spans.filter(span => span[0] === i).flatMap(([, s, e]) => [[s, 'visible'], [e, 'hidden']])
        const merged = new Map()
        for (const [ms, value] of points) merged.set(ms, merged.get(ms) === 'visible' ? 'visible' : value)
        if (!merged.has(0)) merged.set(0, 'hidden')
        // A span that ends exactly where another of the same group starts keeps the group visible.
        const keyframes = [...merged].sort((a, b) => a[0] - b[0]).filter(([ms]) => ms < total)
        return `@keyframes a${i}{${keyframes.map(([ms, value]) => `${((ms / total) * 100).toFixed(3)}%{visibility:${value}}`).join('')}}`
      }).join('') + '</style>'
  }
  const body = animated
    ? `<g>${baseMarkup}</g>` + groups.map((markup, i) => `<g class="g g${i}${i === stillIndex ? ' s' : ''}">${markup}</g>`).join('')
    : `<g>${groups[stillIndex]}</g>`
  // Under the pointer (where the host draws the picture interactively) the pet hops, squashing and stretching on the way.
  const hop = hover && !reduced
  const hopCss = hop ? `<style>@media (prefers-reduced-motion:no-preference){svg:hover .hv{transform-box:view-box;transform-origin:${f1(36 - box.x)}px ${f1(STAND - box.y)}px;animation:hv .55s ease-out}}@keyframes hv{0%{transform:none}22%{transform:translateY(-3px) scale(.96,1.07)}48%{transform:scale(1.05,.93)}72%{transform:translateY(-1px) scale(.99,1.02)}100%{transform:none}}</style>` : ''
  const w = box.w * scale
  const h = box.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" height="${h}" shape-rendering="crispEdges">${css}${hopCss}${background ? `<rect x="0" y="0" width="${box.w}" height="${box.h}" fill="${background}"/>` : ''}${hop ? `<g class="hv">${body}</g>` : body}</svg>`
}

/** The SVG budget: the host takes at most 131072 characters, so a picture that would exceed this keeps its body still. */
const SVG_BUDGET = 118_000

const svgCache = new Map()

export function petSvg(options) {
  // Building a picture draws every frame of the animation, so the same request is answered from memory.
  const key = JSON.stringify([options.character, options.colors?.body, options.colors?.accent, options.state, options.helpers, options.scale, options.reduced, options.background, options.crop, options.height, options.hover])
  const known = svgCache.get(key)
  if (known) return known
  const full = buildSvg(options, false)
  const svg = full.length <= SVG_BUDGET ? full : buildSvg(options, true)
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
