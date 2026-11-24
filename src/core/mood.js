// The pet's affection for the user: one to five hearts. It falls when the user is abusive to the assistant (insults aimed at it,
// not swearing at a bug) and rises with thanks and with time. The text of a prompt is only looked at, in memory, to decide
// between "insult", "kind" and neither; it is never stored, logged or sent anywhere. Only the number is kept.

/** Words that are insults when aimed at someone (accents and case are removed first). */
const STRONG = new Set([
  'idiot', 'moron', 'imbecile', 'stupid', 'dumb', 'dumbass', 'retard', 'retarded', 'asshole', 'bitch', 'bastard', 'trash', 'garbage',
  'useless', 'worthless', 'pathetic', 'incompetent', 'loser', 'scum', 'jackass',
  'idiota', 'burro', 'burra', 'imbecil', 'estupido', 'estupida', 'otario', 'otaria', 'babaca', 'inutil', 'lixo', 'incompetente',
  'retardado', 'retardada', 'trouxa', 'tapado', 'tapada', 'anta', 'besta', 'ridiculo', 'ridicula', 'patetico', 'patetica',
  'nojento', 'nojenta', 'desgraca', 'porcaria', 'merda', 'burrice', 'idiotice', 'cretino', 'cretina', 'lerdo', 'lerda',
])
/** Words that are only rude as criticism of the assistant itself, so they count when aimed at it. */
const MILD = new Set(['awful', 'terrible', 'horrible', 'worst', 'horrivel', 'pessimo', 'pessima', 'ruim', 'fraco', 'fraca'])
/** Phrases that are always aimed at the listener. */
const PHRASES = [
  'shut up', 'fuck you', 'fuck off', 'screw you', 'go to hell', 'piece of shit', 'son of a bitch',
  'cala a boca', 'cala boca', 'cale a boca', 'vai se foder', 'vai se fuder', 'vai tomar no cu', 'vai a merda', 'vai pra merda', 'filho da puta',
  'vsf', 'vtnc', 'fdp', 'nao serve pra nada',
]
/** Words that point at the assistant. */
const YOU = new Set([
  'you', 'your', 'youre', 'yours', 'ur', 'u', 'claude', 'ai', 'bot', 'assistant', 'model', 'gpt',
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
  words.forEach((word, i) => {
    const strong = STRONG.has(word)
    if (!strong && !MILD.has(word)) return
    // "you are not stupid" is not an insult.
    if (words.slice(Math.max(0, i - 3), i).some(w => NEGATION.has(w))) return
    const near = words.slice(Math.max(0, i - 4), i + 5).some(w => YOU.has(w))
    // A short message that is only an insult ("idiota!") is aimed at the assistant too.
    const alone = PERSON.has(word) && words.length <= 5
    if (near || alone) insult = Math.max(insult, strong ? 2 : 1)
  })
  const kind = insult === 0 && (words.some(w => KIND.has(w)) || KIND_PHRASES.some(p => ` ${text} `.includes(` ${p} `)))
  return { insult, kind }
}

export const MAX_AFFECTION = 100
export const HURT = { 1: 6, 2: 15 }
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
