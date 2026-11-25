import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  LANGUAGES, LANGUAGE_CODES, cellWidth, chooseLanguage, detectLanguage, formatNumber, getLanguage, normalizeLocale, padCells, pluralCategory, setLanguage, t,
} from '../src/core/i18n/index.js'
import en from '../src/core/i18n/en.js'
import { ago, duration, resetIn, shortDay, statBars, statRows, statTiles, usd } from '../src/core/format.js'
import { labelFor, STATES } from '../src/core/petstate.js'
import { emptyStats } from '../src/core/aggregate.js'
import { sanitizePet, defaultPet } from '../src/core/settings.js'
import { createController } from '../src/claude/controller.js'
import { tempDir } from './helpers.js'

const ROOT = join(import.meta.dirname, '..')
const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',')
const forms = { en: ['one', 'other'], 'pt-BR': ['one', 'other'], es: ['one', 'other'], fr: ['one', 'other'], de: ['one', 'other'], it: ['one', 'other'], nl: ['one', 'other'], tr: ['one', 'other'], pl: ['one', 'few', 'many'], ru: ['one', 'few', 'many'], ja: ['other'], ko: ['other'], 'zh-CN': ['other'], 'zh-TW': ['other'] }
const withLanguage = (code, fn) => { try { setLanguage(code); return fn() } finally { setLanguage('en') } }

test('the languages on offer', () => {
  assert.ok(LANGUAGE_CODES.length >= 10, 'at least the ten promised languages')
  for (const code of ['en', 'pt-BR', 'es', 'fr', 'de', 'it', 'ja', 'zh-CN', 'ko', 'ru']) assert.ok(LANGUAGE_CODES.includes(code), code)
  assert.equal(new Set(LANGUAGE_CODES).size, LANGUAGE_CODES.length)
  for (const language of LANGUAGES) assert.ok(language.name.length > 0 && forms[language.code], language.code + ' is described in the test too')
})

test('every language has exactly the keys of English, with the same {placeholders} and the plural forms its grammar needs', () => {
  const keys = Object.keys(en)
  for (const { code, catalog } of LANGUAGES) {
    assert.deepEqual(Object.keys(catalog).sort(), [...keys].sort(), code + ': same keys')
    for (const key of keys) {
      const source = en[key]
      const entry = catalog[key]
      if (typeof source === 'string') {
        assert.equal(typeof entry, 'string', `${code} ${key}: a string`)
        assert.equal(placeholders(entry), placeholders(source), `${code} ${key}: placeholders`)
      } else {
        assert.equal(typeof entry, 'object', `${code} ${key}: plural forms`)
        assert.deepEqual(Object.keys(entry).sort(), [...forms[code]].sort(), `${code} ${key}: the forms of ${code}`)
        for (const form of Object.values(entry)) assert.equal(placeholders(form), placeholders(source.other), `${code} ${key}: placeholders of every form`)
      }
      for (const text of typeof entry === 'string' ? [entry] : Object.values(entry)) {
        assert.ok(text.trim().length > 0 || key === 'num.group', `${code} ${key}: not empty`)
        assert.ok(!/<\/?[a-z]+>/i.test(text), `${code} ${key}: no markup`)
      }
    }
    // The word DELETE is typed to confirm and must stay as it is.
    assert.ok(catalog['tui.delete.prompt'].includes('DELETE'), code + ': DELETE')
  }
})

test('translations that are not English were actually translated (the common keys differ from English)', () => {
  for (const { code, catalog } of LANGUAGES) {
    if (code === 'en') continue
    const same = Object.keys(en).filter(key => typeof en[key] === 'string' && catalog[key] === en[key] && /[A-Za-z]{4,}/.test(en[key].replace(/\{\w+\}/g, '')))
    // Proper names and units may coincide (Shell, Web, Pop, MCP, Plan, Ding, Tada...): a handful at most.
    assert.ok(same.length <= 20, `${code}: left in English: ${same.join(', ')}`)
  }
})

test('plural categories follow each language', () => {
  assert.equal(pluralCategory('en', 1), 'one')
  assert.equal(pluralCategory('en', 0), 'other')
  assert.equal(pluralCategory('pt-BR', 0), 'one')
  assert.equal(pluralCategory('fr', 1), 'one')
  assert.equal(pluralCategory('fr', 2), 'other')
  assert.deepEqual([1, 2, 4, 5, 11, 12, 21, 22, 25, 101, 111].map(n => pluralCategory('ru', n)), ['one', 'few', 'few', 'many', 'many', 'many', 'one', 'few', 'many', 'one', 'many'])
  assert.deepEqual([1, 2, 5, 12, 22, 25].map(n => pluralCategory('pl', n)), ['one', 'few', 'many', 'many', 'few', 'many'])
  for (const code of ['ja', 'ko', 'zh-CN', 'zh-TW']) assert.equal(pluralCategory(code, 1), 'other')
  assert.equal(pluralCategory('en', NaN), 'other')
  withLanguage('ru', () => { assert.equal(t('unit.day', { n: 3 }), '3 дня'); assert.equal(t('unit.day', { n: 5 }), '5 дней'); assert.equal(t('unit.day', { n: 21 }), '21 день') })
  withLanguage('pt-BR', () => { assert.equal(t('unit.day', { n: 1 }), '1 dia'); assert.equal(t('unit.day', { n: 2 }), '2 dias') })
  withLanguage('ja', () => assert.equal(t('unit.day', { n: 1 }), '1日'))
})

test('t falls back to English and then to the key, fills placeholders, and leaves unknown ones alone', () => {
  assert.equal(getLanguage(), 'en')
  assert.equal(t('state.thinking'), 'Working on a response')
  assert.equal(t('no.such.key'), 'no.such.key')
  assert.equal(t('cmd.name.set', { name: 'Biscuit' }), 'Your pet is now called Biscuit.')
  assert.equal(t('cmd.name.set'), 'Your pet is now called {name}.')
  assert.equal(setLanguage('klingon'), 'en', 'an unknown language leaves English')
  assert.equal(setLanguage('de'), 'de')
  assert.equal(t('state.thinking'), 'Arbeitet an einer Antwort')
  setLanguage('en')
  assert.equal(t('unit.day', { n: 1234 }), '1,234 days', 'a numeric {n} gets the thousands separator')
})

test('locale tags in every common spelling find the language', () => {
  const cases = { 'pt_BR.UTF-8': 'pt-BR', 'pt-PT': 'pt-BR', pt: 'pt-BR', en_US: 'en', 'EN-gb': 'en', 'es-MX': 'es', 'fr_CA': 'fr', de_AT: 'de', ja_JP: 'ja', 'zh-CN': 'zh-CN', zh_Hans_CN: 'zh-CN', 'zh-Hant-TW': 'zh-TW', zh_HK: 'zh-TW', zh_TW: 'zh-TW', ko_KR: 'ko', ru_RU: 'ru', 'tr-TR': 'tr', pl: 'pl', nl_BE: 'nl', 'it-IT': 'it', 'es_ES@euro': 'es' }
  for (const [tag, code] of Object.entries(cases)) assert.equal(normalizeLocale(tag), code, tag)
  for (const tag of ['C', 'POSIX', '', 'ar-EG', 'xx', undefined, null, 5, {}]) assert.equal(normalizeLocale(tag), undefined, String(tag))
  assert.equal(detectLanguage([undefined, '', 'C', 'pt_BR:en_US']), 'pt-BR', 'the first hint that names a language wins')
  assert.equal(detectLanguage(['ar:en']), 'en', 'an unsupported language in a list is skipped')
  assert.equal(detectLanguage([undefined, 'C']), undefined)
  assert.equal(chooseLanguage('auto', 'fr'), 'fr')
  assert.equal(chooseLanguage('ja', 'fr'), 'ja', 'the user\'s choice wins')
  assert.equal(chooseLanguage('auto', undefined), 'en')
  assert.equal(chooseLanguage('klingon', 'de'), 'de')
  assert.equal(chooseLanguage(undefined, 'xx'), 'en')
})

test('numbers, dates and durations follow the language', () => {
  withLanguage('de', () => { assert.equal(formatNumber(1234567), '1.234.567'); assert.equal(shortDay('2026-03-05'), '5. März'); assert.equal(duration(3_900_000), '1 Std. 05 Min.') })
  withLanguage('fr', () => assert.equal(formatNumber(1234567), '1 234 567'))
  withLanguage('ja', () => { assert.equal(shortDay('2026-11-24'), '11月24日'); assert.equal(ago(Date.now() - 5 * 60_000, Date.now()), '5分前') })
  withLanguage('pt-BR', () => { assert.equal(ago(0), 'nunca'); assert.equal(duration(90 * 60_000), '1h 30min') })
  assert.equal(formatNumber(-1234), '-1,234')
  assert.equal(formatNumber(NaN), '0')
  assert.equal(shortDay('nonsense'), '')
  assert.equal(shortDay('2026-13-01'), '')
})

test('every state, row, tile and category has a real label in every language', () => {
  const stats = emptyStats()
  stats.tools.total = 5; stats.tools.ok = 3; stats.tools.failed = 1; stats.tools.unknown = 1; stats.tools.byCategory = { read: 2, edit: 3 }
  stats.tests.run = 3; stats.tests.passed = 1; stats.tests.failed = 1; stats.tests.unknown = 1
  stats.git.commits = 2; stats.git.withLines = 1; stats.git.withoutLines = 1; stats.git.added = 10; stats.git.removed = 4; stats.git.unverified = 1
  stats.modelFailures = 2; stats.sessions.observed = 2
  for (const { code } of LANGUAGES) {
    withLanguage(code, () => {
      const texts = [
        ...STATES.map(state => labelFor(state, { percent: 90, kind: 'seven_day', helpers: 2 })),
        labelFor('tired', { percent: 80, kind: 'five_hour' }), labelFor('tired', { percent: 80, kind: 'spend_limit' }), labelFor('tired', { percent: 80 }), labelFor('delegating'),
        labelFor('success', { kind: 'commit' }), labelFor('error', { act: 'model' }), labelFor('error', { act: 'test' }), labelFor('permission', { kind: 'ask' }), labelFor('disconnected', { ended: true }),
        ...statRows(stats).flatMap(row => [row.label, row.value, row.group ?? '', row.hint ?? '']),
        ...statTiles(stats).flatMap(tile => [tile.label, tile.value, tile.note]),
        ...statBars(stats).map(bar => bar.label),
      ].filter(text => text !== '')
      for (const text of texts) assert.ok(!/\{\w+\}/.test(text) && !/^(state|stats|ui|cmd|unit)\./.test(text) && !text.includes('undefined') && !text.includes('NaN'), `${code}: ${text}`)
      // The status block of the band holds a label at a time; none may be wider than the room it has (34 cells, and a little more).
      for (const state of STATES) assert.ok(cellWidth(labelFor(state, { percent: 99, kind: 'seven_day', helpers: 3 })) <= 48, `${code} ${state}: ${labelFor(state, { percent: 99, kind: 'seven_day', helpers: 3 })}`)
    })
  }
})

test('widths in terminal cells: wide characters count two, escapes and marks none', () => {
  assert.equal(cellWidth('abc'), 3)
  assert.equal(cellWidth('日本語'), 6)
  assert.equal(cellWidth('한국어 a'), 8)
  assert.equal(cellWidth('\x1b[1mbold\x1b[0m'), 4)
  assert.equal(cellWidth('é'), 1)
  assert.equal(cellWidth(''), 0)
  assert.equal(padCells('日本', 8), '日本    ')
  assert.equal(padCells('abcdef', 3), 'abcdef')
})

test('the language is a validated preference: auto by default, a supported code otherwise', () => {
  assert.equal(defaultPet().prefs.language, 'auto')
  for (const code of LANGUAGE_CODES) assert.equal(sanitizePet({ ...defaultPet(), prefs: { language: code } }).pet.prefs.language, code)
  for (const bad of ['klingon', 5, null, {}, ['en'], '', 'EN']) assert.equal(sanitizePet({ ...defaultPet(), prefs: { language: bad } }).pet.prefs.language, 'auto', String(bad))
  assert.equal(sanitizePet({ v: 2, id: 'a'.repeat(16), createdAt: 1, prefs: {} }).pet.prefs.language, 'auto', 'a pet saved before there was a language')
})

// ---- the controller, with a fake host ----------------------------------------------------------------------------------------------

function fakeHost() {
  const files = new Map()
  const clock = { at: 1_800_000_000_000 }
  const io = {
    dataDir: async () => '/data',
    read: async path => { if (!files.has(path)) throw new Error('ENOENT'); return files.get(path) },
    write: async (path, text) => { files.set(path, text) },
    list: async path => [...files.keys()].filter(key => key.startsWith(path + '/')).map(key => ({ name: key.slice(path.length + 1), kind: 'file', size: files.get(key).length, mtimeMs: files.get(key).length })),
    now: () => clock.at,
  }
  return { io, files, clock }
}

test('the controller speaks the system language while the pet\'s is "auto", and the pet\'s own choice once it is set', async () => {
  const { io } = fakeHost()
  try {
    const ctl = createController(io, { locale: 'pt-BR' })
    await ctl.init({ sid: 'a', cwd: '/w' })
    assert.equal(ctl.model().language, 'pt-BR')
    assert.equal(ctl.model().me.label, 'Descansando')
    assert.match(ctl.model().scopeLabel, /^Esta sessão · Claude Code$/)
    assert.equal(ctl.model().pet.language, 'auto')
    // The user picks a language: it wins over the system's, and is saved on the pet (shared with Codex).
    assert.match((await ctl.command('language de')).text, /Sprache: de/)
    assert.equal(ctl.model().language, 'de')
    assert.equal(ctl.model().me.label, 'Ruht sich aus')
    assert.equal(ctl.pet.prefs.language, 'de')
    assert.match((await ctl.command('language PT-br')).text, /Idioma: pt-BR/, 'any case')
    assert.match((await ctl.command('language nope')).text, /auto, en, pt-BR/)
    await ctl.setPet({ prefs: { language: 'auto' } })
    assert.equal(ctl.model().language, 'pt-BR', 'back to the system\'s')
    ctl.setLocale('ja')
    assert.equal(ctl.model().me.label, '休憩中', 'the system\'s language found after the controller was made')
    ctl.setLocale('xx')
    assert.equal(ctl.model().language, 'en', 'an unsupported system language is English')
    // Replies of the command are in the language too.
    await ctl.setPet({ prefs: { language: 'es' } })
    assert.match((await ctl.command('volume low')).text, /Volumen de los sonidos: low/)
    assert.match((await ctl.command('stats')).text, /Esta sesión/)
    assert.match((await ctl.command('')).text, /Racha de 0 días/)
  } finally { setLanguage('en') }
})

test('toasts and milestones are made in the language that is active when they happen', async () => {
  const { io, clock } = fakeHost()
  try {
    const ctl = createController(io, { locale: 'fr' })
    await ctl.init({ sid: 'a', cwd: '/w' })
    assert.match(ctl.takeToasts().join(' '), /CodePuff joue de courts sons/, 'the one-time word about the sounds')
    const now = clock.at
    ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt: new Date(now + 3_600_000).toISOString() }] })
    clock.at += 3_700_000
    ctl.setUsage({ rateLimits: [{ kind: 'five_hour', percentUsed: 2, resetsAt: new Date(clock.at + 5 * 3_600_000).toISOString() }] })
    assert.match(ctl.takeToasts().join(' '), /limite de 5 heures a été réinitialisée/)
  } finally { setLanguage('en') }
})

// ---- the sources ---------------------------------------------------------------------------------------------------------------------

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { if (name !== 'i18n') files(path, out) } else if (/\.(js|tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(path)
  }
  return out
}

test('an amount of money follows the language: the decimal sign, the thousands separator and the symbol', () => {
  assert.equal(usd(1.234), '≈ $1.23')
  assert.equal(usd(1234.5), '≈ $1,234.50')
  assert.equal(usd(0.004), '≈ $0.00')
  assert.equal(usd(NaN), '≈ $0.00')
  withLanguage('pt-BR', () => assert.equal(usd(1234.5), '≈ US$ 1.234,50'))
  withLanguage('de', () => assert.equal(usd(7.05), '≈ 7,05 $'))
  withLanguage('fr', () => assert.equal(usd(7.05), '≈ 7,05 $US'))
  withLanguage('ja', () => assert.equal(usd(1234.5), '≈ $1,234.50'))
})

test('a plan reset is told in minutes, hours and minutes, and from a day on in days and hours', () => {
  const H = 3_600_000
  assert.equal(resetIn(59 * 60_000), '59 min')
  assert.equal(resetIn(5 * H + 12 * 60_000), '5h 12m')
  assert.equal(resetIn(23 * H + 59 * 60_000), '23h 59m')
  assert.equal(resetIn(24 * H), '1d 0h')
  assert.equal(resetIn(153 * H), '6d 9h', 'never "153h"')
  assert.equal(resetIn(0), '—')
  withLanguage('pt-BR', () => assert.equal(resetIn(153 * H), '6d 9h'))
  withLanguage('de', () => assert.equal(resetIn(153 * H), '6 T. 9 Std.'))
  withLanguage('ja', () => assert.equal(resetIn(153 * H), '6日9時間'))
})

test('every literal key the sources pass to t() exists in the catalog, and dynamic ones have all their cases', () => {
  const used = new Set()
  const dynamic = []
  for (const file of [...files(join(ROOT, 'src')), ...files(join(ROOT, 'hooks'))]) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(match[1])
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+\.)'\s*\+/g)) dynamic.push(match[1])
    for (const match of text.matchAll(/\bt\(\s*[a-z(]/g)) void match
  }
  for (const key of used) if (!key.endsWith('.')) assert.ok(key in en, 'missing in en.js: ' + key)
  // The prefix families built at run time.
  const family = (prefix, ids) => { for (const id of ids) assert.ok(prefix + id in en, 'missing in en.js: ' + prefix + id) }
  family('state.', ['idle', 'bored', 'coffee', 'sleeping', 'thinking', 'reading', 'searching', 'coding', 'running', 'sad', 'git', 'mcp', 'testing', 'web', 'planning', 'investigating', 'waiting', 'finished'])
  family('reaction.', ['petted', 'giggle', 'delighted', 'hurt', 'morning', 'afternoon', 'evening', 'night', 'stretch'])
  family('acc.', ['flower', 'bow', 'glasses', 'cap', 'party', 'tophat', 'sunglasses', 'crown', 'halo', 'beret', 'chef', 'monocle', 'bunny', 'pirate', 'cowboy', 'viking', 'graduation'])
  family('frame.', ['rainbow', 'pixel', 'neon', 'gold', 'ocean', 'sunset', 'aurora'])
  family('ui.breaks.', ['off', 'every', 'rest'])
  family('ach.', ['tools', 'streak', 'prompts', 'tests', 'commits', 'files', 'lines', 'days', 'time', 'helpers', 'projects'])
  family('tier.', ['bronze', 'silver', 'gold', 'diamond'])
  family('plan.', ['five_hour', 'seven_day', 'spend_limit'])
  family('toast.', ['reset5h', 'resetWeek'])
  family('stats.cat.', ['read', 'search', 'edit', 'shell', 'web', 'agent', 'plan', 'mcp', 'other'])
  family('ui.period.', ['session', '7d', '30d', 'all'])
  family('ui.sound.', ['question', 'finish', 'reset5h', 'resetWeek'])
  family('sound.', ['off', 'chime', 'bell', 'pop', 'ding', 'tada'])
  family('ui.motion.', ['full', 'calm', 'reduced'])
  family('ui.volume.', ['low', 'medium', 'high'])
  family('ui.size.', ['small', 'medium', 'large'])
  family('ui.plan.', ['auto', 'always', 'five_hour', 'seven_day', 'off'])
  family('cmd.plan.', ['auto', 'always', 'five_hour', 'seven_day', 'off'])
  family('palette.', ['default', 'sky', 'marshmallow', 'mint', 'sunset', 'lavender', 'lemon', 'ocean', 'berry', 'ember', 'graphite', 'aurora', 'cotton', 'galaxy', 'custom'])
  family('month.', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  family('milestone.', ['tools', 'streak', 'prompts', 'tests', 'commits', 'files', 'lines', 'days', 'time', 'helpers', 'projects'])
  assert.ok(dynamic.length > 0)
  // Nothing in the catalog is unused (a dead sentence is a sentence somebody translates for nothing); the families above are checked by name.
  const families = ['acc.', 'frame.', 'ach.', 'tier.', 'ui.breaks.', 'state.', 'reaction.', 'plan.', 'toast.', 'stats.cat.', 'ui.period.', 'ui.sound.', 'sound.', 'ui.motion.', 'ui.volume.', 'ui.size.', 'ui.plan.', 'cmd.plan.', 'palette.', 'month.', 'milestone.']
  const text = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'hooks')), join(ROOT, 'src', 'core', 'i18n', 'index.js')].map(file => readFileSync(file, 'utf8')).join(' ')
  const unused = Object.keys(en).filter(key => !text.includes("'" + key + "'") && !families.some(prefix => key.startsWith(prefix)))
  assert.deepEqual(unused, [], 'keys nobody uses')
})

test('the terminal app and the command line follow the language (CODEPUFF_LANG, or the pet\'s own choice)', () => {
  const { dir, done } = tempDir()
  try {
    const run = (env, ...args) => spawnSync(process.execPath, [join(ROOT, 'bin', 'codepuff.js'), ...args], { encoding: 'utf8', env: { ...process.env, CODEPUFF_HOME: dir, CODEPUFF_LANG: 'en', ...env } })
    assert.match(run({}, 'stats').stdout, /Prompts submitted/)
    assert.match(run({ CODEPUFF_LANG: 'pt_BR.UTF-8' }, 'stats').stdout, /Prompts enviados/, 'the system\'s language')
    assert.equal(run({}, 'set', 'language', 'de').status, 0)
    assert.match(run({ CODEPUFF_LANG: 'pt_BR.UTF-8' }, 'stats').stdout, /Gesendete Prompts/, 'the pet\'s choice beats the system\'s')
    assert.equal(run({}, 'set', 'language', 'AUTO').status, 0)
    assert.match(run({ CODEPUFF_LANG: 'ja_JP.UTF-8' }, 'stats').stdout, /送信したプロンプト/)
    assert.equal(run({}, 'set', 'language', 'klingon').status, 1)
    assert.match(run({}, 'set', 'language', 'klingon').stderr, /Usage: codepuff set language <auto\|en\|pt-BR/)
  } finally { done() }
})
