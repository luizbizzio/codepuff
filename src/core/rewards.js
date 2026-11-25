// What every level of every achievement unlocks (see milestones.js). Each one earns something: an accessory for the pet to wear, a color
// palette, or a frame for the pet card. Nothing is handed out for free and nothing is invented: each reward is tied to a real count.

/** [the milestone it comes with, what kind of reward it is, which one] */
const MAP = [
  ['tools-100', 'accessory', 'flower'], ['tools-500', 'palette', 'sunset'], ['tools-1000', 'accessory', 'sunglasses'], ['tools-5000', 'frame', 'crystal'],
  ['streak-3', 'accessory', 'bow'], ['streak-7', 'palette', 'lemon'], ['streak-30', 'accessory', 'crown'],
  ['prompts-100', 'accessory', 'party'], ['prompts-500', 'accessory', 'tophat'],
  ['tests-10', 'accessory', 'glasses'], ['tests-100', 'palette', 'ocean'],
  ['commits-10', 'accessory', 'cap'], ['commits-50', 'accessory', 'halo'],
  ['files-10', 'accessory', 'beret'], ['files-100', 'palette', 'berry'], ['files-500', 'accessory', 'chef'], ['files-2000', 'frame', 'pixel'],
  ['lines-1000', 'accessory', 'monocle'], ['lines-10000', 'palette', 'ember'], ['lines-100000', 'frame', 'neon'],
  ['days-7', 'accessory', 'bunny'], ['days-30', 'palette', 'aurora'], ['days-100', 'accessory', 'pirate'], ['days-365', 'frame', 'gold'],
  ['time-10', 'accessory', 'cowboy'], ['time-50', 'palette', 'cotton'], ['time-200', 'frame', 'ocean'],
  ['helpers-10', 'accessory', 'viking'], ['helpers-50', 'palette', 'graphite'], ['helpers-200', 'frame', 'sunset'],
  ['projects-3', 'accessory', 'graduation'], ['projects-10', 'palette', 'galaxy'], ['projects-25', 'frame', 'aurora'],
]

/** @type {{ unlock: string, type: 'accessory' | 'palette' | 'frame', id: string }[]} */
export const REWARDS = MAP.map(([unlock, type, id]) => ({ unlock, type, id }))

/** What is open from the start (no milestone, `unlock: null`): the rainbow frame, so a pet can be framed from the first day. */
const FREE = [['frame', 'rainbow']].map(([type, id]) => ({ unlock: null, type, id }))

const ofType = type => [...FREE, ...REWARDS].filter(reward => reward.type === type)

/** The accessories (worn on the head or the face), the palettes that have to be earned, and the card frames. */
export const ACCESSORIES = ofType('accessory').map(({ id, unlock }) => ({ id, unlock }))
export const PALETTE_REWARDS = ofType('palette').map(({ id, unlock }) => ({ id, unlock }))
export const FRAMES = ofType('frame').map(({ id, unlock }) => ({ id, unlock }))
export const ACCESSORY_IDS = ACCESSORIES.map(item => item.id)
export const FRAME_IDS = FRAMES.map(item => item.id)

const has = (milestones, id) => Array.isArray(milestones) && milestones.includes(id)

/** Whether a reward can be used: the free ones always, the others once the milestone for them is reached. */
export const isOpen = (reward, milestones) => reward.unlock === null || has(milestones, reward.unlock)

/** The ids of one kind of reward that the reached milestones have unlocked (`milestones` is the pet's list of reached ids, or null before the first look). */
export const unlockedOf = (type, milestones) => ofType(type).filter(reward => isOpen(reward, milestones)).map(reward => reward.id)

/** What the pet wears: the accessory it was given, if the milestone for it has been reached (else nothing). */
export const wornOf = pet => (unlockedOf('accessory', pet?.milestones).includes(pet?.prefs?.accessory) ? pet.prefs.accessory : null)

/** The frame of the pet card: the one it was given, if earned (else the standard one, null). */
export const frameOf = pet => (unlockedOf('frame', pet?.milestones).includes(pet?.prefs?.frame) ? pet.prefs.frame : null)

/** Whether a palette can be used: the ones that are not rewards always can, the others once earned. */
export const paletteOpen = (id, milestones) => {
  const reward = PALETTE_REWARDS.find(item => item.id === id)
  return !reward || isOpen(reward, milestones)
}

/** The reward a milestone unlocks, with the catalog key of its name. */
export const rewardFor = milestoneId => {
  const reward = REWARDS.find(item => item.unlock === milestoneId)
  return reward ? { ...reward, key: (reward.type === 'accessory' ? 'acc.' : reward.type === 'palette' ? 'palette.' : 'frame.') + reward.id } : null
}
