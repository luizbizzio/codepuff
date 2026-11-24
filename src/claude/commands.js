// The /codepuff slash command: a word and what follows it, answered with a line of text. Everything it changes goes through the
// controller's own methods (`api`), so it behaves exactly like the buttons in the pane. The words of the command stay English (so
// the documentation is true in every language); what it answers is in the active language.

import { CHARACTERS, DEFAULT_NAMES, BAND_SIZES, MOTIONS, NAME_MAX, SOUNDS, SOUND_MOMENTS, VOLUMES, cleanName, displayName } from '../core/settings.js'
import { PRESETS, isHex } from '../core/color.js'
import { LANGUAGE_CODES, t } from '../core/i18n/index.js'
import { SCOPES } from './constants.js'

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
      case 'help': return say('/codepuff [open] · stats [session|all|7d|30d] · name <name> · character <id> · characters · palette <id> · body <#hex> · accent <#hex> · motion <full|calm|reduced> · band <on|off|small|medium|large> · sound <question|finish|reset5h|resetWeek> <off|chime|bell|pop|ding|tada> · volume <low|medium|high> · mood <on|off> · line <on|off> · language <auto|' + LANGUAGE_CODES.join('|') + '> · restore · export · import <file> · reset stats|pet confirm · palettes')
      case 'palettes': return say(t('cmd.palettes', { list: PRESETS.map(p => p.id).join(', ') }))
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
        if (!preset) return say(t('cmd.palettes', { list: PRESETS.map(p => p.id).join(', ') }))
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
