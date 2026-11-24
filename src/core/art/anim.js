// Animations: for each pet state, a short loop of poses with durations. A loop is data, not code, so the
// same definition drives the SVG (CSS keyframes, zero JavaScript), the terminal (frame stepping) and the
// tests. Motion is small and every loop has a meaning: it never moves unless the state does.

const P = (over = {}) => ({
  eyes: 'open', brows: 'none', mouth: 'cat', lookX: 0, lookY: 0, cheeks: 'normal',
  dy: 0, sx: 1, sy: 1, shake: 0, hands: 'rest', prop: null, fx: [], led: 'ok', helpers: 0, ...over,
})

const frame = (d, over) => ({ d, pose: P(over) })

const IDLE = [
  frame(1200, { sy: 1 }), frame(1200, { sy: 1.045 }), frame(110, { sy: 1.045, eyes: 'blink' }), frame(1300, { sy: 1 }),
  frame(700, { sy: 1, lookX: -1 }), frame(800, { sy: 1.045, lookX: -1 }), frame(700, { sy: 1.045, lookX: 1 }), frame(800, { sy: 1, lookX: 1 }),
  frame(600, { sy: 1 }), frame(110, { sy: 1, eyes: 'blink' }), frame(1300, { sy: 1.045 }),
]

// What each character does when it has nothing to do: the same calm breathing, in its own manner. Only poses (the engine moves
// the whole body and the face), so every renderer and every character gets them.
const breathe = (d, over = {}) => frame(d, { sy: 1, ...over })
const PERSONALITY = {
  // Curious: sniffs to one side, then the other, with a perk of the ears (a quick stretch).
  fox: [
    breathe(1400), breathe(900, { lookX: -1 }), breathe(130, { lookX: -1, mouth: 'o', dy: -1, sy: 1.03 }), breathe(130, { lookX: -1, mouth: 'o' }), breathe(130, { lookX: -1, mouth: 'o', dy: -1, sy: 1.03 }),
    breathe(900, { lookX: 1 }), breathe(130, { lookX: 1, mouth: 'o', dy: -1, sy: 1.03 }), breathe(130, { lookX: 1, mouth: 'o' }), breathe(900, { eyes: 'open' }),
    breathe(260, { eyes: 'wide', brows: 'up', sy: 1.07, dy: -1 }), breathe(900, { mouth: 'grin', eyes: 'happy' }), breathe(110, { eyes: 'blink' }), breathe(1500, { sy: 1.04 }),
  ],
  // A machine: scans left and right with its status light blinking, then a short beep of a smile.
  bot: [
    breathe(900, { led: 'ok' }), breathe(350, { eyes: 'focus', lookX: -1, led: 'wait' }), breathe(350, { eyes: 'focus', lookX: 0, led: 'ok' }), breathe(350, { eyes: 'focus', lookX: 1, led: 'wait' }), breathe(350, { eyes: 'focus', lookX: 0, led: 'ok' }),
    breathe(1100, { mouth: 'smile', led: 'ok' }), breathe(110, { eyes: 'blink', led: 'ok' }), breathe(1500, { sy: 1.03, led: 'ok' }), breathe(110, { eyes: 'blink', led: 'wait' }), breathe(1300, { led: 'ok' }),
  ],
  // Jelly: wobbles, squashing and stretching in turn, ever smaller.
  slime: [
    breathe(900, { mouth: 'cat' }), breathe(180, { sx: 1.07, sy: 0.93 }), breathe(180, { sx: 0.95, sy: 1.06 }), breathe(180, { sx: 1.04, sy: 0.96 }), breathe(180, { sx: 0.98, sy: 1.02 }),
    breathe(1300), breathe(110, { eyes: 'blink' }), breathe(1100, { sy: 1.05, sx: 0.98 }), breathe(1100, { sy: 1, sx: 1 }), breathe(800, { lookX: 1 }), breathe(800, { lookX: -1 }),
  ],
  // A little magic: a spark now and then, a satisfied smile.
  mage: [
    breathe(1300), breathe(1000, { sy: 1.04 }), breathe(260, { eyes: 'happy', mouth: 'smile', fx: [{ id: 'sparkles', f: 0 }] }), breathe(260, { eyes: 'happy', mouth: 'smile', fx: [{ id: 'sparkles', f: 1 }] }), breathe(260, { eyes: 'happy', mouth: 'smile', fx: [{ id: 'sparkles', f: 2 }] }),
    breathe(260, { eyes: 'open', fx: [{ id: 'sparkles', f: 3 }] }), breathe(900, { lookX: 1 }), breathe(110, { eyes: 'blink' }), breathe(1500, { sy: 1.04 }),
  ],
  // Floats: bobs up and down slowly, as if in water.
  aquatic: [
    breathe(700, { dy: 0 }), breathe(700, { dy: -1 }), breathe(900, { dy: -1.5, mouth: 'smile' }), breathe(700, { dy: -1 }), breathe(700, { dy: 0 }), breathe(110, { eyes: 'blink' }),
    breathe(700, { dy: -0.5, lookX: -1 }), breathe(800, { dy: -1.2, lookX: -1 }), breathe(700, { dy: -0.5, lookX: 1 }), breathe(800, { dy: 0, lookX: 1 }), breathe(1200, { dy: 0 }),
  ],
  // Bright and bouncy: a small bounce, a cheerful grin.
  classic: [
    breathe(1300), breathe(1100, { sy: 1.045 }), breathe(110, { eyes: 'blink' }), breathe(200, { dy: -1.5, sy: 1.05, mouth: 'grin', eyes: 'happy' }), breathe(160, { dy: 0, sy: 0.96 }), breathe(900, { mouth: 'smile' }),
    breathe(700, { lookX: -1 }), breathe(700, { lookX: 1 }), breathe(110, { eyes: 'blink' }), breathe(1300, { sy: 1.045 }),
  ],
  // A tidy little critter: shuffles its feet from side to side, then stands proud.
  claude: [
    breathe(1200), breathe(160, { shake: 0.3 }), breathe(160, { shake: -0.3 }), breathe(160, { shake: 0.3 }), breathe(160, { shake: 0 }), breathe(1000, { sy: 1.04 }),
    breathe(110, { eyes: 'blink' }), breathe(800, { lookX: 1 }), breathe(800, { lookX: -1 }), breathe(1200, { sy: 1.04, mouth: 'smile' }),
  ],
  // Waves a hand now and then.
  alpha: [
    breathe(1300), breathe(1100, { sy: 1.045 }), breathe(110, { eyes: 'blink', sy: 1.045 }), breathe(220, { hands: 'wave', mouth: 'smile' }), breathe(220, { hands: 'rest', mouth: 'smile' }), breathe(220, { hands: 'wave', mouth: 'smile' }), breathe(220, { hands: 'rest' }),
    breathe(900, { lookX: -1 }), breathe(900, { lookX: 1 }), breathe(1200, { sy: 1.04 }),
  ],
}

// Waiting for the user is always a happy face; each character waits in its own way (see PERSONALITY for the idle ones).
const happyWait = (d, over = {}) => frame(d, { eyes: 'open', mouth: 'smile', cheeks: 'bright', sy: 1, ...over })
const WAITING = {
  fox: [happyWait(1000, { lookX: -1 }), happyWait(200, { dy: -1, sy: 1.05, mouth: 'grin', eyes: 'happy' }), happyWait(200, { dy: 0, sy: 0.97 }), happyWait(1000, { lookX: 1 }), happyWait(110, { eyes: 'blink' }), happyWait(1100, { sy: 1.03 })],
  bot: [happyWait(900, { led: 'ok' }), happyWait(400, { lookX: -1, led: 'wait' }), happyWait(400, { lookX: 1, led: 'ok' }), happyWait(110, { eyes: 'blink' }), happyWait(1200, { sy: 1.03, mouth: 'grin', eyes: 'happy' })],
  slime: [happyWait(800), happyWait(220, { sx: 1.06, sy: 0.94 }), happyWait(220, { sx: 0.95, sy: 1.05 }), happyWait(220, { sx: 1.03, sy: 0.97 }), happyWait(1000, { eyes: 'happy', mouth: 'grin' }), happyWait(110, { eyes: 'blink' }), happyWait(900)],
  mage: [happyWait(900), happyWait(300, { eyes: 'happy', fx: [{ id: 'sparkles', f: 0 }] }), happyWait(300, { eyes: 'happy', fx: [{ id: 'sparkles', f: 2 }] }), happyWait(300, { fx: [{ id: 'sparkles', f: 4 }] }), happyWait(110, { eyes: 'blink' }), happyWait(1200, { sy: 1.03 })],
  aquatic: [happyWait(700, { dy: 0 }), happyWait(700, { dy: -1 }), happyWait(900, { dy: -1.5, eyes: 'happy', mouth: 'grin' }), happyWait(700, { dy: -0.5 }), happyWait(110, { eyes: 'blink' }), happyWait(900, { dy: 0, lookX: 1 })],
  classic: [happyWait(900), happyWait(200, { dy: -1.5, sy: 1.05, eyes: 'happy', mouth: 'grin' }), happyWait(160, { sy: 0.96 }), happyWait(900, { lookX: -1 }), happyWait(110, { eyes: 'blink' }), happyWait(1000, { sy: 1.04 })],
  alpha: [happyWait(900), happyWait(220, { hands: 'wave', eyes: 'happy', mouth: 'grin' }), happyWait(220, { hands: 'rest', eyes: 'happy' }), happyWait(220, { hands: 'wave', eyes: 'happy', mouth: 'grin' }), happyWait(220, { hands: 'rest' }), happyWait(1100, { sy: 1.04 }), happyWait(110, { eyes: 'blink' })],
  claude: [happyWait(900), happyWait(160, { shake: 0.3 }), happyWait(160, { shake: -0.3 }), happyWait(160, { shake: 0.3 }), happyWait(160, { shake: 0 }), happyWait(1000, { sy: 1.04, eyes: 'happy', mouth: 'grin' }), happyWait(110, { eyes: 'blink' })],
}

const loops = {
  idle: () => ({ frames: IDLE, still: 0 }),

  // A thought cloud that alternates a light bulb and a turning gear; the eyes look up and aside, the body sways a little.
  // Tired (the plan's limit is nearly used up): half-closed eyes, a yawn, a sweat drop, a slow droop.
  tired: () => ({
    frames: [
      frame(1300, { eyes: 'focus', mouth: 'flat', sy: 0.97, lookY: 1, fx: [{ id: 'sweat', f: 0 }] }),
      frame(900, { eyes: 'sleep', mouth: 'o', sy: 0.95, lookY: 1, fx: [{ id: 'sweat', f: 1 }] }),
      frame(1100, { eyes: 'sleep', mouth: 'flat', sy: 0.96, lookY: 1, fx: [{ id: 'sweat', f: 2 }] }),
      frame(1200, { eyes: 'focus', mouth: 'flat', sy: 0.97, lookY: 1, fx: [{ id: 'sweat', f: 1 }] }),
    ],
    still: 0,
  }),

  thinking: () => ({
    // The body bobs slowly, as if turning the problem over.
    frames: [0, 1, 2, 3, 4, 5].map(f => frame(f % 2 ? 480 : 620, { eyes: 'focus', mouth: 'flat', lookX: 1, lookY: -1, sy: f % 4 < 2 ? 1 : 1.03, dy: [0, -0.5, -0.9, -0.5, 0, 0.2][f], led: 'think', fx: [{ id: 'thought', f }] })),
    still: 2,
  }),

  // The eyes sweep along a line of the book, drop to the next, and a page turns now and then.
  reading: () => {
    const page = (d, f, lookX, extra = {}) => frame(d, { eyes: 'open', lookX, lookY: 1, mouth: 'flat', hands: 'hold', shake: lookX * 0.2, sy: 1.015, prop: { id: 'book', f }, ...extra })
    return {
      frames: [
        page(380, 0, -1), page(380, 0, 0), page(380, 0, 1), page(160, 1, 1), page(160, 2, 1),
        page(380, 3, -1), page(380, 3, 0), page(380, 3, 1), page(110, 3, 1, { eyes: 'blink' }),
      ],
      still: 0,
    }
  },

  searching: () => ({
    frames: [0, 1, 2, 3].map(f => frame(450, { eyes: 'open', lookX: [0, 1, 1, 0][f], mouth: 'flat', hands: 'point', shake: [0, 0.3, 0.3, 0][f], sx: [1, 1.01, 1.01, 1][f], prop: { id: 'magnifier', f } })),
    still: 1,
  }),

  investigating: () => ({
    frames: [0, 1, 2, 3].map(f => frame(450, { eyes: 'open', brows: 'worry', lookX: [0, 1, 1, 0][f], mouth: 'flat', hands: 'point', shake: [0, 0.3, 0.3, 0][f], sy: 0.98, prop: { id: 'magnifier', f }, fx: [{ id: 'quest', f }] })),
    still: 1,
  }),

  coding: () => ({
    frames: Array.from({ length: 8 }, (_, i) => frame(i === 7 ? 260 : 170, { eyes: 'focus', mouth: 'flat', lookY: 1, hands: i % 2 ? 'type1' : 'type0', dy: i % 2 ? -0.5 : 0, sy: i % 2 ? 1.012 : 0.992, prop: { id: 'laptop', f: i >> 1 }, fx: [{ id: 'glyphs', f: i }] })),
    still: 1,
  }),

  running: () => ({
    frames: Array.from({ length: 8 }, (_, i) => frame(i % 2 ? 150 : 230, { eyes: 'focus', mouth: 'flat', lookY: 1, hands: i % 2 ? 'type1' : 'type0', led: 'think', shake: i % 2 ? 0.15 : -0.15, prop: { id: 'shell', f: i >> 1 }, fx: [{ id: 'spinner', f: i }] })),
    still: 1,
  }),

  // git: a commit graph on a small screen (a commit, a branch, a push).
  git: () => ({
    frames: [0, 1, 2, 3, 4, 5].map(f => frame(420, { eyes: 'focus', mouth: f % 3 === 2 ? 'smile' : 'flat', lookY: 1, dy: [0, -0.5, 0, -0.5, 0, -1.2][f], sy: f === 5 ? 1.04 : 1, prop: { id: 'branch', f } })),
    still: 1,
  }),

  // A connected tool (MCP): a plug slides into its socket and sparks.
  mcp: () => ({
    frames: [0, 1, 2, 3].map(f => frame(f === 3 ? 600 : 380, { eyes: 'open', lookX: 1, mouth: f === 3 ? 'smile' : 'flat', shake: [0, 0.15, 0.3, 0][f], dy: f === 3 ? -1.4 : 0, sy: f === 3 ? 1.05 : 1, prop: { id: 'plug', f } })),
    still: 3,
  }),

  testing: () => ({
    frames: Array.from({ length: 6 }, (_, f) => frame(330, { eyes: 'open', lookX: 1, mouth: 'cat', hands: 'rest', sy: [1, 0.97, 0.95, 0.97, 1, 1.035][f], prop: { id: 'flask', f } })),
    still: 2,
  }),

  web: () => ({
    frames: [0, 1, 2, 3].map(f => frame(500, { eyes: 'open', lookX: 1, lookY: -1, mouth: 'cat', shake: [0, 0.2, 0.35, 0.2][f], prop: { id: 'globe', f } })),
    still: 0,
  }),

  delegating: () => ({
    frames: [
      frame(700, { lookX: -1, hands: 'up0', mouth: 'cat', shake: -0.25 }), frame(700, { lookX: 1, hands: 'up1', mouth: 'cat', shake: 0.25 }),
      frame(700, { lookX: -1, hands: 'up1', mouth: 'cat', shake: -0.25 }), frame(700, { lookX: 1, hands: 'up0', mouth: 'cat', shake: 0.25 }),
    ],
    still: 0,
  }),

  planning: () => ({
    frames: [0, 1, 2, 3].map(f => frame(600, { eyes: 'focus', mouth: 'flat', lookX: 1, hands: 'rest', dy: f % 2 ? -0.5 : 0, prop: { id: 'clipboard', f } })),
    still: 3,
  }),

  success: () => ({
    frames: [
      frame(120, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', sy: 0.88, sx: 1.06, fx: [{ id: 'sparkles', f: 0 }] }),
      frame(120, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: -4, sy: 1.08, sx: 0.96, hands: 'up0', fx: [{ id: 'sparkles', f: 1 }], led: 'ok' }),
      frame(160, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: -6, hands: 'up1', fx: [{ id: 'sparkles', f: 2 }] }),
      frame(120, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: -3, hands: 'up0', fx: [{ id: 'sparkles', f: 3 }] }),
      frame(100, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', sy: 0.9, sx: 1.06, fx: [{ id: 'sparkles', f: 4 }] }),
      frame(420, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', fx: [{ id: 'sparkles', f: 5 }, { id: 'rays', f: 5 }] }),
      frame(460, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', sy: 1.045, fx: [{ id: 'sparkles', f: 7 }, { id: 'rays', f: 7 }] }),
    ],
    still: 5,
  }),

  error: () => ({
    frames: [
      // The ! badge stays put the whole time (it does not blink); only the pet flinches, and then settles.
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: -0.6, led: 'error', fx: [{ id: 'sweat', f: 0 }, { id: 'alert', f: 0 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: 0.6, led: 'error', fx: [{ id: 'sweat', f: 0 }, { id: 'alert', f: 0 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: -0.4, led: 'error', fx: [{ id: 'sweat', f: 1 }, { id: 'alert', f: 0 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: 0.4, led: 'error', fx: [{ id: 'sweat', f: 1 }, { id: 'alert', f: 0 }] }),
      frame(900, { eyes: 'wide', brows: 'worry', mouth: 'frown', led: 'error', fx: [{ id: 'sweat', f: 2 }, { id: 'alert', f: 0 }] }),
    ],
    still: 4,
  }),

  // Waiting for the user: a happy face, always (it is glad you are there), with a little breathing, a blink and a beam.
  waiting: () => ({
    frames: [
      frame(1400, { eyes: 'open', mouth: 'smile', cheeks: 'bright' }),
      frame(1000, { eyes: 'open', mouth: 'smile', cheeks: 'bright', sy: 1.04 }),
      frame(110, { eyes: 'blink', mouth: 'smile', sy: 1.04 }),
      frame(900, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: -0.6 }),
      frame(1200, { eyes: 'open', mouth: 'smile', cheeks: 'bright' }),
      frame(110, { eyes: 'blink', mouth: 'smile' }),
      frame(900, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', sy: 1.03 }),
    ],
    still: 0,
  }),

  // Feeling down (the user has been unkind): eyes down, worried brows, a frown, a sigh and a tear.
  sad: () => ({
    frames: [
      frame(1500, { eyes: 'open', brows: 'worry', mouth: 'frown', lookY: 1, sy: 0.96 }),
      frame(900, { eyes: 'open', brows: 'worry', mouth: 'frown', lookY: 1, sy: 0.95, fx: [{ id: 'sweat', f: 0 }] }),
      frame(700, { eyes: 'sleep', brows: 'worry', mouth: 'o', lookY: 1, sy: 0.93, fx: [{ id: 'sweat', f: 1 }] }),
      frame(900, { eyes: 'open', brows: 'worry', mouth: 'frown', lookY: 1, sy: 0.96, fx: [{ id: 'sweat', f: 2 }] }),
      frame(110, { eyes: 'blink', brows: 'worry', mouth: 'frown', sy: 0.96 }),
      frame(1300, { eyes: 'open', brows: 'worry', mouth: 'frown', lookX: -1, lookY: 1, sy: 0.97 }),
    ],
    still: 0,
  }),

  permission: () => ({
    frames: [
      frame(380, { eyes: 'wide', brows: 'up', mouth: 'o', hands: 'up0', dy: -1, led: 'wait', fx: [{ id: 'excl', f: 0 }] }), // the ! stays put while the hands go up and down
      frame(380, { eyes: 'wide', brows: 'up', mouth: 'o', hands: 'up1', dy: 0, led: 'wait', fx: [{ id: 'excl', f: 0 }] }),
    ],
    still: 0,
  }),

  finished: () => ({
    frames: [0, 1, 2, 3].map(f => frame(300, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: f % 2 ? -2 : 0, hands: f % 2 ? 'up0' : 'up1', fx: [{ id: 'confetti', f }] })),
    still: 1,
  }),

  disconnected: () => ({
    frames: [0, 1, 2, 3].map(f => frame(900, { eyes: 'sleep', mouth: 'none', cheeks: 'normal', led: 'off', fx: [{ id: 'zzz', f }] })),
    still: 2,
  }),

  // One-shot reactions to a click or tap. Each starts and ends at rest (eyes open, standing) so it grows out of the pose the
  // pet was in and settles back into it; the motion between poses is eased by the picture, so a few frames are enough.
  // A pat: a small squat, a hop with a wave and a heart, a landing, a little bounce. (1000 ms)
  petted: () => ({
    frames: [
      frame(100, { eyes: 'open', mouth: 'smile', sy: 0.95, sx: 1.03 }),
      frame(160, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', dy: -2.5, sy: 1.05, sx: 0.97, hands: 'wave', fx: [{ id: 'heart', f: 0 }] }),
      frame(140, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', dy: -1.2, hands: 'wave', fx: [{ id: 'heart', f: 1 }] }),
      frame(160, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', dy: 0, sy: 0.96, sx: 1.03, fx: [{ id: 'heart', f: 2 }] }),
      frame(220, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', dy: -1, sy: 1.02, fx: [{ id: 'heart', f: 3 }] }),
      frame(220, { eyes: 'open', mouth: 'smile', cheeks: 'bright', fx: [{ id: 'heart', f: 4 }] }),
    ],
    still: 2,
  }),

  // The user was cruel: a flinch, then a droop with a tear, then a sad settle. (2000 ms)
  hurt: () => ({
    frames: [
      frame(100, { eyes: 'open', mouth: 'flat', sy: 0.97 }),
      frame(120, { eyes: 'ouch', brows: 'worry', mouth: 'o', shake: -1, sy: 0.97 }),
      frame(120, { eyes: 'ouch', brows: 'worry', mouth: 'o', shake: 1, sy: 0.97 }),
      frame(120, { eyes: 'ouch', brows: 'worry', mouth: 'o', shake: -0.6, sy: 0.96 }),
      frame(300, { eyes: 'wide', brows: 'worry', mouth: 'frown', sy: 0.95, fx: [{ id: 'sweat', f: 0 }] }),
      frame(500, { eyes: 'sleep', brows: 'worry', mouth: 'frown', sy: 0.93, fx: [{ id: 'sweat', f: 1 }] }),
      frame(400, { eyes: 'open', brows: 'worry', mouth: 'frown', lookY: 1, sy: 0.95, fx: [{ id: 'sweat', f: 2 }] }),
      frame(340, { eyes: 'open', brows: 'worry', mouth: 'frown', lookY: 1, sy: 0.97 }),
    ],
    still: 4,
  }),

  // Patted a few times in a row: a ticklish giggle, shaking side to side with sparkles. (1300 ms)
  giggle: () => ({
    frames: [
      frame(100, { eyes: 'open', mouth: 'smile', sy: 0.97 }),
      ...Array.from({ length: 11 }, (_, f) => frame(100, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', shake: f % 2 ? 0.45 : -0.45, dy: f % 2 ? -0.8 : 0, sy: f % 2 ? 1.02 : 0.98, hands: f % 3 === 0 ? 'wave' : 'rest', fx: [{ id: 'sparkles', f: f % 4 }, ...(f % 3 === 1 ? [{ id: 'heart', f: f % 5 }] : [])] })),
      frame(100, { eyes: 'open', mouth: 'smile', cheeks: 'bright' }),
    ],
    still: 3,
  }),

  // Patted a lot: overjoyed, hopping with both arms up in a shower of confetti and hearts. (1700 ms)
  delighted: () => ({
    frames: [
      frame(120, { eyes: 'open', mouth: 'smile', sy: 0.94, sx: 1.04 }),
      ...[0, 1, 2].flatMap(n => [
        frame(200, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: -3.2, sy: 1.07, sx: 0.95, hands: 'up0', fx: [{ id: 'confetti', f: n * 2 }, { id: 'heart', f: n * 2 }] }),
        frame(200, { eyes: 'happy', mouth: 'grin', cheeks: 'bright', dy: 0, sy: 0.93, sx: 1.06, hands: 'up1', fx: [{ id: 'confetti', f: n * 2 + 1 }, { id: 'heart', f: n * 2 + 1 }] }),
      ]),
      frame(380, { eyes: 'open', mouth: 'smile', cheeks: 'bright', fx: [{ id: 'heart', f: 6 }] }),
    ],
    still: 2,
  }),
}

/**
 * Foxy's error: the usual flinch and the steady ! badge, and a "404" floating over its head the whole time (drifting a pixel up
 * and down, slowly, while the pet holds its worried look; the long hold is cut into four so the 404 can drift).
 */
function foxError() {
  const base = loops.error().frames
  const with404 = (item, f, d = item.d) => ({ d, pose: { ...item.pose, fx: [...item.pose.fx, { id: 'e404', f }] } })
  const frames = base.slice(0, -1).map(item => with404(item, 0))
  const hold = base.at(-1)
  ;[0, 1, 2, 3].forEach(f => frames.push(with404(hold, f, hold.d / 4)))
  return { frames, still: frames.length - 1 }
}

/** One-shot reactions to the user (a pat; patting again and again escalates). */
export const REACTIONS = ['petted', 'giggle', 'delighted', 'hurt']

const cache = new Map()

/**
 * @param {string} state a pet state (see petstate.js), or 'petted'
 * @param {{ helpers?: number, character?: string }} [options] subagent helpers to show beside the pet (0..3); the character, for its own way of idling
 */
export function animation(state, { helpers = 0, character } = {}) {
  // At rest each character has its own manner (see PERSONALITY); every other state is the same for all.
  const table = state === 'idle' ? PERSONALITY : state === 'waiting' ? WAITING : undefined
  const own = table && Object.hasOwn(table, character) ? table[character] : undefined
  // Foxy's errors also float a "404" over its head.
  const special = state === 'error' && character === 'fox'
  const key = state + ':' + helpers + (own || special ? ':' + character : '')
  const known = cache.get(key)
  if (known) return known
  const { frames, still } = special ? foxError() : own ? { frames: own, still: 0 } : (Object.hasOwn(loops, state) ? loops[state] : loops.idle)()
  const count = Math.max(0, Math.min(3, helpers | 0))
  const out = {
    state,
    gray: state === 'disconnected',
    loop: !REACTIONS.includes(state),
    still,
    frames: frames.map((item, index) => ({ d: item.d, pose: { ...item.pose, helpers: count, f: index } })),
  }
  out.total = out.frames.reduce((sum, item) => sum + item.d, 0)
  cache.set(key, out)
  return out
}

/**
 * The frame to show `elapsed` ms after the animation began, and how long until it changes.
 * A one-shot animation holds its last frame.
 */
export function frameAt(anim, elapsed) {
  if (!anim.loop && elapsed >= anim.total) {
    const last = anim.frames.length - 1
    return { index: last, pose: anim.frames[last].pose, until: Infinity }
  }
  const t = anim.loop ? ((elapsed % anim.total) + anim.total) % anim.total : Math.max(0, elapsed)
  let at = 0
  for (let i = 0; i < anim.frames.length; i++) {
    const end = at + anim.frames[i].d
    if (t < end) return { index: i, pose: anim.frames[i].pose, until: end - t }
    at = end
  }
  const last = anim.frames.length - 1
  return { index: last, pose: anim.frames[last].pose, until: Infinity }
}

export const STILL_STATES = Object.keys(loops)
