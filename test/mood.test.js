import test from 'node:test'
import assert from 'node:assert/strict'
import { animation } from '../src/core/art/anim.js'
import { afterDays, afterMessage, heartsOf, judge } from '../src/core/mood.js'
import { sanitizePet, defaultPet } from '../src/core/settings.js'
import { T0 } from './helpers.js'

test('abuse aimed at the assistant is told apart from swearing at a bug, in English and Portuguese', () => {
  for (const rude of ['you are stupid', 'você é um idiota', 'vai se foder', 'burro', 'cala a boca', 'shut up', 'idiota!!', 'fuck you', 'você é burro'])
    assert.equal(judge(rude).insult, 2, rude)
  for (const fine of ['this stupid bug', 'fuck this bug', 'essa merda de erro', 'deu merda no deploy', 'you are not stupid', 'você não é burro', 'fix the login', '```idiota``` fix it', 'the trash can component', ''])
    assert.equal(judge(fine).insult, 0, fine)
  for (const harsh of ['that was a terrible answer from you', 'your code is garbage', 'vc é inútil', 'you are useless'])
    assert.equal(judge(harsh).insult, 1, harsh + ': harsh criticism, not abuse')
})

test('thanks are noticed, but not from someone who also insults', () => {
  for (const kind of ['thanks!', 'obrigado, perfeito', 'good job', 'valeu'])
    assert.equal(judge(kind).kind, true, kind)
  assert.equal(judge('thanks, you idiot').kind, false)
  assert.equal(judge('fix the login').kind, false)
})

test('more ways to say thanks are noticed, and a negated one is not', () => {
  for (const kind of ['muito bem', 'Muito bem!', 'bem feito', 'mandou bem', 'ficou ótimo', 'nice job', 'perfect', 'love it', 'gracias', 'danke', 'merci', 'no problem, thanks'])
    assert.equal(judge(kind).kind, true, kind)
  for (const plain of ['not perfect', 'nao ficou perfeito', 'it was not muito bem', 'show me the file', 'good morning', 'a nice day', 'fix the login'])
    assert.equal(judge(plain).kind, false, plain)
})

// What each language says: abuse aimed at the assistant (2), harsh criticism of the work (1), nothing (0), and thanks.
const ABUSE = {
  es: ['eres un idiota', 'cállate', 'eres tonto', 'vete a la mierda', 'pendejo!'],
  fr: ['tu es un idiot', 'ta gueule', 'espèce de connard', 'vous êtes stupide'],
  de: ['du bist ein Idiot', 'halt die Klappe', 'du bist dumm', 'Arschloch!'],
  it: ['sei un idiota', 'stai zitto', 'sei stupido', 'vaffanculo'],
  nl: ['je bent een idioot', 'hou je mond', 'klootzak!'],
  pl: ['jesteś idiota', 'zamknij się', 'ty głupku', 'ty debilu'],
  tr: ['sen aptalsın', 'kapa çeneni', 'sen salaksın'],
  ru: ['ты идиот', 'заткнись', 'ты тупой', 'дурак!', 'ты полный дурак'],
  ja: ['お前はバカだ', 'バカ！', '黙れ', 'あなたは無能だ'],
  zh: ['你是笨蛋', '闭嘴', '你这个废物', '蠢货'],
  ko: ['너 바보야', '닥쳐', '이 멍청이', '너는 병신이야'],
}
const FINE = {
  es: ['no eres tonto', 'este bug es tonto', 'hay que arreglar el login'],
  fr: ['tu n\'es pas idiot', 'ce bug stupide', 'corrige le login'],
  de: ['du bist nicht dumm', 'dieser blöde Bug', 'bitte den Login reparieren'],
  it: ['non sei stupido', 'questo bug stupido', 'correggi il login'],
  nl: ['je bent geen idioot', 'dit domme bug', 'repareer de login'],
  pl: ['nie jesteś głupi', 'napraw logowanie', 'ten głupi błąd'],
  tr: ['aptal değilsin', 'bu aptal hata', 'girişi düzelt'],
  ru: ['ты не дурак', 'этот тупой баг', 'исправь логин'],
  ja: ['今来たばかりです', 'ごみ箱を開いて', 'ログインを直して', '私がバカだった'],
  zh: ['你不是笨蛋', '笨重的箱子', '这个垃圾桶', '请修复登录', '我是笨蛋'],
  ko: ['너무 바보 같은 버그', '로그인을 고쳐줘', '바보 아니야'],
}
const HARSH = {
  es: ['eres inútil'], fr: ['tu es nul'], de: ['du bist nutzlos'], it: ['sei inutile'], nl: ['je bent waardeloos'], pl: ['jesteś beznadziejny'],
  ru: ['ты бесполезный'], ja: ['お前は使えない'], zh: ['你太垃圾了'], ko: ['너는 쓰레기'],
}
const THANKS = {
  es: ['gracias', 'muy bien', 'buen trabajo', 'bien hecho'],
  fr: ['merci', 'bon travail', 'très bien', 'merci beaucoup'],
  de: ['danke', 'gut gemacht', 'vielen Dank', 'sehr gut'],
  it: ['grazie', 'ottimo lavoro', 'ben fatto', 'bravo'],
  nl: ['bedankt', 'goed gedaan', 'dankjewel'],
  pl: ['dziękuję', 'dobra robota', 'dzięki', 'świetnie'],
  tr: ['teşekkürler', 'harika', 'eline sağlık', 'çok iyi'],
  ru: ['спасибо', 'отлично', 'молодец', 'хорошая работа'],
  ja: ['ありがとう', 'ありがとうございます', 'お疲れ様', 'ナイス'],
  zh: ['谢谢', '做得好', '太棒了', '謝謝'],
  ko: ['고마워', '감사합니다', '잘했어', '수고했어'],
}
const NOT_THANKS = {
  fr: ['ce n\'est pas parfait'], de: ['das ist nicht perfekt'], it: ['non è perfetto'], ja: ['感謝しない'], zh: ['不是很好'], ru: ['не отлично'],
}

test('abuse, harsh criticism and thanks are told apart in every language the pet speaks', () => {
  for (const [language, list] of Object.entries(ABUSE)) for (const text of list) assert.equal(judge(text).insult, 2, `${language}: ${text}`)
  for (const [language, list] of Object.entries(FINE)) for (const text of list) assert.equal(judge(text).insult, 0, `${language}: ${text}`)
  for (const [language, list] of Object.entries(HARSH)) for (const text of list) assert.equal(judge(text).insult, 1, `${language}: ${text}`)
  for (const [language, list] of Object.entries(THANKS)) for (const text of list) assert.deepEqual(judge(text), { insult: 0, kind: true }, `${language}: ${text}`)
  for (const [language, list] of Object.entries(NOT_THANKS)) for (const text of list) assert.equal(judge(text).kind, false, `${language}: ${text}`)
  assert.equal(judge('спасибо, ты идиот').kind, false, 'thanks from someone who also insults')
  assert.equal(judge('谢谢你，笨蛋').kind, false)
  assert.equal(judge('un messaggio normale sulla prima versione').kind, false, '"prima" is Italian for "first", not praise')
})

test('hearts: one to five from a score; insults cost, thanks and days give back, and the score stays in range', () => {
  assert.deepEqual([1, 20, 21, 40, 60, 80, 81, 100].map(heartsOf), [1, 1, 2, 2, 3, 4, 5, 5])
  assert.equal(afterMessage(100, { insult: 2, kind: false }), 85)
  assert.equal(afterMessage(100, { insult: 1, kind: false }), 100, 'harsh criticism costs nothing')
  assert.equal(afterMessage(100, { insult: 0, kind: true }), 100, 'never above the top')
  assert.equal(afterMessage(5, { insult: 2, kind: false }), 1, 'never below the bottom: one heart is always left')
  assert.equal(heartsOf(afterMessage(1, { insult: 2, kind: false })), 1)
  assert.equal(afterDays(50, 2), 70)
  assert.equal(afterDays(95, 3), 100)
})

test('the affection is part of the saved pet, repaired when invalid, and a new pet starts at full', () => {
  assert.deepEqual(defaultPet(T0).affection, { score: 100, day: '', at: 0 })
  const odd = sanitizePet({ ...defaultPet(T0), affection: { score: 'lots', day: 'yesterday' } }, T0).pet
  assert.deepEqual(odd.affection, { score: 100, day: '', at: 0 })
  const wild = sanitizePet({ ...defaultPet(T0), affection: { score: -50, day: '2026-01-02' } }, T0).pet
  assert.deepEqual(wild.affection, { score: 1, day: '2026-01-02', at: 0 })
})

test('waiting is always a happy face: no thought dots, never a frown, never worried', () => {
  for (const { pose } of animation('waiting').frames) {
    assert.ok(!pose.fx.some(item => item.id === 'dots'), 'no bubble of dots')
    assert.ok(['smile', 'grin'].includes(pose.mouth), 'a smile (' + pose.mouth + ')')
    assert.ok(['open', 'blink', 'happy'].includes(pose.eyes))
    assert.equal(pose.brows, 'none')
  }
})

test('feeling down and hurt look sad: worried brows and a frown, with a tear', () => {
  for (const name of ['sad', 'hurt']) {
    const frames = animation(name).frames
    assert.ok(frames.some(f => f.pose.brows === 'worry' && ['frown', 'o'].includes(f.pose.mouth)), name)
    assert.ok(frames.some(f => f.pose.fx.some(item => item.id === 'sweat')), name + ' has a tear')
  }
})

test('sounds play one at a time, and a third that arrives while two are waiting is dropped', async () => {
  const { createSoundQueue } = await import('../src/claude/soundqueue.js')
  const log = []
  let running = 0
  let most = 0
  const play = createSoundQueue(async name => {
    running++; most = Math.max(most, running)
    log.push('start ' + name)
    await new Promise(resolve => setTimeout(resolve, 20))
    log.push('end ' + name)
    running--
  })
  assert.equal(play('a'), true)
  assert.equal(play('b'), true)
  assert.equal(play('c'), false, 'a third is dropped')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b'])
  assert.equal(most, 1, 'never two at once')
  assert.equal(play('d'), true, 'room again once they are done')
  const broken = createSoundQueue(() => { throw new Error('no player') })
  assert.equal(broken('x'), true)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(broken('y'), true, 'a failing player does not jam the queue')
})

test('odd data never breaks the drawing or the numbers: prototype names, non-finite usage, lists for names, empty day buckets', async () => {
  const { petSvg } = await import('../src/core/render/raster.js')
  const { animation } = await import('../src/core/art/anim.js')
  const { aggregate } = await import('../src/core/aggregate.js')
  const { cleanName } = await import('../src/core/settings.js')
  const { planWindows, tiredOf, resetsBetween } = await import('../src/claude/usage.js')
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.doesNotThrow(() => petSvg({ character: name, state: name }), name + ' as a character and a state')
    assert.ok(animation(name, { character: name }).frames.length > 0, name + ' falls back to the resting animation')
  }
  assert.doesNotThrow(() => petSvg({ character: 'fox', state: 'idle', colors: null }))
  assert.equal(cleanName(['a', { b: 1 }]), '', 'a list is not a name')
  assert.equal(cleanName({ toString: () => 'x' }), '', 'neither is an object')
  assert.equal(cleanName('  Biscuit '), 'Biscuit')
  const stats = aggregate([{ agent: 'claude', sid: 's', days: { '2026-11-01': null, '2026-11-02': 'x', '2026-11-03': { pr: 2 } } }], {})
  assert.equal(stats.prompts, 2, 'a damaged day is skipped, the rest counts')
  const bad = { limits: [{ kind: 'five_hour', percentUsed: NaN, resetsAt: 'soon' }, { kind: 'seven_day', percentUsed: Infinity }] }
  assert.deepEqual(planWindows(bad, 0), [])
  assert.equal(tiredOf(bad, 0), null)
  assert.deepEqual(resetsBetween({ limits: [{ kind: 'five_hour', percentUsed: 50 }] }, bad, 0), [])
})

test('the judge does not take names, self-blame or talk about a bot for abuse', () => {
  for (const fine of [
    "you're right, I was dumb to not see that", 'you are right, that was stupid of me', 'eu sou burro, esqueci o ponto e vírgula', 'foi burrice minha, vc tem razão',
    'rename idiot-proof to foolproof', 'idiot proof the CLI args', 'implementa um idiota-proof validator', 'burro: add a retry', 'delete the bitch.py file',
    'fix: the bot is dumb about dates', 'o bot está burro com datas', 'fix the stupid lint rule', 'this piece of shit config again', 'que merda de erro é esse',
  ]) assert.equal(judge(fine).insult === 2, false, fine)
  for (const rude of ['you suck', 'you are a useless piece of shit', 'you dumb bot', 'idiot!', 'seu idiota'])
    assert.equal(judge(rude).insult, 2, rude)
})
