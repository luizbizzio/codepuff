// A small pie chart of how tasks went: the share that succeeded and the share that failed, as vector shapes. The numbers come
// from what the agent itself reported (every tool call's success or failure); nothing is estimated.

const GOOD = '#3fb950'
const BAD = '#f85149'
const EMPTY = '#30363d'

const n = value => String(Math.round(value * 100) / 100)

/**
 * @param {{ ok: number, failed: number, size?: number }} data
 * @returns {string} an SVG document, `size` pixels square
 */
export function pieSvg({ ok, failed, size = 40, title }) {
  const total = ok + failed
  const r = size / 2 - 1
  const c = size / 2
  let body
  if (total === 0) body = `<circle cx="${n(c)}" cy="${n(c)}" r="${n(r - 0.5)}" fill="none" stroke="${EMPTY}" stroke-width="2"/>`
  else if (failed === 0) body = `<circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="${GOOD}"/>`
  else if (ok === 0) body = `<circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="${BAD}"/>`
  else {
    // Successes first, clockwise from the top; failures take the rest.
    const angle = (ok / total) * Math.PI * 2
    const x = c + r * Math.sin(angle)
    const y = c - r * Math.cos(angle)
    const large = angle > Math.PI ? 1 : 0
    body = `<path d="M${n(c)} ${n(c)}L${n(c)} ${n(c - r)}A${n(r)} ${n(r)} 0 ${large} 1 ${n(x)} ${n(y)}Z" fill="${GOOD}"/>` +
      `<path d="M${n(c)} ${n(c)}L${n(x)} ${n(y)}A${n(r)} ${n(r)} 0 ${1 - large} 1 ${n(c)} ${n(c - r)}Z" fill="${BAD}"/>` +
      `<path d="M${n(c)} ${n(c)}L${n(c)} ${n(c - r)}M${n(c)} ${n(c)}L${n(x)} ${n(y)}" stroke="#0d1117" stroke-width="1.2"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${title ? `<title>${String(title).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])}</title>` : ''}${body}</svg>`
}

