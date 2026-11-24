// A ring chart of how tasks went: the share that succeeded and the share that failed, with the success rate in the middle, as
// vector shapes. The numbers come from what the agent itself reported (every tool call's success or failure); nothing is estimated.

const GOOD = '#3fb950'
const BAD = '#f85149'
const EMPTY = '#30363d'
const TEXT = '#e6edf3'

const n = value => String(Math.round(value * 100) / 100)
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

/**
 * @param {{ ok: number, failed: number, size?: number, title?: string }} data
 * @returns {string} an SVG document, `size` pixels square: a ring (successes green from the top, clockwise; failures red) with
 *   the success rate in the middle, or an empty grey ring and a dash when nothing has been done yet
 */
export function ringSvg({ ok, failed, size = 56, title }) {
  const total = ok + failed
  const stroke = Math.max(4, Math.round(size * 0.17))
  const r = (size - stroke) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const ring = (color, share) => `<circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="none" stroke="${color}" stroke-width="${stroke}"${share < 1 ? ` stroke-dasharray="${n(circumference * share)} ${n(circumference)}" transform="rotate(-90 ${n(c)} ${n(c)})"` : ''}/>`
  let body = ring(EMPTY, 1)
  if (total > 0) body = ring(failed > 0 ? BAD : GOOD, 1) + (failed > 0 && ok > 0 ? ring(GOOD, ok / total) : '')
  const percent = total ? `${Math.floor((ok / total) * 100)}%` : '–'
  const font = Math.round(size * (percent.length > 3 ? 0.2 : 0.24))
  const label = `<text x="${n(c)}" y="${n(c + font * 0.35)}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="${font}" fill="${TEXT}">${percent}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${title ? `<title>${esc(title)}</title>` : ''}${body}${label}</svg>`
}
