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

const loops = {
  idle: () => ({ frames: IDLE, still: 0 }),

  thinking: () => ({
    frames: [1, 2, 3, 3].map((n, i) => frame(i === 3 ? 700 : 520, { eyes: 'focus', mouth: 'flat', lookX: 1, lookY: -1, led: 'think', fx: [{ id: 'dots', n }] })),
    still: 2,
  }),

  reading: () => ({
    frames: [
      frame(1600, { eyes: 'open', lookY: 1, mouth: 'flat', hands: 'hold', prop: { id: 'book', f: 0 } }),
      frame(160, { eyes: 'open', lookY: 1, mouth: 'flat', hands: 'hold', prop: { id: 'book', f: 1 } }),
      frame(160, { eyes: 'open', lookY: 1, mouth: 'flat', hands: 'hold', prop: { id: 'book', f: 2 } }),
      frame(1500, { eyes: 'open', lookY: 1, mouth: 'flat', hands: 'hold', prop: { id: 'book', f: 3 } }),
      frame(110, { eyes: 'blink', lookY: 1, mouth: 'flat', hands: 'hold', prop: { id: 'book', f: 3 } }),
    ],
    still: 0,
  }),

  searching: () => ({
    frames: [0, 1, 2, 3].map(f => frame(450, { eyes: 'open', lookX: [0, 1, 1, 0][f], mouth: 'flat', hands: 'point', prop: { id: 'magnifier', f } })),
    still: 1,
  }),

  investigating: () => ({
    frames: [0, 1, 2, 3].map(f => frame(450, { eyes: 'open', brows: 'worry', lookX: [0, 1, 1, 0][f], mouth: 'flat', hands: 'point', prop: { id: 'magnifier', f }, fx: [{ id: 'quest', f }] })),
    still: 1,
  }),

  coding: () => ({
    frames: Array.from({ length: 8 }, (_, i) => frame(i === 7 ? 260 : 170, { eyes: 'focus', mouth: 'flat', lookY: 1, hands: i % 2 ? 'type1' : 'type0', prop: { id: 'laptop', f: i >> 1 } })),
    still: 1,
  }),

  running: () => ({
    frames: Array.from({ length: 8 }, (_, i) => frame(i % 2 ? 150 : 230, { eyes: 'focus', mouth: 'flat', lookY: 1, hands: i % 2 ? 'type1' : 'type0', led: 'think', prop: { id: 'shell', f: i >> 1 } })),
    still: 1,
  }),

  testing: () => ({
    frames: Array.from({ length: 6 }, (_, f) => frame(330, { eyes: 'open', lookX: 1, mouth: 'cat', hands: 'rest', prop: { id: 'flask', f } })),
    still: 2,
  }),

  web: () => ({
    frames: [0, 1, 2, 3].map(f => frame(500, { eyes: 'open', lookX: 1, lookY: -1, mouth: 'cat', prop: { id: 'globe', f } })),
    still: 0,
  }),

  delegating: () => ({
    frames: [
      frame(700, { lookX: -1, hands: 'up0', mouth: 'cat' }), frame(700, { lookX: 1, hands: 'up1', mouth: 'cat' }),
      frame(700, { lookX: -1, hands: 'up1', mouth: 'cat' }), frame(700, { lookX: 1, hands: 'up0', mouth: 'cat' }),
    ],
    still: 0,
  }),

  planning: () => ({
    frames: [0, 1, 2, 3].map(f => frame(600, { eyes: 'focus', mouth: 'flat', lookX: 1, hands: 'rest', prop: { id: 'clipboard', f } })),
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
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: -1, led: 'error', fx: [{ id: 'sweat', f: 0 }, { id: 'alert', f: 0 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: 1, led: 'error', fx: [{ id: 'sweat', f: 0 }, { id: 'alert', f: 1 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: -1, led: 'error', fx: [{ id: 'sweat', f: 1 }] }),
      frame(70, { eyes: 'wide', brows: 'up', mouth: 'o', shake: 1, led: 'error', fx: [{ id: 'sweat', f: 1 }] }),
      frame(900, { eyes: 'wide', brows: 'worry', mouth: 'frown', led: 'error', fx: [{ id: 'sweat', f: 2 }, { id: 'alert', f: 2 }] }),
    ],
    still: 4,
  }),

  waiting: () => ({
    frames: [
      frame(900, { eyes: 'open', mouth: 'cat', fx: [{ id: 'dots', n: 1 }] }), frame(700, { eyes: 'open', mouth: 'cat', fx: [{ id: 'dots', n: 2 }] }), frame(110, { eyes: 'blink', fx: [{ id: 'dots', n: 3 }] }), frame(140, { eyes: 'open', dy: -0.5, fx: [{ id: 'dots', n: 3 }] }),
      frame(1300, { eyes: 'open', mouth: 'cat', sy: 1.04, fx: [{ id: 'dots', n: 3 }] }), frame(110, { eyes: 'blink', sy: 1.04, fx: [{ id: 'dots', n: 3 }] }), frame(900, { eyes: 'open', mouth: 'smile', fx: [{ id: 'dots', n: 3 }] }),
    ],
    still: 0,
  }),

  permission: () => ({
    frames: [
      frame(380, { eyes: 'wide', brows: 'up', mouth: 'o', hands: 'up0', dy: -1, led: 'wait', fx: [{ id: 'excl', f: 0 }] }),
      frame(380, { eyes: 'wide', brows: 'up', mouth: 'o', hands: 'up1', dy: 0, led: 'wait', fx: [{ id: 'excl', f: 1 }] }),
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

  // One-shot reaction to a click or tap.
  petted: () => ({
    frames: Array.from({ length: 7 }, (_, f) => frame(130, { eyes: 'happy', mouth: 'smile', cheeks: 'bright', dy: f % 2 ? -2 : 0, hands: f % 2 ? 'wave' : 'rest', fx: [{ id: 'heart', f }] })),
    still: 2,
  }),
}

const cache = new Map()

/**
 * @param {string} state a pet state (see petstate.js), or 'petted'
 * @param {{ helpers?: number }} [options] subagent helpers to show beside the pet (0..3)
 */
export function animation(state, { helpers = 0 } = {}) {
  const key = state + ':' + helpers
  const known = cache.get(key)
  if (known) return known
  const build = loops[state] ?? loops.idle
  const { frames, still } = build()
  const count = Math.max(0, Math.min(3, helpers | 0))
  const out = {
    state,
    gray: state === 'disconnected',
    loop: state !== 'petted',
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
