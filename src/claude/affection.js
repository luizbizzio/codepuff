// How the pet feels about the user (see core/mood.js), kept on the saved pet: time heals it, the user's messages move it, and
// the Codex hook (another process) may have moved it too, in which case the newer change wins.

import { dayKey } from '../core/days.js'
import { felt, judge } from '../core/mood.js'
import { sanitizePet } from '../core/settings.js'

/** @param {{ s: any, io: any, file: (...p: string[]) => string, now: () => number, writePet: () => Promise<void> }} deps */
export function createAffection({ s, io, file, now, writePet }) {
  /** Lets time heal: each whole day since the score was last settled gives some of it back. Returns whether it changed. */
  function heal(at) {
    if (!s.pet) return false
    const next = felt(s.pet.affection, { insult: 0, kind: false }, dayKey(at), at)
    if (next === s.pet.affection) return false
    s.pet = { ...s.pet, affection: next }
    return true
  }

  /** How the user's message felt: unkindness lowers the hearts (and hurts), thanks raises them. Only the number is kept. */
  function feel(prompt, at) {
    if (!s.pet || !s.pet.prefs.mood) return
    const verdict = judge(prompt)
    const next = felt(s.pet.affection, verdict, dayKey(at), at)
    if (next === s.pet.affection) return
    s.pet = { ...s.pet, affection: next }
    void writePet()
    if (verdict.insult || verdict.kind) {
      s.react = at
      s.reaction = verdict.insult ? 'hurt' : 'petted'
    }
  }

  /** Another process (the Codex hook) may have changed the affection: the newer one wins. Returns whether it changed. */
  async function sync() {
    try {
      const found = sanitizePet(JSON.parse(await io.read(file('pet.json'))), now()).pet
      if (s.pet && found.affection.at > s.pet.affection.at) { s.pet = { ...s.pet, affection: found.affection }; return true }
    } catch { /* no file yet, or unreadable: nothing to adopt */ }
    return false
  }

  return { heal, feel, sync }
}
