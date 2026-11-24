// Localization: every sentence CodePuff shows lives in a catalog per language (en.js is the source), and `t(key, params)` looks it up
// in the active language. The active language is one module-level value (`setLanguage`), set by whoever draws something: the Claude
// Code mod and the terminal app each decide it from the pet's "language" setting (automatic by default: the system's language) and
// the core functions that build labels (states, statistics, durations) call `t` themselves, so every surface agrees.
//
// Nothing here uses Node, so it runs in the Claude Code mod's module environment too.

import en from './en.js'
import ptBR from './pt-BR.js'
import es from './es.js'
import fr from './fr.js'
import de from './de.js'
import it from './it.js'
import ja from './ja.js'
import zhCN from './zh-CN.js'
import ko from './ko.js'
import ru from './ru.js'
import zhTW from './zh-TW.js'
import tr from './tr.js'
import pl from './pl.js'
import nl from './nl.js'

/** The languages, in the order they are offered: the code, the language's name in itself, and its catalog. */
export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', catalog: en },
  { code: 'pt-BR', name: 'Português (Brasil)', catalog: ptBR },
  { code: 'es', name: 'Español', catalog: es },
  { code: 'fr', name: 'Français', catalog: fr },
  { code: 'de', name: 'Deutsch', catalog: de },
  { code: 'it', name: 'Italiano', catalog: it },
  { code: 'nl', name: 'Nederlands', catalog: nl },
  { code: 'pl', name: 'Polski', catalog: pl },
  { code: 'tr', name: 'Türkçe', catalog: tr },
  { code: 'ru', name: 'Русский', catalog: ru },
  { code: 'ja', name: '日本語', catalog: ja },
  { code: 'ko', name: '한국어', catalog: ko },
  { code: 'zh-CN', name: '简体中文', catalog: zhCN },
  { code: 'zh-TW', name: '繁體中文', catalog: zhTW },
])
export const LANGUAGE_CODES = Object.freeze(LANGUAGES.map(language => language.code))
const BY_CODE = new Map(LANGUAGES.map(language => [language.code, language.catalog]))
export const DEFAULT_LANGUAGE = 'en'

let current = DEFAULT_LANGUAGE

export const getLanguage = () => current
/** Makes `code` the active language (an unknown code leaves English). Returns the code now active. */
export function setLanguage(code) {
  current = BY_CODE.has(code) ? code : DEFAULT_LANGUAGE
  return current
}

// ---- plurals ------------------------------------------------------------------------------------------------------------

/** The plural category of a whole number in a language: one, few, many or other (the forms a catalog entry can carry). */
export function pluralCategory(code, n) {
  const i = Math.abs(Math.trunc(Number.isFinite(n) ? n : 0))
  switch (code) {
    case 'ja': case 'ko': case 'zh-CN': case 'zh-TW': return 'other'
    case 'fr': case 'pt-BR': return i === 0 || i === 1 ? 'one' : 'other'
    case 'ru': {
      const ten = i % 10
      const hundred = i % 100
      if (ten === 1 && hundred !== 11) return 'one'
      if (ten >= 2 && ten <= 4 && !(hundred >= 12 && hundred <= 14)) return 'few'
      return 'many'
    }
    case 'pl': {
      const ten = i % 10
      const hundred = i % 100
      if (i === 1) return 'one'
      if (ten >= 2 && ten <= 4 && !(hundred >= 12 && hundred <= 14)) return 'few'
      return 'many'
    }
    default: return i === 1 ? 'one' : 'other'
  }
}

// ---- lookup -------------------------------------------------------------------------------------------------------------

// {n} is the number a plural form was chosen by; when it is a number it is shown with the language's thousands separator.
const fill = (text, params) => text.replace(/\{(\w+)\}/g, (whole, name) => {
  if (!params || !Object.hasOwn(params, name)) return whole
  return name === 'n' && typeof params.n === 'number' ? formatNumber(params.n) : String(params[name])
})

/** The entry of a catalog for a key, its plural form chosen by `params.n` when the entry has forms. */
function pick(catalog, code, key, params) {
  const entry = catalog[key]
  if (entry === undefined) return undefined
  if (typeof entry === 'string') return entry
  return entry[pluralCategory(code, params?.n)] ?? entry.other ?? entry.many ?? Object.values(entry)[0]
}

/** The text for a key in the active language (English when the language lacks it, the key itself when nothing has it), with `{name}` filled in. */
export function t(key, params) {
  const text = pick(BY_CODE.get(current), current, key, params) ?? pick(BY_CODE.get(DEFAULT_LANGUAGE), DEFAULT_LANGUAGE, key, params) ?? key
  return params ? fill(text, params) : text
}

/** A whole number with the active language's thousands separator. */
export function formatNumber(value) {
  const n = Math.round(Number.isFinite(value) ? value : 0)
  const digits = String(Math.abs(n))
  const group = t('num.group')
  const grouped = digits.length > 3 && group !== '' ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, group) : digits
  return n < 0 ? '-' + grouped : grouped
}

// ---- which language ------------------------------------------------------------------------------------------------------

/** A locale tag in any common spelling ("pt_BR.UTF-8", "zh-Hant-TW", "EN-us") as the supported language it belongs to, or undefined. */
export function normalizeLocale(tag) {
  if (typeof tag !== 'string') return undefined
  const clean = tag.trim().split('.')[0].split('@')[0].replace(/_/g, '-')
  if (!clean || clean === 'C' || clean === 'POSIX') return undefined
  const [language, ...rest] = clean.split('-')
  const lower = language.toLowerCase()
  const parts = rest.map(part => part.toLowerCase())
  if (lower === 'zh') {
    const traditional = parts.includes('hant') || parts.some(part => ['tw', 'hk', 'mo'].includes(part))
    return traditional ? 'zh-TW' : 'zh-CN'
  }
  if (lower === 'pt') return 'pt-BR'
  return LANGUAGE_CODES.find(code => code.toLowerCase() === lower)
}

/**
 * The first supported language among the locale hints, in the order given (the first hint that names a supported language wins; a
 * hint for an unsupported language is skipped, so "ar:en" still finds English). Undefined when none matches.
 * @param {(string | undefined)[]} hints values such as LC_ALL, LANGUAGE ("pt_BR:en_US" lists several), LANG, an Intl locale
 */
export function detectLanguage(hints) {
  for (const hint of hints) {
    if (typeof hint !== 'string') continue
    for (const part of hint.split(':')) {
      const found = normalizeLocale(part)
      if (found) return found
    }
  }
  return undefined
}

/** The language to use: the user's choice when it names one, otherwise the detected one, otherwise English. */
export function chooseLanguage(preference, detected) {
  if (preference && preference !== 'auto' && BY_CODE.has(preference)) return preference
  return BY_CODE.has(detected) ? detected : DEFAULT_LANGUAGE
}

// ---- width in terminal cells ---------------------------------------------------------------------------------------------

/** Characters that take two cells in a terminal: East Asian wide and fullwidth forms, and emoji. */
const isWide = cp => (
  (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) ||
  (cp >= 0x1f900 && cp <= 0x1f9ff) || (cp >= 0x20000 && cp <= 0x3fffd)
)
const isMark = cp => (cp >= 0x300 && cp <= 0x36f) || cp === 0x200b || (cp >= 0xfe00 && cp <= 0xfe0f)

/** How many terminal cells a string takes (ANSI escapes are not counted). */
export function cellWidth(text) {
  let width = 0
  for (const ch of String(text).replace(/\x1b\[[0-9;]*m/g, '')) {
    const cp = ch.codePointAt(0)
    width += isMark(cp) ? 0 : isWide(cp) ? 2 : 1
  }
  return width
}

/** `text` padded with spaces to `cells` terminal cells. */
export const padCells = (text, cells) => text + ' '.repeat(Math.max(0, cells - cellWidth(text)))
