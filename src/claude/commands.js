// The /codepuff slash command: a word and what follows it, answered with a line of text. Everything it changes goes through the
// controller's own methods (`api`), so it behaves exactly like the buttons in the pane. The words of the command stay English (so
// the documentation is true in every language); what it answers is in the active language.

import { CHARACTERS, DEFAULT_NAMES, BAND_SIZES, BREAK_MAX, BREAK_MIN, MOTIONS, REST_MAX, REST_MIN, NAME_MAX, PLAN_MODES, SOUNDS, SOUND_MOMENTS, VOLUMES, cleanName, displayName } from '../core/settings.js'
import { ACCESSORIES, FRAMES, PALETTE_REWARDS, rewardFor } from '../core/rewards.js'
import { MILESTONES } from '../core/milestones.js'
import { PRESETS, isHex } from '../core/color.js'
import { minutesText } from '../core/format.js'
import { LANGUAGE_CODES, t } from '../core/i18n/index.js'
import { SCOPES } from './constants.js'

/** "45", "45m", "1h", "1h30", "1.5h" as minutes (0 when it is none of those). */
function minutesOf(text) {
  const s = String(text).trim().toLowerCase().replace(',', '.')
  let m = /^(\d+)\s*h\s*(\d+)\s*m?(?:in)?$/.exec(s)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/.exec(s)
  if (m) return Math.round(Number(m[1]) * 60)
  m = /^(\d+)\s*(?:m|min|minutes?)?$/.exec(s)
  return m ? Number(m[1]) : 0
}

/** What it takes to earn something, in words ("100 tasks done together!"). */
const how = unlock => { const m = MILESTONES.find(item => item.id === unlock); return m ? t(m.key, { n: m.n }) : '' }

/** @returns {Promise<{ text: string, open?: boolean }>} */
export async function runCommand(api, args = '') {
    const [word = '', ...rest] = String(args).trim().split(/\s+/)
    const value = rest.join(' ')
    const say = text => ({ text })
    const usage = syntax => say(t('cmd.usage', { syntax }))
    switch (word.toLowerCase()) {
      case '':
      case 'open':
      case 'pet': {
        const m = api.model()
        return { text: t('cmd.pet', { name: m.pet.name, label: m.me.label, streak: t('unit.day', { n: m.life.current }), age: t('unit.day', { n: m.age.days }) }), open: true }
      }
      case 'help': return say('/codepuff [open] · stats [session|all|7d|30d] · name <name> · character <id> · characters · palette <id> · body <#hex> · accent <#hex> · motion <full|calm|reduced> · band <on|off|small|medium|large> · sound <question|finish|reset5h|resetWeek> <off|chime|bell|pop|ding|tada> · volume <low|medium|high> · mood <on|off> · line <on|off> · plan <auto|always|five_hour|seven_day|off> · accessory <id|none> · frame <id|none> · achievements · breaks <off|45m|1h|1h30> · breakrest <minutes> · card · language <auto|' + LANGUAGE_CODES.join('|') + '> · restore · export · import <file> · reset stats|pet confirm · palettes')
      case 'palettes': return say(t('cmd.palettes', { list: PRESETS.filter(p => api.model().palettes[p.id] !== false).map(p => p.id).join(', ') }))
      case 'stats': {
        if (value && SCOPES.includes(value)) api.setUi({ scope: value })
        const m = api.model()
        return say([`${m.scopeLabel}`, ...m.stats.rows.map(r => (r.group ? `\n${r.group}\n` : '') + `  ${r.label}: ${r.value}`), t('cmd.last14', { spark: m.spark })].join('\n').replace(/\n\n\n/g, '\n\n'))
      }
      case 'name': { const n = cleanName(value); await api.setPet({ name: n }); return say(n ? t('cmd.name.set', { name: n }) : t('cmd.name.cleared', { name: displayName(api.pet), max: NAME_MAX })) }
      case 'characters': return say(CHARACTERS.map(id => `${id} (${DEFAULT_NAMES[id]})`).join(', '))
      case 'character': {
        if (!CHARACTERS.includes(value)) return say(t('cmd.characters', { list: CHARACTERS.join(', ') }))
        await api.setPet({ character: value }); return say(t('cmd.character.switched', { name: DEFAULT_NAMES[value] }))
      }
      case 'mood':
        if (!['on', 'off'].includes(value)) return usage('/codepuff mood on|off')
        await api.setPet({ prefs: { mood: value === 'on' } }); return say(t(value === 'on' ? 'cmd.mood.on' : 'cmd.mood.off'))
      case 'volume':
        if (!VOLUMES.includes(value)) return usage('/codepuff volume <' + VOLUMES.join('|') + '>')
        await api.setPet({ prefs: { volume: value } }); return say(t('cmd.volume', { value }))
      case 'sound': {
        const [moment, choice] = value.split(/\s+/)
        if (!SOUND_MOMENTS.includes(moment) || !SOUNDS.includes(choice)) return usage(`/codepuff sound <${SOUND_MOMENTS.join('|')}> <${SOUNDS.join('|')}>`)
        await api.setPet({ prefs: { sounds: { [moment]: choice } } }); return say(t('cmd.sound', { moment, choice }))
      }
      case 'band':
        if (Object.hasOwn(BAND_SIZES, value)) { await api.setPet({ prefs: { band: true, bandSize: value } }); return say(t('cmd.band.size', { value })) }
        if (!['on', 'off'].includes(value)) return usage('/codepuff band on|off|small|medium|large')
        await api.setPet({ prefs: { band: value === 'on' } }); return say(t(value === 'on' ? 'cmd.band.on' : 'cmd.band.off'))
      case 'palette': {
        const preset = PRESETS.find(p => p.id === value)
        const open = api.model().palettes
        if (!preset) return say(t('cmd.palettes', { list: PRESETS.filter(p => open[p.id] !== false).map(p => p.id).join(', ') }))
        // The palettes that are rewards stay locked until earned.
        if (open[preset.id] === false) return say(t('cmd.accessory.locked', { name: t('palette.' + preset.id), how: how(PALETTE_REWARDS.find(item => item.id === preset.id).unlock) }))
        await api.setPet({ colors: { body: preset.body, accent: preset.accent } }); return say(t('cmd.palette', { name: t('palette.' + preset.id) }))
      }
      case 'body':
      case 'accent': {
        if (value !== 'default' && !isHex(value)) return say(t('cmd.color.usage'))
        await api.setPet({ colors: { [word]: value === 'default' ? null : value.toLowerCase() } }); return say(t('cmd.saved'))
      }
      case 'motion':
      {
        // ("auto" is the old name of calm, and "off" of reduced.)
        const level = { auto: 'calm', off: 'reduced' }[value] ?? value
        if (!MOTIONS.includes(level)) return say(t('cmd.motion.usage'))
        await api.setPet({ prefs: { motion: level } }); return say(t('cmd.motion', { level }))
      }
      case 'line':
        if (!['on', 'off'].includes(value)) return usage('/codepuff line on|off')
        await api.setPet({ prefs: { line: value === 'on' } }); return say(t(value === 'on' ? 'cmd.line.on' : 'cmd.line.off'))
      case 'accessory': {
        const m = api.model()
        if (value === 'none') { await api.setPet({ prefs: { accessory: 'none' } }); return say(t('cmd.accessory.none')) }
        const item = m.accessories.find(a => a.id === value)
        if (!item) return say(t('cmd.accessory.usage', { list: m.accessories.filter(a => a.unlocked).map(a => a.id).join(', ') || '-' }))
        if (!item.unlocked) return say(t('cmd.accessory.locked', { name: item.name, how: how(ACCESSORIES.find(a => a.id === item.id).unlock) }))
        await api.setPet({ prefs: { accessory: item.id } }); return say(t('cmd.accessory.set', { name: item.name }))
      }
      case 'frame': {
        const m = api.model()
        if (value === 'none') { await api.setPet({ prefs: { frame: 'none' } }); return say(t('cmd.frame.none')) }
        const item = m.frames.find(f => f.id === value)
        if (!item) return say(t('cmd.frame.usage', { list: m.frames.filter(f => f.unlocked).map(f => f.id).join(', ') || '-' }))
        if (!item.unlocked) return say(t('cmd.accessory.locked', { name: item.name, how: how(FRAMES.find(f => f.id === item.id).unlock) }))
        await api.setPet({ prefs: { frame: item.id } }); return say(t('cmd.frame.set', { name: item.name }))
      }
      case 'achievements': {
        const { done, total } = api.model().achievements
        const reached = api.pet.milestones ?? []
        const lines = MILESTONES.map(m => {
          const reward = rewardFor(m.id)
          return `${reached.includes(m.id) ? '✔' : '·'} ${t(m.key, { n: m.n })}${reward ? ' (' + t('ui.ach.reward', { name: t(reward.key) }) + ')' : ''}`
        })
        return say([t('ui.ach') + ' · ' + t('ui.ach.count', { done, total }), ...lines].join('\n'))
      }
      case 'breaks': {
        if (value === 'off') { await api.setPet({ prefs: { breakEvery: 0 } }); return say(t('cmd.breaks.off')) }
        const minutes = minutesOf(value)
        if (minutes < BREAK_MIN || minutes > BREAK_MAX) return usage(`/codepuff breaks <off|45m|1h|1h30|90> (from ${BREAK_MIN} minutes to ${BREAK_MAX / 60} hours)`)
        await api.setPet({ prefs: { breakEvery: minutes } })
        return say(t('cmd.breaks.on', { time: minutesText(minutes) }))
      }
      case 'breakrest': {
        const minutes = minutesOf(value)
        if (minutes < REST_MIN || minutes > REST_MAX) return usage(`/codepuff breakrest <${REST_MIN} to ${REST_MAX} minutes>`)
        await api.setPet({ prefs: { breakRest: minutes } })
        return say(t('cmd.breaks.rest', { time: minutesText(minutes) }))
      }
      case 'card': { const saved = await api.saveCard({ notify: false }); return say(t('cmd.card.saved', { file: saved.file })) }
      case 'plan': {
        // (A few easier words for the same choices.)
        const mode = { '5h': 'five_hour', week: 'seven_day', weekly: 'seven_day', on: 'always', both: 'always' }[value] ?? value
        if (!PLAN_MODES.includes(mode)) return usage('/codepuff plan <' + PLAN_MODES.join('|') + '>')
        await api.setPet({ prefs: { plan: mode } }); return say(t('cmd.plan.' + mode))
      }
      case 'language': {
        // The code as written ("pt-BR", or "pt-br" in any case), or auto.
        const code = value.toLowerCase() === 'auto' ? 'auto' : LANGUAGE_CODES.find(item => item.toLowerCase() === value.toLowerCase())
        if (!code) return say(t('cmd.language.usage', { list: LANGUAGE_CODES.join(', ') }))
        await api.setPet({ prefs: { language: code } }); return say(t('cmd.language', { value: code }))
      }
      case 'restore': await api.restoreAppearance(); return say(t('cmd.restore'))
      case 'export': { const r = await api.exportBackup(); return say(t('cmd.export', { n: r.sessions, file: r.file })) }
      case 'import': {
        if (!value) return say(t('cmd.import.usage'))
        const r = await api.importFile(value)
        return say(r.ok ? (r.skipped ? t('cmd.import.skipped', { n: r.imported, skipped: r.skipped }) : t('cmd.import.done', { n: r.imported })) : r.error)
      }
      case 'reset': {
        const [what, confirm] = rest
        if (!['stats', 'pet'].includes(what)) return say(t('cmd.reset.usage'))
        if (confirm !== 'confirm') return say(t(what === 'stats' ? 'cmd.reset.stats.ask' : 'cmd.reset.pet.ask'))
        if (what === 'stats') { const r = await api.resetStats(); return say(t('cmd.reset.stats.done', { n: r.removed, file: r.safety })) }
        await api.resetPet(); return say(t('cmd.reset.pet.done'))
      }
      default: return say(t('cmd.unknown', { word }))
    }
}
