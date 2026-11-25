// Accessories: small pixel pieces worn on the head or the face. They are placed by the character's `head` anchor (in canvas pixels):
//   { cx, top, eyeY, gap }   the middle of the face, the top of the head there, the row of the eyes, half the space between the eyes
// so the same piece sits right on every character, whatever its shape. Drawn over the body, before what the pet holds.

import { Canvas, R } from './canvas.js'

const ROLE = {
  A: R.PINK, B: R.BLU, Y: R.YEL, W: R.WHITE, G: R.GOLD, g: R.GOLD2, R: R.RED, K: R.NAVY2, N: R.NAVY, H: R.METAL, P: R.PINK, T: R.TEAL, S: R.GRN, D: R.BROWN,
}

/** Pieces drawn from a few rows of text: [rows, where the piece sits (x from its centre, y from the top of the head), outline]. */
const PIECES = {
  party: [[
    '.....Y.....',
    '.....A.....',
    '....AAA....',
    '....BBB....',
    '...AAAAA...',
    '...BBBBB...',
    '..AAAAAAA..',
    '..BBBBBBB..',
    '.AAAAAAAAA.',
  ], 0, 2, true],
  tophat: [[
    '..KKKKKKKK..',
    '..KHKKKKKK..',
    '..KHKKKKKK..',
    '..KKKKKKKK..',
    '..RRRRRRRR..',
    '..KKKKKKKK..',
    'KKKKKKKKKKKK',
  ], 0, 2, true],
  cap: [[
    '...BBBBBB.......',
    '..BBBBBBBB......',
    '.BBBBBBBBBB.....',
    '.BBBBBBBBBBNNNN.',
    '.NNNNNNNNNNNNNN.',
  ], 1, 2, true],
  crown: [[
    'G...G...G',
    'GG.GGG.GG',
    'GGGGGGGGG',
    'GRGGYGGRG',
    'GGGGGGGGG',
  ], 0, 2, true],
  halo: [[
    '..GGGGGGGGGG..',
    '.GYYYYYYYYYYG.',
    'GYY........YYG',
    '.GYYYYYYYYYYG.',
    '..GGGGGGGGGG..',
  ], 0, -4, false],
  beret: [[
    '......R......',
    '...RRRRRRR...',
    '.RRRRRRRRRRR.',
    'RRRRRRRRRRRRR',
  ], 2, 2, true],
  chef: [[
    '.WWW.WWW.WW.',
    'WWWWWWWWWWWW',
    'WWWWWWWWWWWW',
    'WWWWWWWWWWWW',
    '.WWWWWWWWWW.',
    '.WWWWWWWWWW.',
    '.HHHHHHHHHH.',
  ], 0, 2, true],
  bunny: [[
    '.WW......WW.',
    'WPPW....WPPW',
    'WPPW....WPPW',
    'WPPW....WPPW',
    'WPPW....WPPW',
    'WPPW....WPPW',
    'WPPW....WPPW',
    '.WW......WW.',
  ], 0, 3, true],
  pirate: [[
    '.....KKKKKK.....',
    '...KKKKKKKKKK...',
    '..KKKKKWWKKKKK..',
    '.KKKKKWKKWKKKKK.',
    'KKKKKKKWWKKKKKKK',
    'KGGGGGGGGGGGGGGK',
    'K..............K',
  ], 0, 2, true],
  cowboy: [[
    '.....DDDDDDDD.....',
    '....DDDDDDDDDD....',
    '....DDDDDDDDDD....',
    '....DDDDDDDDDD....',
    '....GGGGGGGGGG....',
    '.DDDDDDDDDDDDDDDD.',
    'DD..............DD',
  ], 0, 2, true],
  viking: [[
    'W..........W',
    'WW........WW',
    '.WW.HHHH.WW.',
    '..WHHHHHHW..',
    '...HHHHHH...',
    '...HHHHHH...',
    '...gggggg...',
  ], 0, 2, true],
  graduation: [[
    '......KK......',
    '....KKKKKK....',
    '..KKKKKKKKKK..',
    'KKKKKKKKKKKKKK',
    '..KKKKKKKKKK.G',
    '....KKKKKK..G.',
    '..........GGG.',
  ], 0, 3, true],
  flower: [[
    '.PP.PP.',
    'PPPPPPP',
    'PPPYPPP',
    'PPYYYPP',
    'PPPYPPP',
    'PPPPPPP',
    '.PP.PP.',
    '...S...',
    '..SS...',
  ], 5, 4, true],
  bow: [[
    '.PP.PP.',
    'PPPPPPP',
    'PPPRPPP',
    'PPPPPPP',
    '.PP.PP.',
  ], 3, 3, true],
}

/** The pixels of a piece (with its dark outline) on its own canvas, so the outline never covers the piece itself. */
function piece(rows, x0, y0, outline) {
  const c = new Canvas()
  const at = (x, y) => (x < 0 || y < 0 || x >= c.w || y >= c.h ? 0 : c.px[y * c.w + x])
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ROLE[ch] !== undefined && ch !== '.') c.set(x0 + i, y0 + j, ROLE[ch]) }))
  if (!outline) return c
  const edge = []
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) edge.push([x, y])
  for (const [x, y] of edge) c.set(x, y, R.NAVY2)
  return c
}

/** A ring (a lens frame) of radius r around (x, y). */
function ring(c, x, y, r, role) {
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) { const d = Math.hypot(i, j); if (d <= r + 0.45 && d >= r - 0.85) c.set(Math.round(x + i), Math.round(y + j), role) }
}

/** A monocle on the right eye, with its chain. */
function monocle(c, head) {
  const r = Math.max(3, Math.min(5, Math.round(head.gap * 0.6)))
  const x = Math.round((head.faceX ?? head.cx) + head.gap)
  const y = Math.round(head.eyeY)
  ring(c, x, y, r, R.GOLD2)
  c.set(x - Math.round(r * 0.5), y - Math.round(r * 0.5), R.WHITE)
  for (let i = 0; i < 8; i++) c.set(x + r + Math.round(i * 0.25), y + 1 + i, R.GOLD)
}

function glasses(c, head, dark) {
  const r = Math.max(3, Math.min(5, Math.round(head.gap * 0.55)))
  const lx = Math.round((head.faceX ?? head.cx) - head.gap)
  const rx = Math.round((head.faceX ?? head.cx) + head.gap)
  const y = Math.round(head.eyeY)
  if (dark) {
    for (const x of [lx, rx]) {
      for (let j = -r + 1; j <= r - 1; j++) for (let i = -r; i <= r; i++) if (Math.hypot(i, j * 1.15) <= r + 0.4) c.set(x + i, y + j, R.NAVY2)
      c.set(x - r + 1, y - r + 2, R.WHITE); c.set(x - r + 2, y - r + 3, R.WHITE)
    }
  } else {
    ring(c, lx, y, r, R.GOLD2); ring(c, rx, y, r, R.GOLD2)
    c.set(lx - Math.round(r * 0.5), y - Math.round(r * 0.5), R.WHITE); c.set(rx - Math.round(r * 0.5), y - Math.round(r * 0.5), R.WHITE)
  }
  for (let x = lx + r + 1; x < rx - r; x++) c.set(x, y - 1, dark ? R.NAVY2 : R.GOLD2)
  c.rect(lx - r - 3, y - 1, 3, 1, dark ? R.NAVY2 : R.GOLD2)
  c.rect(rx + r + 1, y - 1, 3, 1, dark ? R.NAVY2 : R.GOLD2)
}

/**
 * Draws one accessory for a head.
 * @param {Canvas} c
 * @param {{ cx: number, top: number, eyeY: number, gap: number }} head
 * @param {string} id
 */
export function drawWorn(c, head, id) {
  if (id === 'glasses') return glasses(c, head, false)
  if (id === 'sunglasses') return glasses(c, head, true)
  if (id === 'monocle') return monocle(c, head)
  const spec = PIECES[id]
  if (!spec) return
  const [rows, dx, dy, outline] = spec
  const width = rows[0].length
  const x0 = Math.round(head.cx - width / 2 + dx)
  const y0 = Math.round(head.top - rows.length + dy)
  c.stamp(piece(rows, x0, y0, outline))
}
