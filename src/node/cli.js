// The `codepuff` command. Everything that is not the hot-path hook lives here.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openStore } from './store.js'
import { dataDir } from './paths.js'
import { aggregate, activity, petAge } from '../core/aggregate.js'
import { addDays, dayKey } from '../core/days.js'
import { AGENT_LABELS, ago, statRows } from '../core/format.js'
import { focus } from '../core/petstate.js'
import { PRESETS, isHex } from '../core/color.js'
import { CHARACTERS, STYLES, cleanName, displayName, NAME_MAX } from '../core/settings.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version

function parse(args) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=')
      if (inline !== undefined) out.flags[key] = inline
      else if (args[i + 1] && !args[i + 1].startsWith('--') && ['agent', 'scope', 'days', 'port', 'codex-home', 'session'].includes(key)) out.flags[key] = args[++i]
      else out.flags[key] = true
    } else out._.push(arg)
  }
  return out
}

const out = text => process.stdout.write(text + '\n')
const fail = (message, code = 1) => { process.stderr.write(message + '\n'); process.exitCode = code }

const HELP = `CodePuff ${VERSION} — an interactive coding pet for Claude Code and OpenAI Codex.

Usage: codepuff <command>

  (none)                     your pet and a short summary
  stats [--scope session|all|7d|30d] [--agent claude|codex|all] [--json]
  pet                        the full terminal app: live pet, statistics, customization and data controls
  set name <name>            rename your pet (up to ${NAME_MAX} characters; "" for the default)
  set character <${CHARACTERS.join('|')}>
  set style <pixel|3d>
  set band <on|off>          the compact band above the Claude Code prompt
  set body <#rrggbb|default>  set accent <#rrggbb|default>
  set palette <id>           one of: ${PRESETS.map(p => p.id).join(', ')}
  set motion <auto|reduced>
  set restore                restore the default appearance
  data where | export [file] | import <file> [--replace] [--pet]
  data reset stats|pet|appearance --yes | data delete --yes
  install codex|claude [--dry-run]    uninstall codex|claude [--dry-run]
  doctor                     checks the installation
  hook <claude|codex>        (used by the agents; reads an event from stdin)
`

export async function main(argv) {
  const { _: words, flags } = parse(argv)
  const [command = 'status', ...rest] = words
  if (flags.version || command === 'version') return out(VERSION)
  if (flags.help || command === 'help') return out(HELP)
  const store = openStore()
  try {
    switch (command) {
      case 'status': return status(store)
      case 'stats': return stats(store, flags)
      case 'set': return set(store, rest)
      case 'data': return data(store, rest, flags)
      case 'doctor': return (await import('./doctor.js')).doctor(store, ROOT)
      case 'install': return (await import('./install.js')).installCommand(rest[0], flags, ROOT)
      case 'uninstall': return (await import('./install.js')).uninstallCommand(rest[0], flags, ROOT)
      case 'pet': return (await import('./tui.js')).runTui(store)
      default: return fail(`Unknown command "${command}".\n\n${HELP}`, 2)
    }
  } catch (error) {
    fail('codepuff: ' + (error?.message ?? error))
  }
}

// ---- status & stats ------------------------------------------------------------------------------------------

function header(store, records, now) {
  const pet = store.ensurePet(now)
  const today = dayKey(now)
  const age = petAge(pet.createdAt, now)
  const life = activity(records, { today })
  const shown = focus(records, now).current
  return {
    pet,
    line: `${displayName(pet)} (${pet.character}) · ${age.days} day${age.days === 1 ? '' : 's'} old, born ${age.born} · streak ${life.current} day${life.current === 1 ? '' : 's'} (best ${life.longest}) · last active ${life.last ?? 'never'}`,
    now: shown,
    life,
  }
}

function status(store) {
  const now = Date.now()
  const records = store.listRecords()
  const h = header(store, records, now)
  out(h.line)
  const who = h.now.agent ? ` — ${AGENT_LABELS[h.now.agent]}${h.now.project ? ' · ' + h.now.project : ''}` : ''
  out(`Now: ${h.now.label}${who}`)
  const s = aggregate(records, { since: dayKey(now), until: dayKey(now), now })
  out(`Today: ${s.prompts} prompts, ${s.tools.total} tool calls, ${s.tests.run} test runs, ${s.git.commits} commits`)
  out('Run "codepuff stats" for the full picture, or "codepuff pet" for the live companion.')
}

function stats(store, flags) {
  const now = Date.now()
  const today = dayKey(now)
  const records = store.listRecords()
  const h = header(store, records, now)
  const scope = String(flags.scope ?? 'all')
  const agent = flags.agent && AGENT_LABELS[flags.agent] ? flags.agent : 'all'
  const range = /^(\d+)d$/.exec(scope)
  let columns
  let title
  if (scope === 'session') {
    const latest = [...records].filter(r => agent === 'all' || r.agent === agent).sort((a, b) => b.last - a.last)[0]
    if (!latest) return out('No sessions observed yet.')
    title = `Current session: ${AGENT_LABELS[latest.agent]}${latest.pname ? ' · ' + latest.pname : ''} (${latest.sid.slice(0, 8)}), last heard ${ago(latest.last, now)}`
    columns = [{ name: 'This session', stats: aggregate(records, { session: { agent: latest.agent, sid: latest.sid }, now }) }]
  } else {
    const since = range ? addDays(today, -(Number(range[1]) - 1)) : undefined
    title = range ? `Last ${range[1]} days` : 'All time'
    const make = which => aggregate(records, { agent: which, since, now })
    columns = agent === 'all' ? [{ name: 'Combined', stats: make('all') }, { name: 'Claude Code', stats: make('claude') }, { name: 'Codex', stats: make('codex') }] : [{ name: AGENT_LABELS[agent], stats: make(agent) }]
  }
  if (flags.json) return out(JSON.stringify({ pet: h.pet, scope: title, life: { current: h.life.current, longest: h.life.longest, last: h.life.last, activeDays: h.life.total }, columns: columns.map(c => ({ name: c.name, stats: c.stats })) }, null, 2))
  out(h.line)
  out('')
  out(title)
  const rows = statRows(columns[0].stats).map((row, i) => ({ ...row, values: columns.map(c => statRows(c.stats)[i].value) }))
  const labelW = Math.max(...rows.map(r => r.label.length)) + 2
  const colW = columns.map((c, i) => Math.max(c.name.length, ...rows.map(r => r.values[i].length)) + 2)
  out(' '.repeat(labelW) + columns.map((c, i) => c.name.padStart(colW[i])).join(''))
  for (const row of rows) {
    if (row.group) out('\n' + row.group)
    out('  ' + row.label.padEnd(labelW - 2) + row.values.map((v, i) => v.padStart(colW[i])).join(''))
  }
  const toolRows = Object.entries(columns[0].stats.tools.byCategory).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`)
  if (toolRows.length) out('\nTools by category (' + columns[0].name + '): ' + toolRows.join(' · '))
}

// ---- settings --------------------------------------------------------------------------------------------------

function set(store, [key, ...values]) {
  const pet = store.ensurePet()
  const value = values.join(' ')
  switch (key) {
    case 'name': pet.name = cleanName(value); break
    case 'character':
      if (!CHARACTERS.includes(value)) return fail('Characters: ' + CHARACTERS.join(', '))
      pet.character = value
      break
    case 'style':
      if (!STYLES.includes(value)) return fail('Styles: ' + STYLES.join(', '))
      pet.prefs.style = value
      break
    case 'band':
      if (!['on', 'off'].includes(value)) return fail('Usage: codepuff set band on|off')
      pet.prefs.band = value === 'on'
      break
    case 'body':
    case 'accent':
      if (value !== 'default' && !isHex(value)) return fail('Use a color like #7cc4ff, or "default".')
      pet.colors[key] = value === 'default' ? null : value.toLowerCase()
      break
    case 'palette': {
      const preset = PRESETS.find(p => p.id === value)
      if (!preset) return fail('Palettes: ' + PRESETS.map(p => p.id).join(', '))
      pet.colors = { body: preset.body, accent: preset.accent }
      break
    }
    case 'motion':
      if (!['auto', 'reduced'].includes(value)) return fail('Motion: auto or reduced.')
      pet.prefs.motion = value
      break
    case 'restore': store.resetAppearance(); return out('Appearance restored. Your pet keeps its birthday and statistics.')
    default: return fail('Usage: codepuff set name|character|style|band|body|accent|palette|motion <value>, or: codepuff set restore')
  }
  store.writePet(pet)
  const saved = store.ensurePet()
  out(`Saved. ${displayName(saved)} (${saved.character}, ${saved.prefs.style === '3d' ? '3D' : 'pixel'} style)${saved.colors.body ? ' with custom colors' : ''}.`)
}

// ---- data ------------------------------------------------------------------------------------------------------

function data(store, [action, target], flags) {
  switch (action) {
    case 'where': return out(dataDir())
    case 'export': {
      const done = store.exportBackup(target ? resolve(target) : undefined)
      return out(`Exported ${done.sessions} sessions and your pet to ${done.file}`)
    }
    case 'import': {
      if (!target || !existsSync(target)) return fail('Usage: codepuff data import <file> [--replace] [--pet]')
      const done = store.importBackup(readFileSync(resolve(target), 'utf8'), { mode: flags.replace ? 'replace' : 'merge', pet: !!flags.pet })
      if (!done.ok) return fail(done.error)
      out(`Imported ${done.imported} sessions${done.skipped ? ` (${done.skipped} invalid entries skipped)` : ''}.${done.safety ? ' Your previous data was saved to ' + done.safety : ''}${done.newer ? ' The backup is from a newer CodePuff; unknown fields were ignored.' : ''}`)
      return
    }
    case 'reset': {
      if (!['stats', 'pet', 'appearance'].includes(target)) return fail('Usage: codepuff data reset stats|pet|appearance --yes')
      if (!flags.yes) return fail(`This will reset your ${target}. ${target === 'stats' ? 'A safety backup is saved first.' : ''} Run again with --yes to confirm.`)
      if (target === 'stats') { const r = store.resetStats(); return out(`Statistics reset (${r.removed} sessions removed). Your pet is unchanged.${r.safety ? ' Backup: ' + r.safety : ''}`) }
      if (target === 'pet') { store.resetPet(); return out('Your pet was reset: a new pet with a new birthday. Statistics are unchanged.') }
      store.resetAppearance()
      return out('Appearance restored.')
    }
    case 'delete': {
      if (!flags.yes) return fail(`This permanently deletes everything in ${dataDir()}: your pet, its history and all statistics. Run again with --yes to confirm.`)
      store.deleteAll()
      return out('All CodePuff data was deleted.')
    }
    default: return fail('Usage: codepuff data where|export|import|reset|delete')
  }
}
