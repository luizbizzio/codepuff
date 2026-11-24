// `codepuff pet`: the full CodePuff app for terminals. There is no web server and no window system involved: it is a
// keyboard-driven terminal program with four views (Pet, Statistics, Customize, Data). Run it in a split or a second
// tab next to Codex (or Claude Code) and it shows the pet reacting to real activity from every agent on this machine.
//
// It does the least work it can: it re-reads the shared records once a second (only files that changed are parsed),
// redraws only when the screen text changed, and wakes for animation only when the next frame is due. With reduced
// motion on, nothing animates and no frame timers exist.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { aggregate, activity, petAge, series } from '../core/aggregate.js'
import { addDays, dayKey } from '../core/days.js'
import { AGENT_LABELS, CATEGORY_LABELS, ago, statRows } from '../core/format.js'
import { focus } from '../core/petstate.js'
import { PRESETS } from '../core/color.js'
import { CHARACTERS, DEFAULT_NAMES, NAME_MAX, cleanName, displayName } from '../core/settings.js'
import { terminalFrame, toAnsi } from '../core/render/raster.js'

const ESC = '\x1b'
const COLORS = { success: '38;2;63;185;80', finished: '38;2;63;185;80', error: '38;2;248;81;73', permission: '38;2;210;153;34', investigating: '38;2;210;153;34', disconnected: '38;2;139;148;158' }
const dim = text => `${ESC}[2m${text}${ESC}[0m`
const bold = text => `${ESC}[1m${text}${ESC}[0m`
const inverse = text => `${ESC}[7m${text}${ESC}[0m`
const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '')
const TABS = ['Pet', 'Statistics', 'Customize', 'Data']
const SCOPES = ['session', 'all', '7d', '30d']
const AGENTS = ['all', 'claude', 'codex']
const BLOCKS = '▁▂▃▄▅▆▇█'

export async function runTui(store, { tab: startTab = 0 } = {}) {
  const out = process.stdout
  if (!out.isTTY) {
    const pet = store.ensurePet()
    const frame = terminalFrame({ character: pet.character, state: 'idle', reduced: true, columns: 40 })
    out.write(toAnsi(frame.canvas, frame.palette, frame.box, frame.factor).join('\n') + '\n')
    return
  }
  let pet = store.ensurePet()
  let records = store.listRecords()
  let tab = startTab
  let scope = 'all'
  let agent = 'all'
  let row = 0 // selected row in Customize
  let pat = 0
  let message = ''
  let prompt // { label, value, then(value) } while typing
  let confirm // { text, then() } while asking for y/n
  let epoch = { key: '', at: Date.now() }
  let lastScreen = ''
  let frameTimer
  let pollTimer
  let done

  const reduced = () => pet.prefs.motion === 'reduced' || ['1', 'true'].includes(process.env.CODEPUFF_REDUCED_MOTION ?? '')
  const save = patch => {
    pet = { ...pet, ...patch, colors: { ...pet.colors, ...(patch.colors ?? {}) }, prefs: { ...pet.prefs, ...(patch.prefs ?? {}) } }
    store.writePet(pet)
    pet = store.readPet().pet
  }

  // ---- views ---------------------------------------------------------------------------------------------------

  const petPicture = (cols, rows, now, state, helpers) => {
    const key = [pet.character, pet.colors.body, pet.colors.accent, state, helpers].join('|')
    if (epoch.key !== key) epoch = { key, at: now }
    const frame = terminalFrame({ character: pet.character, colors: pet.colors, state, helpers, elapsed: now - epoch.at, reduced: reduced(), columns: cols, rows })
    return { lines: toAnsi(frame.canvas, frame.palette, frame.box, frame.factor), width: frame.columns, until: frame.until }
  }

  const center = (text, cols) => ' '.repeat(Math.max(0, Math.floor((cols - plain(text).length) / 2))) + text

  const viewPet = (cols, rows, now) => {
    const { current, others } = focus(records, now)
    const state = now < pat ? 'petted' : current.state
    const picture = petPicture(cols - 2, Math.max(6, rows - 11), now, state, current.helpers)
    const today = dayKey(now)
    const life = activity(records, { today })
    const age = petAge(pet.createdAt, now)
    const t = aggregate(records, { since: today, until: today, now })
    const where = current.agent ? `${AGENT_LABELS[current.agent]}${current.project ? ' · ' + current.project : ''} · ${current.session.slice(0, 8)}` : ''
    const color = COLORS[state] ? `${ESC}[${COLORS[state]}m` : ''
    return {
      until: picture.until,
      lines: [
        ...picture.lines.map(line => ' '.repeat(Math.max(0, Math.floor((cols - picture.width) / 2))) + line),
        center(bold(displayName(pet)), cols),
        center(`${color}${current.label}${color ? ESC + '[0m' : ''}`, cols),
        center(dim(where || 'waiting for an agent…'), cols),
        ...(others.length ? [center(dim('also: ' + others.slice(0, 3).map(o => `${AGENT_LABELS[o.agent]} ${o.project || ''} (${o.label.toLowerCase()})`).join('; ') + (others.length > 3 ? ` +${others.length - 3}` : '')), cols)] : []),
        '',
        center(dim(`today ${t.prompts} prompts · ${t.tools.total} tools · ${t.tests.run} tests · ${t.git.commits} commits`), cols),
        center(dim(`streak ${life.current}d (best ${life.longest}) · ${age.days} days old · born ${age.born}`), cols),
        '',
        center(dim('[space] pet it'), cols),
      ],
    }
  }

  const viewStats = (cols, rows, now) => {
    const today = dayKey(now)
    const since = scope === '7d' ? addDays(today, -6) : scope === '30d' ? addDays(today, -29) : undefined
    const latest = [...records].sort((a, b) => b.last - a.last)[0]
    const stats = scope === 'session'
      ? aggregate(latest ? [latest] : [], { now })
      : aggregate(records, { agent, since, now })
    const title = scope === 'session' ? `This session${latest ? `: ${AGENT_LABELS[latest.agent]}${latest.pname ? ' · ' + latest.pname : ''}, ${ago(latest.last, now)}` : ''}` : `${scope === 'all' ? 'All time' : 'Last ' + scope.slice(0, -1) + ' days'} · ${AGENT_LABELS[agent]}`
    const rowsOut = statRows(stats)
    const wide = cols >= 96
    const cells = []
    for (const r of rowsOut) { if (r.group) cells.push({ group: r.group }); cells.push(r) }
    const fmt = r => (r.group ? bold(r.group) : `${r.label.padEnd(30)}${r.value}`)
    const lines = []
    if (wide) {
      const half = Math.ceil(cells.length / 2)
      for (let i = 0; i < half; i++) lines.push('  ' + (fmt(cells[i]) + ' '.repeat(Math.max(0, 48 - plain(fmt(cells[i])).length))) + (cells[i + half] ? fmt(cells[i + half]) : ''))
    } else for (const c of cells) lines.push('  ' + fmt(c))
    const week = series(records, { days: 30, today, agent: scope === 'session' ? 'all' : agent })
    const peak = Math.max(1, ...week.map(d => d.tools))
    const spark = week.map(d => BLOCKS[Math.min(7, Math.floor((d.tools / peak) * 7.999))]).join('')
    const cats = Object.entries(stats.tools.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const top = Math.max(1, ...cats.map(([, v]) => v))
    const claude = aggregate(records, { agent: 'claude', since, now })
    const codex = aggregate(records, { agent: 'codex', since, now })
    const share = claude.tools.total + codex.tools.total ? Math.round((claude.tools.total / (claude.tools.total + codex.tools.total)) * 24) : 12
    return {
      lines: [
        bold(title), dim('[s] scope: This session / All time / 7d / 30d   [a] agent: Combined / Claude Code / Codex'), '',
        ...lines, '',
        `Tool calls, last 30 days  ${ESC}[38;2;88;166;255m${spark}${ESC}[0m`,
        ...(cats.length ? ['Tools by category: ' + cats.map(([k, v]) => `${CATEGORY_LABELS[k] ?? k} ${v}`).join(' · ')] : []),
        ...(cats.length ? cats.map(([k, v]) => `  ${(CATEGORY_LABELS[k] ?? k).padEnd(8)} ${'█'.repeat(Math.max(1, Math.round((v / top) * 24)))} ${v}`) : []),
        `Claude Code ${ESC}[38;2;217;119;87m${'█'.repeat(share)}${ESC}[38;2;88;166;255m${'█'.repeat(24 - share)}${ESC}[0m Codex   (${claude.tools.total} · ${codex.tools.total} tool calls)`,
      ],
    }
  }

  const items = () => [
    { label: 'Character', value: DEFAULT_NAMES[pet.character], left: () => cycleCharacter(-1), right: () => cycleCharacter(1) },
    { label: 'Palette', value: currentPalette(), left: () => cyclePalette(-1), right: () => cyclePalette(1) },
    { label: 'Name', value: pet.name || `${displayName(pet)} (default)`, enter: () => { prompt = { label: `Name (up to ${NAME_MAX} characters, empty for the default)`, value: pet.name, then: v => { save({ name: cleanName(v) }); message = 'Name saved.' } } } },
    { label: 'Reduced motion', value: pet.prefs.motion === 'reduced' ? 'on' : 'off', left: toggleMotion, right: toggleMotion, enter: toggleMotion },
    { label: 'Restore default appearance', value: '', enter: () => { store.resetAppearance(); pet = store.readPet().pet; message = 'Default appearance restored. Birthday and statistics are untouched.' } },
  ]
  const currentPalette = () => PRESETS.find(p => (p.body ?? null) === (pet.colors.body ?? null) && (p.accent ?? null) === (pet.colors.accent ?? null))?.name ?? 'Custom'
  const cycleCharacter = d => save({ character: CHARACTERS[(CHARACTERS.indexOf(pet.character) + d + CHARACTERS.length) % CHARACTERS.length] })
  const toggleMotion = () => save({ prefs: { motion: pet.prefs.motion === 'reduced' ? 'auto' : 'reduced' } })
  const cyclePalette = d => {
    const at = PRESETS.findIndex(p => (p.body ?? null) === (pet.colors.body ?? null) && (p.accent ?? null) === (pet.colors.accent ?? null))
    const next = PRESETS[(at + d + PRESETS.length) % PRESETS.length]
    save({ colors: { body: next.body, accent: next.accent } })
  }

  const viewLook = (cols, rows, now) => {
    const { current } = focus(records, now)
    const picture = petPicture(Math.min(cols - 2, 30), Math.max(5, Math.min(10, rows - 14)), now, now < pat ? 'petted' : current.state === 'disconnected' ? 'idle' : current.state, 0)
    return {
      until: picture.until,
      lines: [
        ...picture.lines.map(line => ' '.repeat(Math.max(0, Math.floor((cols - picture.width) / 2))) + line),
        '',
        ...items().map((it, i) => { const text = `  ${it.label.padEnd(28)}${it.left ? '◀ ' : '  '}${it.value}${it.right ? ' ▶' : ''}`; return i === row ? inverse(text.padEnd(Math.min(cols, 64))) : text }),
        '',
        dim('[↑/↓] choose  [←/→] change  [Enter] edit or press  [space] pet it   Saved automatically; shared with Claude Code and Codex.'),
      ],
    }
  }

  const viewData = () => {
    const usage = store.usage()
    return {
      lines: [
        bold('Where your data lives'), `  ${store.dir}`, dim(`  ${usage.files} files, ${(usage.bytes / 1024).toFixed(1)} KB. Counters and opaque ids only: never prompts, code, commands, paths or outputs.`), '',
        bold('Backup'), '  [e] export statistics and settings    [i] import a backup file', '',
        bold('Reset'), '  [x] reset statistics (keeps the pet, saves a safety backup)', '  [p] reset the pet and its customization (new birthday; keeps statistics)', '  [d] delete all CodePuff data', '',
        dim('Everything stays on this computer: no account, no server, no telemetry.'),
      ],
    }
  }

  // ---- drawing --------------------------------------------------------------------------------------------------

  const draw = () => {
    clearTimeout(frameTimer)
    const now = Date.now()
    const cols = out.columns ?? 80
    const rows = out.rows ?? 24
    const header = TABS.map((name, i) => (i === tab ? inverse(` ${i + 1} ${name} `) : dim(` ${i + 1} ${name} `))).join(' ')
    const body = [viewPet, viewStats, viewLook, viewData][tab](cols, rows, now)
    const footer = prompt ? `${prompt.label}: ${prompt.value}${ESC}[7m ${ESC}[0m   (Enter to save, Esc to cancel)` : confirm ? `${confirm.text}  [y] yes  [n] no` : message ? bold(message) : dim('[1-4] or [Tab] views   [q] quit')
    const screen = [header, '', ...body.lines, '', footer].slice(0, rows)
    const text = screen.join('\n')
    if (text !== lastScreen) {
      lastScreen = text
      out.write(`${ESC}[H${screen.map(line => line + `${ESC}[K`).join('\n')}${ESC}[J`)
    }
    if (!reduced() && Number.isFinite(body.until)) frameTimer = setTimeout(draw, Math.max(60, Math.min(body.until, 1000)))
    else if (now < pat) frameTimer = setTimeout(draw, pat - now + 20)
  }

  const poll = () => {
    records = store.listRecords()
    pet = store.readPet().pet
    draw()
    pollTimer = setTimeout(poll, 1000)
  }

  const finish = () => {
    clearTimeout(frameTimer)
    clearTimeout(pollTimer)
    out.write(`${ESC}[?25h${ESC}[?1049l`)
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stdin.pause()
    done()
  }

  // ---- keys ----------------------------------------------------------------------------------------------------------

  const onKey = key => {
    if (key === '\u0003') return finish()
    if (prompt) {
      if (key === '\r') { const p = prompt; prompt = undefined; try { p.then(p.value) } catch (error) { message = error.message } }
      else if (key === ESC) { prompt = undefined; message = 'Cancelled.' }
      else if (key === '\x7f' || key === '\b') prompt.value = [...prompt.value].slice(0, -1).join('')
      else if (key >= ' ' && !key.startsWith(ESC) && [...prompt.value].length < 240) prompt.value += key
      return draw()
    }
    if (confirm) {
      const c = confirm
      confirm = undefined
      if (key === 'y' || key === 'Y') { try { c.then() } catch (error) { message = error.message } } else message = 'Cancelled.'
      return draw()
    }
    message = ''
    if (key === 'q') return finish()
    if (key >= '1' && key <= '4') tab = Number(key) - 1
    else if (key === '\t') tab = (tab + 1) % TABS.length
    else if (key === ' ') pat = Date.now() + 900
    else if (tab === 1 && key === 's') scope = SCOPES[(SCOPES.indexOf(scope) + 1) % SCOPES.length]
    else if (tab === 1 && key === 'a') agent = AGENTS[(AGENTS.indexOf(agent) + 1) % AGENTS.length]
    else if (tab === 2) {
      const list = items()
      if (key === `${ESC}[A`) row = (row + list.length - 1) % list.length
      else if (key === `${ESC}[B`) row = (row + 1) % list.length
      else if (key === `${ESC}[D`) list[row].left?.()
      else if (key === `${ESC}[C`) list[row].right?.()
      else if (key === '\r') list[row].enter?.()
    } else if (tab === 3) {
      if (key === 'e') message = `Exported to ${store.exportBackup().file}`
      else if (key === 'i') prompt = { label: 'Path to a backup file', value: '', then: path => { const done = store.importBackup(readFileSync(resolve(path), 'utf8'), { mode: 'merge', pet: false }); message = done.ok ? `Imported ${done.imported} sessions.` : done.error } }
      else if (key === 'x') confirm = { text: 'Forget all statistics? A safety backup is saved first.', then: () => { const r = store.resetStats(); message = `Statistics reset (${r.removed} sessions). Backup: ${r.safety ?? 'none needed'}` } }
      else if (key === 'p') confirm = { text: 'Start a brand-new pet with a new birthday? Statistics stay.', then: () => { store.resetPet(); pet = store.readPet().pet; message = 'A new pet was created.' } }
      else if (key === 'd') prompt = { label: 'Type DELETE to remove all CodePuff data', value: '', then: v => { if (v !== 'DELETE') throw new Error('Not deleted.'); store.deleteAll(); message = 'All CodePuff data was deleted.'; pet = store.ensurePet() } }
    }
    draw()
  }

  out.write(`${ESC}[?1049h${ESC}[?25l${ESC}[2J`)
  out.on('resize', () => { lastScreen = ''; out.write(`${ESC}[2J`); draw() })
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => {
      // A burst can carry several keys (a paste, or held arrows): split escape sequences from single characters.
      for (const key of String(chunk).match(/\x1b\[[0-9;]*[A-Za-z~]|\x1b|[\s\S]/g) ?? []) onKey(key)
    })
  }
  process.on('SIGINT', finish)
  process.on('SIGTERM', finish)
  await new Promise(resolve => { done = resolve; poll() })
}
