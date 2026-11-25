// Small shared values of the Claude Code mod's controller.

export const SCOPES = ['session', 'all', '7d', '30d']
/** The periods in the order they are offered. */
export const PERIODS = ['session', '7d', '30d', 'all']
export const AGENT_FILTERS = ['all', 'claude', 'codex']
export const BLOCKS = '▁▂▃▄▅▆▇█'

/** Pats closer together than this build up: a few make the pet giggle, many make it overjoyed. */
export const PAT_COMBO_MS = 2500
export const reactionLevel = count => (count >= 5 ? 'delighted' : count >= 3 ? 'giggle' : 'petted')
import { animation } from '../core/art/anim.js'
export const REACTION_LENGTH = { petted: 1000, giggle: 1300, delighted: 1700, hurt: 2000, ...Object.fromEntries(['morning', 'afternoon', 'evening', 'night', 'stretch'].map(name => [name, animation(name).total])) }
/** Which greeting fits an hour of the day (0 to 23). */
export const greetingAt = hour => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night')
/** At this many hearts or fewer the pet is sad whenever it has nothing else to do. */
export const SAD_AT = 2
