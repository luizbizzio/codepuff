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
import { AGENT_LABELS, ago, statBars, statRows, statTiles } from '../core/format.js'
import { focus } from '../core/petstate.js'
import { PRESETS } from '../core/color.js'
import { CHARACTERS, DEFAULT_NAMES, NAME_MAX, cleanName, displayName } from '../core/settings.js'
import { terminalFrame, toAnsi } from '../core/render/raster.js'
import { LANGUAGES, LANGUAGE_CODES, cellWidth, chooseLanguage, padCells, setLanguage, t } from '../core/i18n/index.js'
import { systemLanguage } from './locale.js'

const ESC = '\x1b'
const COLORS = { success: '38;2;63;185;80', finished: '38;2;63;185;80', error: '38;2;248;81;73', permission: '38;2;210;153;34', investigating: '38;2;210;153;34', disconnected: '38;2;139;148;158' }
const dim = text => `${ESC}[2m${text}${ESC}[0m`
const bold = text => `${ESC}[1m${text}${ESC}[0m`
const inverse = text => `${ESC}[7m${text}${ESC}[0m`
const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '')
const tabNames = () => [t('tui.tab.pet'), t('ui.tab.stats'), t('ui.tab.look'), t('tui.tab.data')]
const PERIODS = ['session', '7d', '30d', 'all']
const BLOCKS = '▁▂▃▄▅▆▇█'

export async function runTui(store, { tab: startTab = 0, host: wantedHost } = {}) {
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
  // The host is the agent this terminal sits next to: its platform is listed first and "This session" belongs to it. When it is not
  // said (`codepuff pet --host codex`), it is the agent heard from most recently, and Codex when nothing has been heard.
  const host = wantedHost ?? ([...records].sort((a, b) => b.last - a.last)[0]?.agent ?? 'codex')
  const platforms = host === 'codex' ? ['codex', 'claude', 'all'] : ['claude', 'codex', 'all']
  let scope = 'session'
  let agent = host
  let detail = false
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

  // The pet's language, or the computer's for "auto"; applied before every drawing, so a change made in Claude Code shows up here too.
  const systemLocale = systemLanguage()
  const applyLanguage = () => setLanguage(chooseLanguage(pet.prefs.language, systemLocale))
  applyLanguage()

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

  const center = (text, cols) => ' '.repeat(Math.max(0, Math.floor((cols - cellWidth(text)) / 2))) + text

  const viewPet = (cols, rows, now) => {
    const { current, others } = focus(records, now)
    const state = now < pat ? 'petted' : current.state
    const picture = petPicture(cols - 2, Math.max(6, rows - 11), now, state, current.helpers)
    const today = dayKey(now)
    const life = activity(records, { today })
    const age = petAge(pet.createdAt, now)
    const today_ = aggregate(records, { since: today, until: today, now })
    const where = current.agent ? `${AGENT_LABELS[current.agent]}${current.project ? ' · ' + current.project : ''} · ${current.session.slice(0, 8)}` : ''
    const color = COLORS[state] ? `${ESC}[${COLORS[state]}m` : ''
    return {
      until: picture.until,
      lines: [
        ...picture.lines.map(line => ' '.repeat(Math.max(0, Math.floor((cols - picture.width) / 2))) + line),
        center(bold(displayName(pet)), cols),
        center(`${color}${current.label}${color ? ESC + '[0m' : ''}`, cols),
        center(dim(where || t('tui.waiting')), cols),
        ...(others.length ? [center(dim(t('tui.also', { list: others.slice(0, 3).map(o => `${AGENT_LABELS[o.agent]} ${o.project || ''} (${o.label.toLowerCase()})`).join('; ') + (others.length > 3 ? ` +${others.length - 3}` : '') })), cols)] : []),
        '',
        center(dim(t('tui.today', { prompts: today_.prompts, tools: today_.tools.total, tests: today_.tests.run, commits: today_.git.commits })), cols),
        center(dim(t('tui.life', { streak: life.current, best: life.longest, age: t('unit.day', { n: age.days }), born: age.born })), cols),
        '',
        center(dim(t('tui.petIt')), cols),
      ],
    }
  }

  const viewStats = (cols, rows, now) => {
    const today = dayKey(now)
    const periods = agent === host ? PERIODS : PERIODS.filter(period => period !== 'session')
    if (!periods.includes(scope)) scope = '7d'
    const since = scope === '7d' ? addDays(today, -6) : scope === '30d' ? addDays(today, -29) : undefined
    // "This session" is the host's own most recent session.
    const latest = [...records].filter(r => r.agent === host).sort((a, b) => b.last - a.last)[0]
    const stats = scope === 'session'
      ? aggregate(latest ? [latest] : [], { now })
      : aggregate(records, { agent, since, now })
    const title = scope === 'session' ? t('ui.scope.session', { agent: AGENT_LABELS[agent] }) + (latest ? t('tui.sessionDetail', { project: latest.pname ? latest.pname + ', ' : '', ago: ago(latest.last, now) }) : '') : scope === 'all' ? t('ui.scope.all', { agent: AGENT_LABELS[agent] }) : t('ui.scope.days', { n: Number(scope.slice(0, -1)), agent: AGENT_LABELS[agent] })
    const pick = (list, current, label) => list.map(item => (item === current ? inverse(` ${label(item)} `) : ` ${label(item)} `)).join(' ')
    const platformLine = pick(platforms, agent, a => AGENT_LABELS[a])
    const periodLine = pick(periods, scope, p => t('ui.period.' + p))
    // The few numbers that matter, two to a line; the long list only when asked for (d).
    const tiles = statTiles(stats)
    const cell = tile => `${padCells(tile.label, 14)}${bold(tile.value)}${tile.note ? dim('  ' + tile.note) : ''}`
    const tileLines = []
    for (let k = 0; k < tiles.length; k += 2) {
      const left = cell(tiles[k])
      tileLines.push('  ' + left + (tiles[k + 1] ? ' '.repeat(Math.max(2, 40 - cellWidth(left))) + cell(tiles[k + 1]) : ''))
    }
    const settled = stats.tools.ok + stats.tools.failed
    const green = settled ? Math.max(stats.tools.ok ? 1 : 0, Math.round((stats.tools.ok / settled) * 24)) : 0
    const rate = settled ? `  ${padCells(t('ui.success'), 14)}${ESC}[38;2;63;185;80m${'█'.repeat(green)}${ESC}[38;2;248;81;73m${'█'.repeat(Math.max(stats.tools.failed ? 1 : 0, 24 - green))}${ESC}[0m ${Math.round((stats.tools.ok / settled) * 100)}%` : ''
    const week = series(records, { days: 30, today, agent })
    const peak = Math.max(1, ...week.map(d => d.tools))
    const spark = week.map(d => BLOCKS[Math.min(7, Math.floor((d.tools / peak) * 7.999))]).join('')
    const bars = statBars(stats, 5)
    const claude = aggregate(records, { agent: 'claude', since, now })
    const codex = aggregate(records, { agent: 'codex', since, now })
    const share = claude.tools.total + codex.tools.total ? Math.round((claude.tools.total / (claude.tools.total + codex.tools.total)) * 24) : 12
    const detailRows = []
    if (detail) {
      detailRows.push('')
      for (const r of statRows(stats)) detailRows.push(r.group ? '  ' + bold(r.group) : '  ' + padCells(r.label, 32) + r.value)
    }
    return {
      lines: [
        bold(t('ui.platform')) + '  ' + platformLine,
        bold(t('ui.period')) + '  ' + periodLine,
        dim(t('tui.keys.stats', { toggle: t(detail ? 'tui.hide' : 'tui.show') })), '',
        bold(title), '',
        ...tileLines,
        ...(rate ? ['', rate] : []),
        '',
        `${t('tui.calls30')}  ${ESC}[38;2;88;166;255m${spark}${ESC}[0m`,
        ...(bars.length ? ['', bold(t('ui.whatItDid')), ...bars.map(b => `  ${padCells(b.label, 9)} ${ESC}[38;2;88;166;255m${'█'.repeat(Math.max(1, Math.round(b.share * 24)))}${ESC}[0m ${b.count}`)] : []),
        ...(agent === 'all' ? ['', `Claude Code ${ESC}[38;2;217;119;87m${'█'.repeat(share)}${ESC}[38;2;88;166;255m${'█'.repeat(24 - share)}${ESC}[0m Codex   (${claude.tools.total} · ${t('tui.toolCalls', { n: codex.tools.total })})`] : []),
        ...detailRows,
      ],
    }
  }

  const items = () => [
    { label: t('tui.item.character'), value: DEFAULT_NAMES[pet.character], left: () => cycleCharacter(-1), right: () => cycleCharacter(1) },
    { label: t('tui.item.palette'), value: currentPalette(), left: () => cyclePalette(-1), right: () => cyclePalette(1) },
    { label: t('tui.item.name'), value: pet.name || `${displayName(pet)} ${t('tui.default')}`, enter: () => { prompt = { label: t('tui.namePrompt', { max: NAME_MAX }), value: pet.name, then: v => { save({ name: cleanName(v) }); message = t('tui.nameSaved') } } } },
    { label: t('tui.item.reduced'), value: pet.prefs.motion === 'reduced' ? t('tui.on') : t('tui.off'), left: toggleMotion, right: toggleMotion, enter: toggleMotion },
    { label: t('tui.item.language'), value: languageName(), left: () => cycleLanguage(-1), right: () => cycleLanguage(1) },
    { label: t('tui.item.restore'), value: '', enter: () => { store.resetAppearance(); pet = store.readPet().pet; message = t('tui.restored') } },
  ]
  const currentPalette = () => PRESETS.find(p => (p.body ?? null) === (pet.colors.body ?? null) && (p.accent ?? null) === (pet.colors.accent ?? null))?.id ? t('palette.' + PRESETS.find(p => (p.body ?? null) === (pet.colors.body ?? null) && (p.accent ?? null) === (pet.colors.accent ?? null)).id) : t('palette.custom')
  // Language: automatic, then each of the languages; the arrows go around the list.
  const languageChoices = ['auto', ...LANGUAGE_CODES]
  const languageName = () => (pet.prefs.language === 'auto' ? `${t('ui.language.auto')} (${LANGUAGES.find(l => l.code === chooseLanguage('auto', systemLocale))?.name})` : LANGUAGES.find(l => l.code === pet.prefs.language)?.name ?? pet.prefs.language)
  const cycleLanguage = d => { save({ prefs: { language: languageChoices[(languageChoices.indexOf(pet.prefs.language) + d + languageChoices.length) % languageChoices.length] } }); applyLanguage() }
  const cycleCharacter = d => save({ character: CHARACTERS[(CHARACTERS.indexOf(pet.character) + d + CHARACTERS.length) % CHARACTERS.length] })
  const toggleMotion = () => save({ prefs: { motion: pet.prefs.motion === 'reduced' ? 'calm' : 'reduced' } })
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
        ...items().map((it, i) => { const text = `  ${padCells(it.label, 28)}${it.left ? '◀ ' : '  '}${it.value}${it.right ? ' ▶' : ''}`; return i === row ? inverse(padCells(text, Math.min(cols, 64))) : text }),
        '',
        dim(t('tui.help.look')),
      ],
    }
  }

  const viewData = () => {
    const usage = store.usage()
    return {
      lines: [
        bold(t('tui.data.where')), `  ${store.dir}`, dim(t('tui.data.size', { files: usage.files, kb: (usage.bytes / 1024).toFixed(1) })), '',
        bold(t('tui.data.backup')), t('tui.data.backup.keys'), '',
        bold(t('tui.data.reset')), t('tui.data.reset.stats'), t('tui.data.reset.pet'), t('tui.data.delete'), '',
        dim(t('tui.data.local')),
      ],
    }
  }

  // ---- drawing --------------------------------------------------------------------------------------------------

  const draw = () => {
    clearTimeout(frameTimer)
    const now = Date.now()
    const cols = out.columns ?? 80
    const rows = out.rows ?? 24
    applyLanguage()
    const header = tabNames().map((name, i) => (i === tab ? inverse(` ${i + 1} ${name} `) : dim(` ${i + 1} ${name} `))).join(' ')
    const body = [viewPet, viewStats, viewLook, viewData][tab](cols, rows, now)
    const footer = prompt ? `${prompt.label}: ${prompt.value}${ESC}[7m ${ESC}[0m   ${t('tui.footer.prompt')}` : confirm ? `${confirm.text}  ${t('tui.footer.confirm')}` : message ? bold(message) : dim(t('tui.footer.keys'))
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
      else if (key === ESC) { prompt = undefined; message = t('tui.cancelled') }
      else if (key === '\x7f' || key === '\b') prompt.value = [...prompt.value].slice(0, -1).join('')
      else if (key >= ' ' && !key.startsWith(ESC) && [...prompt.value].length < 240) prompt.value += key
      return draw()
    }
    if (confirm) {
      const c = confirm
      confirm = undefined
      if (key === 'y' || key === 'Y') { try { c.then() } catch (error) { message = error.message } } else message = t('tui.cancelled')
      return draw()
    }
    message = ''
    if (key === 'q') return finish()
    if (key >= '1' && key <= '4') tab = Number(key) - 1
    else if (key === '\t') tab = (tab + 1) % 4
    else if (key === ' ') pat = Date.now() + 900
    else if (tab === 1 && key === 's') { const list = agent === host ? PERIODS : PERIODS.filter(period => period !== 'session'); scope = list[(list.indexOf(scope) + 1) % list.length] }
    else if (tab === 1 && key === 'a') { agent = platforms[(platforms.indexOf(agent) + 1) % platforms.length]; if (agent !== host && scope === 'session') scope = '7d' }
    else if (tab === 1 && key === 'd') detail = !detail
    else if (tab === 2) {
      const list = items()
      if (key === `${ESC}[A`) row = (row + list.length - 1) % list.length
      else if (key === `${ESC}[B`) row = (row + 1) % list.length
      else if (key === `${ESC}[D`) list[row].left?.()
      else if (key === `${ESC}[C`) list[row].right?.()
      else if (key === '\r') list[row].enter?.()
    } else if (tab === 3) {
      if (key === 'e') message = t('tui.exported', { file: store.exportBackup().file })
      else if (key === 'i') prompt = { label: t('tui.import.path'), value: '', then: path => { const done = store.importBackup(readFileSync(resolve(path), 'utf8'), { mode: 'merge', pet: false }); message = done.ok ? t('tui.import.done', { n: done.imported }) : done.error } }
      else if (key === 'x') confirm = { text: t('tui.reset.ask'), then: () => { const r = store.resetStats(); message = t('tui.reset.done', { n: r.removed, file: r.safety ?? t('tui.reset.none') }) } }
      else if (key === 'p') confirm = { text: t('tui.pet.ask'), then: () => { store.resetPet(); pet = store.readPet().pet; message = t('tui.pet.done') } }
      else if (key === 'd') prompt = { label: t('tui.delete.prompt'), value: '', then: v => { if (v !== 'DELETE') throw new Error(t('tui.delete.no')); store.deleteAll(); message = t('tui.delete.done'); pet = store.ensurePet() } }
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
