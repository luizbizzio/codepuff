// Small vector charts for the statistics: a bar chart of the last days. Plain SVG with a tooltip on every bar, no scripts.

import { shortDay } from '../format.js'

const ACCENT = '#58a6ff'
const TODAY = '#3fb950'
const EMPTY = '#30363d'
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

/**
 * Tool calls per day as bars; the last bar (today) is green. A day without activity is a thin grey stub, so a gap reads as a gap.
 * @param {{ day: string, tools: number }[]} days oldest first
 * Under the bars: the first day, "today", and the busiest day's number of calls.
 * @returns {string} an SVG document, `width` pixels wide and `height` + 12 tall (the bars are `height` tall, the labels take the rest)
 */
export function activitySvg(days, { width = 280, height = 64 } = {}) {
  const count = Math.max(1, days.length)
  const gap = 3
  const bar = Math.max(2, (width - gap * (count - 1)) / count)
  const peak = Math.max(1, ...days.map(d => d.tools))
  const top = 4
  const room = height - top - 2
  const rects = days.map((d, i) => {
    const h = d.tools > 0 ? Math.max(3, Math.round((d.tools / peak) * room)) : 2
    const x = Math.round(i * (bar + gap) * 10) / 10
    const fill = d.tools === 0 ? EMPTY : i === days.length - 1 ? TODAY : ACCENT
    return `<rect x="${x}" y="${height - 1 - h}" width="${Math.round(bar * 10) / 10}" height="${h}" rx="1.5" fill="${fill}"><title>${esc(d.day)}: ${d.tools} tool call${d.tools === 1 ? '' : 's'}</title></rect>`
  })
  const label = (x, anchor, text) => `<text x="${x}" y="${height + 10}" text-anchor="${anchor}" font-family="system-ui, sans-serif" font-size="9" fill="#8b949e">${esc(text)}</text>`
  const first = days.length ? shortDay(days[0].day) : ''
  const labels = [first ? label(0, 'start', first) : '', days.length ? label(width, 'end', 'today') : '', peak > 1 || days.some(d => d.tools > 0) ? label(width / 2, 'middle', `busiest: ${peak.toLocaleString('en-US')}`) : ''].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 12}" width="${width}" height="${height + 12}">${rects.join('')}${labels}</svg>`
}

const HEART = 'M7 12.6C2.2 8.9 0.6 6.2 0.6 4.2A3.3 3.3 0 0 1 7 2.8 3.3 3.3 0 0 1 13.4 4.2C13.4 6.2 11.8 8.9 7 12.6Z'

/**
 * Five hearts, `hearts` of them filled (red) and the rest outlined, with a tooltip. The same picture as the row of ♥ and ♡ used
 * in a terminal, but it can say what the hearts mean when the pointer rests on them.
 * @returns {string} an SVG document, 84 x 15 pixels
 */
export function heartsSvg(hearts, { title } = {}) {
  const parts = Array.from({ length: 5 }, (_, i) => {
    const filled = i < hearts
    return `<path transform="translate(${i * 17} 0.5)" d="${HEART}" fill="${filled ? '#f85149' : 'none'}" stroke="${filled ? '#f85149' : '#6e7681'}" stroke-width="1.2" stroke-linejoin="round"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 15" width="84" height="15">${title ? `<title>${esc(title)}</title>` : ''}${parts.join('')}</svg>`
}
