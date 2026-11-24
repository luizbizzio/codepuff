// The pet's affection for the user: one to five hearts. It falls when the user is abusive to the assistant (insults aimed at it,
// not swearing at a bug) and rises with thanks and with time. The text of a prompt is only looked at, in memory, to decide
// between "insult", "kind" and neither; it is never stored, logged or sent anywhere. Only the number is kept.

/** Insults aimed at a person (accents and case are removed first): when aimed at the assistant they cost hearts. */
const STRONG = new Set([
  'idiot', 'moron', 'imbecile', 'stupid', 'dumb', 'dumbass', 'retard', 'retarded', 'asshole', 'bitch', 'bastard', 'loser', 'scum', 'jackass',
  'idiota', 'burro', 'burra', 'imbecil', 'estupido', 'estupida', 'otario', 'otaria', 'babaca', 'retardado', 'retardada', 'trouxa',
  'tapado', 'tapada', 'anta', 'besta', 'nojento', 'nojenta', 'desgraca', 'cretino', 'cretina', 'lerdo', 'lerda',
])
/** Harsh criticism of the work or of the assistant ("your code is garbage"): it stings for a moment but costs no hearts, because
 *  being critical of what was delivered is not being unkind to someone. */
const MILD = new Set([
  'awful', 'terrible', 'horrible', 'worst', 'trash', 'garbage', 'useless', 'worthless', 'pathetic', 'incompetent',
  'horrivel', 'pessimo', 'pessima', 'ruim', 'fraco', 'fraca', 'lixo', 'inutil', 'incompetente', 'ridiculo', 'ridicula',
  'patetico', 'patetica', 'porcaria', 'merda', 'burrice', 'idiotice',
])
/** Phrases that are always aimed at the listener. */
const PHRASES = [
  'shut up', 'fuck you', 'fuck off', 'screw you', 'go to hell', 'son of a bitch', 'you suck', 'u suck',
  'cala a boca', 'cala boca', 'cale a boca', 'vai se foder', 'vai se fuder', 'vai tomar no cu', 'vai a merda', 'vai pra merda', 'filho da puta',
  'vsf', 'vtnc', 'fdp', 'nao serve pra nada',
]
/** Phrases that are harsh criticism (of the work, or of the assistant) rather than abuse. */
const MILD_PHRASES = ['piece of shit']
/** Words that make an insult about the speaker themselves ("I was dumb", "stupid of me", "eu sou burro"): not aimed at anyone else. */
const SELF = new Set(['i', 'im', 'ive', 'me', 'my', 'myself', 'eu', 'mim', 'minha', 'meu', 'sou', 'fui'])
/** Words that point at the assistant. */
const YOU = new Set([
  'you', 'your', 'youre', 'yours', 'ur', 'u', 'claude', 'ai', 'assistant', 'gpt',
  'vc', 'voce', 'tu', 'seu', 'sua', 'teu', 'tua', 'ia',
])
/** Insults that name a person: a short message made of one is aimed at the assistant even without "you". */
const PERSON = new Set([
  'idiot', 'moron', 'imbecile', 'dumbass', 'retard', 'retarded', 'asshole', 'bitch', 'bastard', 'loser', 'jackass', 'useless', 'worthless', 'incompetent',
  'idiota', 'burro', 'burra', 'imbecil', 'otario', 'otaria', 'babaca', 'retardado', 'retardada', 'trouxa', 'cretino', 'cretina', 'inutil', 'incompetente',
])
const NEGATION = new Set(['not', 'never', 'isnt', 'arent', 'nao', 'nunca', 'jamais', 'no'])
const KIND = new Set([
  'thanks', 'thank', 'thx', 'obrigado', 'obrigada', 'brigado', 'brigada', 'valeu', 'vlw', 'parabens', 'perfeito', 'perfeita', 'excelente',
  'otimo', 'otima', 'amazing', 'awesome', 'wonderful', 'fantastic', 'brilliant', 'amei', 'adorei', 'genial', 'maravilhoso', 'maravilhosa',
])
const KIND_PHRASES = ['good job', 'great job', 'well done', 'nice work', 'muito bom', 'bom trabalho', 'show de bola', 'boa trabalho']

/** Letters only, lower case, without accents, single spaces. Code is dropped: what is inside it is not said to the assistant. */
function clean(text) {
  return String(text ?? '')
    .slice(0, 4000)
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .slice(0, 600)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * @param {unknown} prompt the text the user sent
 * @returns {{ insult: 0 | 1 | 2, kind: boolean }} how rude the message was to the assistant (2 = abusive, 1 = harsh criticism) and whether it was kind
 */
export function judge(prompt) {
  const text = clean(prompt)
  if (!text) return { insult: 0, kind: false }
  const words = text.split(' ')
  let insult = 0
  if (PHRASES.some(p => ` ${text} `.includes(` ${p} `))) insult = 2
  else if (MILD_PHRASES.some(p => ` ${text} `.includes(` ${p} `))) insult = /\b(?:you are|youre|you re|ur|u r|voce e|vc e|seu)\b.{0,20}\bpiece of shit\b/.test(text) ? 2 : 1
  words.forEach((word, i) => {
    const strong = STRONG.has(word)
    if (!strong && !MILD.has(word)) return
    // "you are not stupid" is not an insult.
    if (words.slice(Math.max(0, i - 3), i).some(w => NEGATION.has(w))) return
    // "I was dumb", "stupid of me": an insult at oneself. "idiot-proof": a word in a name, not an insult.
    if (words.slice(Math.max(0, i - 3), i + 4).some(w => SELF.has(w))) return
    if (/^proof/.test(words[i + 1] ?? '')) return
    const near = words.slice(Math.max(0, i - 4), i + 5).some(w => YOU.has(w))
    // A short message that is only an insult ("idiota!") is aimed at the assistant too.
    const alone = PERSON.has(word) && words.length <= 3
    if (near || alone) insult = Math.max(insult, strong ? 2 : 1)
  })
  const kind = insult === 0 && (words.some(w => KIND.has(w)) || KIND_PHRASES.some(p => ` ${text} `.includes(` ${p} `)))
  return { insult, kind }
}

export const MAX_AFFECTION = 100
/** What a message costs (in the score out of 100): abuse takes 15, harsh criticism nothing (it only stings). */
export const HURT = { 1: 0, 2: 15 }
export const THANKS = 4
/** What a day of not being insulted heals. */
export const DAILY_HEAL = 10

/** One to five hearts for a score of 1 to 100. */
export const heartsOf = score => Math.max(1, Math.min(5, Math.ceil(score / 20)))

/** The score after a message, and after days have passed (`days` whole days since the score was last touched). */
export function afterMessage(score, { insult, kind }) {
  if (insult) return Math.max(1, score - HURT[insult])
  if (kind) return Math.min(MAX_AFFECTION, score + THANKS)
  return score
}
export const afterDays = (score, days) => Math.min(MAX_AFFECTION, score + Math.max(0, days) * DAILY_HEAL)

/** @typedef {{ score: number, day: string, at: number }} Affection  score 1 to 100; the day it was last settled (yyyy-mm-dd); when a message last changed it (ms) */

/** The affection once time has passed: each whole day since it was settled gives some back. */
export function healed(affection, today) {
  if (affection.day === today) return affection
  const days = affection.day ? Math.round((Date.parse(today) - Date.parse(affection.day)) / 86_400_000) : 0
  return { ...affection, score: afterDays(affection.score, days), day: today }
}

/**
 * The affection after the user's message (judged by `judge`): the same object when nothing changed, a new one when it did.
 * Both the Claude Code mod and the Codex hook use this, so the pet feels the same whoever it is talking to.
 */
export function felt(affection, verdict, today, at) {
  const settled = healed(affection, today)
  if (!verdict.insult && !verdict.kind) return settled
  return { score: afterMessage(settled.score, verdict), day: today, at }
}
