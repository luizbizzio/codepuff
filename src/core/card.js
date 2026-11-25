// The pet card: one small, animated SVG with the pet and a few of its numbers, to keep or to share. It holds only what the pet shows
// anyway (its name, how long you have been together, the streak, the counts, the hearts); never a project name, a path or a prompt.

import { FRAME_STYLES, STANDARD_FRAME } from './frames.js'
import { heartsSvg } from './render/charts.js'
import { petSvg } from './render/raster.js'
import { t } from './i18n/index.js'

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

/** Puts a position on an SVG document so it can sit inside another one. */
const placed = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `)

/**
 * @param {{ name: string, character: string, colors?: object, worn?: string | null, motion?: string, hearts: number, streak: number, ageDays: number,
 *   prompts: number, tools: number, done: number, total: number }} card
 * @returns {string} an SVG document, 640 by 340
 */
export function cardSvg({ name, character, colors = {}, worn = null, frame = null, motion = 'calm', hearts, streak, ageDays, prompts, tools, done, total }) {
  const pet = petSvg({ character, colors, worn, state: 'idle', motion, height: 200, crop: 'band' })
  const heartsBar = heartsSvg(Math.max(1, Math.min(5, hearts)))
  const style = FRAME_STYLES[frame] ?? STANDARD_FRAME
  const line = (y, text, size, fill, weight = 400) => `<text x="300" y="${y}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escape(text)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 340" width="640" height="340">
<title>${escape(name)}</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${style.bg[0]}"/><stop offset="1" stop-color="${style.bg[1]}"/></linearGradient>
<linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5d5d"/><stop offset="0.17" stop-color="#ff9a3c"/><stop offset="0.34" stop-color="#ffe066"/><stop offset="0.51" stop-color="#5de08a"/><stop offset="0.68" stop-color="#5ad1e6"/><stop offset="0.85" stop-color="#7c8cff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>
<linearGradient id="aurora" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#59e0c5"/><stop offset="0.5" stop-color="#7c8cff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>
<filter id="glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect x="6" y="6" width="628" height="328" rx="22" fill="url(#bg)"/>
<rect x="6" y="6" width="628" height="328" rx="${style.dash ? 0 : 22}" fill="none" stroke="${style.stroke}" stroke-width="${style.width}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''}${style.glow ? ' filter="url(#glow)"' : ''}/>
${style.inner ? `<rect x="16" y="16" width="608" height="308" rx="14" fill="none" stroke="${style.inner}" stroke-width="1.5"/>` : ''}
${placed(pet, 36, 70)}
${line(78, name, 34, '#f0f6fc', 700)}
${line(106, t('card.together', { age: t('unit.day', { n: ageDays }) }), 16, '#8b949e')}
${placed(heartsBar.replace('width="84" height="15"', 'width="126" height="22"'), 300, 124)}
${line(190, `🔥 ${t('unit.day', { n: streak })}`, 20, '#f0f6fc')}
${line(222, `💬 ${t('unit.prompt', { n: prompts })}`, 20, '#f0f6fc')}
${line(254, `🛠 ${t('card.tasks', { n: tools })}`, 20, '#f0f6fc')}
${line(286, `🏆 ${t('card.achievements', { done, total })}`, 20, '#f0f6fc')}
<text x="616" y="322" text-anchor="end" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#6e7681">CodePuff</text>
</svg>
`
}
