// The moments the pet makes a fuss about: a sound when the agent asks something or a turn ends well, a toast and a celebration
// for a milestone, and the one-time word about the sounds. They are queued here and taken by the mod, which plays and shows them.

import { activity, aggregate } from '../core/aggregate.js'
import { dayKey } from '../core/days.js'
import { MILESTONES, reachedMilestones } from '../core/milestones.js'
import { t } from '../core/i18n/index.js'
import { defaultPet } from '../core/settings.js'

/** @param {{ s: any, now: () => number, records: () => any[], writePet: () => Promise<void> }} deps */
export function createMoments({ s, now, records, writePet }) {
  /** Notes a moment that makes a sound (once: the same moment reported twice within a few seconds is one). */
  function cue(moment) {
    const at = now()
    if (at - (s.cueAt[moment] ?? -1e9) < 3000) return
    s.cueAt[moment] = at
    s.cues.push(moment)
  }

  /** Looks for milestones the statistics have just reached: remembers them, queues a message and a celebration. The first look only
   *  records what was reached before, so nobody is greeted with a pile of old news. */
  function checkMilestones(force = false) {
    const at = now()
    if (!s.pet || (!force && at - s.milestoneAt < 5000)) return
    s.milestoneAt = at
    const all = records()
    const total = aggregate(all, { now: at })
    const reached = reachedMilestones({ tools: total.tools.total, prompts: total.prompts, passed: total.tests.passed, commits: total.git.commits, streak: activity(all, { today: dayKey(at) }).current })
    const known = s.pet.milestones
    const fresh = known === null ? [] : reached.filter(id => !known.includes(id))
    if (known !== null && !fresh.length) return
    s.pet = { ...s.pet, milestones: [...new Set([...(known ?? []), ...reached])] }
    void writePet()
    if (fresh.length) {
      // The biggest one is announced; the pet celebrates.
      const last = MILESTONES.filter(m => fresh.includes(m.id)).at(-1)
      if (last) s.toasts.push(t(last.key, { n: last.n }))
      s.react = at; s.reaction = 'delighted'
    }
  }

  /** A one-time word about the sounds, which are on by default. Returns whether the pet changed (and must be saved). */
  function welcome() {
    if (s.pet.seen.includes('sounds')) return false
    const { sounds } = s.pet.prefs
    if (sounds.question !== 'off' || sounds.finish !== 'off') s.toasts.push(t('toast.sounds'))
    s.pet = { ...s.pet, seen: [...s.pet.seen, 'sounds'] }
    return true
  }

  /** The messages for milestones reached since the last call. */
  function takeToasts() { const out = s.toasts; s.toasts = []; return out }

  /** The sound moments that happened since the last call (`question`, `finish`), each with the sound the user chose for it and the volume. */
  function takeCues() {
    const { sounds, volume } = (s.pet ?? defaultPet(now())).prefs
    const out = s.cues.map(moment => ({ moment, sound: sounds[moment], volume })).filter(item => item.sound && item.sound !== 'off')
    s.cues = []
    return out
  }

  return { cue, checkMilestones, welcome, takeToasts, takeCues }
}
