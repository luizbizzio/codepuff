// Achievement badges: a round medal in pixel art (the same crisp look as the pets), one icon for what is counted and a metal for how
// far along it is (bronze, silver, gold, diamond). A badge that is not reached yet is grey with a padlock. Plain SVG, no script, no fonts.

const GRID = 20

/** The icons, 10 by 10: "#" is the dark line, "o" a lighter touch. */
const ICONS = {
  tools: [ // a gear
    '....##....',
    '.#.####.#.',
    '.########.',
    '.###oo###.',
    '####oo####',
    '####oo####',
    '.###oo###.',
    '.########.',
    '.#.####.#.',
    '....##....',
  ],
  streak: [ // a flame
    '....#.....',
    '....##....',
    '...###.#..',
    '..####.##.',
    '..#######.',
    '.####o####',
    '.###ooo###',
    '.###ooo###',
    '..##ooo##.',
    '...#####..',
  ],
  prompts: [ // a speech bubble
    '..........',
    '.########.',
    '.#oooooo#.',
    '.#o#oo#o#.',
    '.#oooooo#.',
    '.#oooooo#.',
    '.########.',
    '...##.....',
    '..##......',
    '..#.......',
  ],
  tests: [ // a check mark
    '..........',
    '........##',
    '.......###',
    '......###.',
    '##...###..',
    '###.###...',
    '.#####....',
    '..###.....',
    '...#......',
    '..........',
  ],
  commits: [ // a commit on its line
    '..........',
    '..........',
    '...####...',
    '..#oooo#..',
    '###oooo###',
    '###oooo###',
    '..#oooo#..',
    '...####...',
    '..........',
    '..........',
  ],
}

ICONS.files = [ // a page with its corner folded and lines of text
  '.#####....',
  '.#ooo##...',
  '.#ooo#o#..',
  '.#ooo####.',
  '.#oooooo#.',
  '.#o####o#.',
  '.#oooooo#.',
  '.#o####o#.',
  '.#oooooo#.',
  '.########.',
]
ICONS.lines = [ // code brackets
  '..........',
  '...#..#...',
  '..#....#..',
  '.#......#.',
  '#...oo...#',
  '#...oo...#',
  '.#......#.',
  '..#....#..',
  '...#..#...',
  '..........',
]
ICONS.days = [ // a calendar
  '.#......#.',
  '##########',
  '#oooooooo#',
  '#o#o#o#oo#',
  '#oooooooo#',
  '#o#o#o#oo#',
  '#oooooooo#',
  '#o#o##ooo#',
  '#oooooooo#',
  '##########',
]
ICONS.time = [ // a clock
  '...####...',
  '..#oooo#..',
  '.#ooo#oo#.',
  '#oooo#ooo#',
  '#oooo#ooo#',
  '#oooo###o#',
  '#oooooooo#',
  '.#oooooo#.',
  '..#oooo#..',
  '...####...',
]
ICONS.helpers = [ // a little helper with an antenna
  '....##....',
  '....##....',
  '.########.',
  '#oooooooo#',
  '#o##oo##o#',
  '#o##oo##o#',
  '#oooooooo#',
  '#o#o##o#o#',
  '.########.',
  '..........',
]
ICONS.projects = [ // a folder
  '..........',
  '.####.....',
  '.#oo#####.',
  '.#oooooo#.',
  '.#oooooo#.',
  '.#oooooo#.',
  '.#oooooo#.',
  '.#oooooo#.',
  '.########.',
  '..........',
]

const LOCK = [
  '..###..',
  '.#...#.',
  '.#...#.',
  '#######',
  '#######',
  '###.###',
  '#######',
  '#######',
]

/** [dark outline, body, light highlight] for each metal, and for a badge not reached. */
const METALS = [
  ['#7a4a1f', '#cd8b4a', '#f0b887'], // bronze
  ['#6b7685', '#c3cad4', '#f2f5f9'], // silver
  ['#a8760f', '#f2c14e', '#fff2b0'], // gold
  ['#1f7f9c', '#5ad1e6', '#d3f7ff'], // diamond
]
const GREY = ['#2a3038', '#3b424c', '#4d5561']
const INK = '#1b1f27'

export const BADGE_KINDS = Object.freeze(Object.keys(ICONS))
/** The body color of each metal (bronze, silver, gold, diamond), for anything small that has to match a badge. */
export const TIER_COLORS = Object.freeze(METALS.map(metal => metal[1]))
export const TIER_NAMES = Object.freeze(['bronze', 'silver', 'gold', 'diamond'])

/**
 * One badge as an SVG document.
 * @param {{ kind: string, tier?: number, reached?: boolean, size?: number, title?: string }} badge size is the width in pixels (a multiple of 20 stays sharp)
 */
export function achievementSvg({ kind, tier = 0, reached = true, size = 80, title }) {
  const icon = ICONS[kind] ?? ICONS.tools
  const metal = reached ? METALS[Math.max(0, Math.min(3, tier | 0))] : GREY
  const [dark, body, light] = metal
  const byColor = new Map()
  const put = (x, y, color) => { if (!byColor.has(color)) byColor.set(color, []); byColor.get(color).push(`M${x} ${y}h1v1h-1z`) }

  const c = (GRID - 1) / 2
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d > c + 0.5) continue
      if (d > c - 1) put(x, y, dark)
      else if (d > c - 2.2 && x + y < GRID - 2) put(x, y, light)
      else put(x, y, body)
    }
  }
  // The icon: dark lines, and lighter touches where the pattern has them.
  icon.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '#') put(5 + i, 5 + j, reached ? INK : '#1c2128')
    if (ch === 'o') put(5 + i, 5 + j, reached ? light : '#3b424c')
  }))
  if (reached && tier === 3) for (const [x, y] of [[2, 3], [17, 4], [3, 16], [16, 15]]) put(x, y, '#ffffff')
  if (!reached) LOCK.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') put(12 + i, 11 + j, '#8b949e') }))

  const paths = [...byColor].map(([color, list]) => `<path fill="${color}" d="${list.join('')}"/>`).join('')
  const label = title ? `<title>${String(title).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch])}</title>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}" shape-rendering="crispEdges">${label}${paths}</svg>`
}
