// Small vector charts for the statistics: a bar chart of the last days. Plain SVG with a tooltip on every bar, no scripts.

const ACCENT = '#58a6ff'
const TODAY = '#3fb950'
const EMPTY = '#30363d'
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

/**
 * Tool calls per day as bars; the last bar (today) is green. A day without activity is a thin grey stub, so a gap reads as a gap.
 * @param {{ day: string, tools: number }[]} days oldest first
 * @returns {string} an SVG document of `width` x `height` pixels
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rects.join('')}</svg>`
}
