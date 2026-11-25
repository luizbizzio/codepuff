// The card frames: how the pet card looks around its edge (see card.js), and, once every achievement is unlocked, how the compact band
// can be framed too. A card is an SVG, so it can have gradients and a glow; the band is made of the host's boxes, which have one solid
// color for their border, so a frame there is that frame's main color on its background.

/** How each frame looks on the card: the background (two colors, top left to bottom right), the border, and a few extras. */
export const FRAME_STYLES = Object.freeze({
  gold: { bg: ['#1c1608', '#0d0a03'], stroke: '#f2c14e', width: 5, inner: '#8a6a14' },
  rainbow: { bg: ['#161b22', '#0d1117'], stroke: 'url(#rainbow)', width: 6 },
  pixel: { bg: ['#161b22', '#0d1117'], stroke: '#58a6ff', width: 8, dash: '12 8' },
  neon: { bg: ['#05070d', '#05070d'], stroke: '#39ff9c', width: 3, glow: '#39ff9c' },
  ocean: { bg: ['#0b2a4a', '#06121f'], stroke: '#5ad1e6', width: 3 },
  sunset: { bg: ['#3b1030', '#1a0a1f'], stroke: '#ff9a6b', width: 3 },
  aurora: { bg: ['#0b1f2a', '#120b2a'], stroke: 'url(#aurora)', width: 4 },
  crystal: { bg: ['#0e2230', '#07131c'], stroke: '#9ee7ff', width: 4, inner: '#3b6e86' },
})
export const STANDARD_FRAME = Object.freeze({ bg: ['#161b22', '#0d1117'], stroke: '#30363d', width: 2 })

/** The border color, the background and the line style of the compact band for a frame. The color and the background are the frame's
 *  own; the line style is a name from the host's own set, so each frame also looks different in its outline. */
const BAND = {
  gold: ['#f2c14e', '#1c1608', 'double'],
  rainbow: ['#c77dff', '#161b22', 'round'],
  pixel: ['#58a6ff', '#161b22', 'classic'],
  neon: ['#39ff9c', '#05070d', 'bold'],
  ocean: ['#5ad1e6', '#0b2a4a', 'round'],
  sunset: ['#ff9a6b', '#3b1030', 'single'],
  aurora: ['#59e0c5', '#0b1f2a', 'round'],
  crystal: ['#9ee7ff', '#0e2230', 'double'],
}

/** @returns {{ border: string, background: string, line: string } | null} */
export const bandStyle = id => (Object.hasOwn(BAND, id) ? { border: BAND[id][0], background: BAND[id][1], line: BAND[id][2] } : null)
