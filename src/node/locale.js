// The language of the computer, for the programs that run in Node (the terminal app and the command line). The Claude Code mod finds it
// its own way (hooks/register.tsx), because it has no `process`.

import { detectLanguage } from '../core/i18n/index.js'

/** One of CodePuff's languages, or undefined when the system's is not among them. On Windows the Intl locale (the interface language)
 *  comes before the environment, which a Unix shell may have set to something the user never chose; elsewhere the environment first. */
export function systemLanguage(env = process.env) {
  let intl
  try { intl = Intl.DateTimeFormat().resolvedOptions().locale } catch { intl = undefined }
  const vars = [env.CODEPUFF_LANG, env.LC_ALL, env.LC_MESSAGES, env.LANGUAGE, env.LANG]
  return detectLanguage(process.platform === 'win32' ? [env.CODEPUFF_LANG, intl, ...vars.slice(1)] : [...vars, intl])
}
