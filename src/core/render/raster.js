// Frames -> things a host can draw. Three outputs from one frame:
//   svg    vector markup with CSS keyframes, for the Claude desktop pane and the web UI (no JavaScript runs)
//   cells  half-block terminal cells, as the packed form Claude Code's `Raster` element takes
//   ansi   the same cells as escape sequences, for the companion terminal
// All three read the same canvas, so what you see is the same drawing everywhere.

import { buildPalette, toHex } from '../art/palette.js'
import { drawScene } from '../art/scene.js'
import { animation, frameAt } from '../art/anim.js'
import { W, H } from '../art/canvas.js'

/** Renders one pose to a canvas. */
export const renderPose = (character, pose, style = 'pixel') => drawScene(character, pose, style)

// ---- bounds ----------------------------------------------------------------------------------------------

const boundsCache = new Map()
const ALL_STATES = ['idle', 'thinking', 'reading', 'searching', 'coding', 'running', 'testing', 'web', 'delegating', 'planning', 'success', 'error', 'investigating', 'waiting', 'permission', 'finished', 'disconnected']

/**
 * The smallest box that holds every pixel of every frame of every state, so size never jumps.
 * `wide` also leaves room for the subagent helpers at the edges; without helpers the box is narrower, which
 * matters in a narrow terminal pane.
 */
export function stageBounds(character, wide = true, style = 'pixel') {
  const cacheKey = character + (wide ? ':wide' : ':narrow') + ':' + style
  const hit = boundsCache.get(cacheKey)
  if (hit) return hit
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1
  for (const state of ALL_STATES) {
    for (const helpers of wide ? [0, 3] : [0]) {
      for (const { pose } of animation(state, { helpers }).frames) {
        const c = drawScene(character, pose, style)
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c.px[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      }
    }
  }
  // Round to whole terminal rows (two pixels each) so half-blocks line up.
  y0 -= y0 % 2
  if ((y1 - y0 + 1) % 2) y1++
  const box = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(W, x1 + 1) - Math.max(0, x0), h: Math.min(H, y1 + 1) - Math.max(0, y0) }
  boundsCache.set(cacheKey, box)
  return box
}

/**
 * The head and shoulders only, for the compact band above the prompt: the top of the character's idle drawing,
 * cut to the rows that hold its face.
 */
export function headBounds(character, style = 'pixel') {
  const key = character + ':head:' + style
  const hit = boundsCache.get(key)
  if (hit) return hit
  const c = drawScene(character, animation('idle').frames[0].pose, style)
  let x0 = W; let y0 = H; let x1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c.px[y * W + x] && c.px[y * W + x] !== 30) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y) }
  const rows = 36
  const box = { x: x0, y: y0, w: x1 - x0 + 1, h: Math.min(rows, H - y0) }
  boundsCache.set(key, box)
  return box
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

/** The smallest shrink factor (1, 1.5, 2, 3, 4) at which a picture  pixels wide fits  terminal columns. */
export const fitFactor = (width, columns, height = 0, rows = Infinity) => [1, 1.5, 2, 3, 4].find(f => Math.ceil(width / f) <= columns && Math.ceil(Math.ceil(height / f) / 2) <= rows) ?? 4

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
export function petSvg({ character, colors = {}, state, helpers = 0, scale = 4, reduced = false, background, style = 'pixel', crop }) {
  const anim = animation(state, { helpers })
  const palette = buildPalette(character, colors, { gray: anim.gray ? 0.8 : 0 })
  const box = crop === 'head' ? headBounds(character, style) : stageBounds(character, helpers > 0, style)

  const groups = [] // unique drawings
  const bySignature = new Map()
  const spans = [] // [group index, start ms, end ms]
  let at = 0
  for (const item of anim.frames) {
    const canvas = drawScene(character, crop === 'head' ? { ...item.pose, prop: null, fx: [], helpers: 0 } : item.pose, style)
    const signature = canvas.px.join(',')
    let index = bySignature.get(signature)
    if (index === undefined) { index = groups.length; bySignature.set(signature, index); groups.push(rectsMarkup(rects(canvas, box), palette)) }
    spans.push([index, at, at + item.d])
    at += item.d
  }
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
    ? groups.map((markup, i) => `<g class="g g${i}${i === stillIndex ? ' s' : ''}">${markup}</g>`).join('')
    : `<g>${groups[stillIndex]}</g>`
  const w = box.w * scale
  const h = box.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" height="${h}" shape-rendering="crispEdges">${css}${background ? `<rect width="${box.w}" height="${box.h}" fill="${background}"/>` : ''}${body}</svg>`
}

// ---- frame stepping (terminals) --------------------------------------------------------------------------------

/** What a terminal needs to draw one moment of one state. */
export function terminalFrame({ character, colors = {}, state, helpers = 0, elapsed = 0, reduced = false, style = 'pixel', columns = Infinity, rows = Infinity }) {
  const anim = animation(state, { helpers })
  const palette = buildPalette(character, colors, { gray: anim.gray ? 0.8 : 0 })
  const step = reduced ? { index: anim.still, pose: anim.frames[anim.still].pose, until: Infinity } : frameAt(anim, elapsed)
  const canvas = drawScene(character, step.pose, style)
  const box = stageBounds(character, helpers > 0, style)
  const factor = fitFactor(box.w, columns, box.h, rows)
  return { canvas, palette, box, factor, index: step.index, until: step.until, ...toCells(canvas, palette, box, factor) }
}
