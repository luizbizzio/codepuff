// Plays sounds one after another. Each clip is a process or a host call that lasts a second or so, so two sounds asked for close
// together would play on top of each other; instead the second waits for the first, and a third is dropped (a sound that arrives
// that late is no longer news).

/**
 * @template T
 * @param {(item: T) => Promise<unknown> | unknown} playOnce plays one clip and resolves when it has finished
 * @param {{ max?: number }} [options] how many may be playing or waiting at once
 * @returns {(item: T) => boolean} asks for a sound; false when it was dropped
 */
export function createSoundQueue(playOnce, { max = 2 } = {}) {
  let chain = Promise.resolve()
  let pending = 0
  return item => {
    if (pending >= max) return false
    pending++
    chain = chain.then(() => playOnce(item)).catch(() => {}).then(() => { pending-- })
    return true
  }
}
