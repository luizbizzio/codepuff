// The /codepuff slash command: a word and what follows it, answered with a line of text. Everything it changes goes through the
// controller's own methods (`api`), so it behaves exactly like the buttons in the pane.

import { CHARACTERS, DEFAULT_NAMES, BAND_SIZES, NAME_MAX, SOUNDS, SOUND_MOMENTS, VOLUMES, cleanName, displayName } from '../core/settings.js'
import { PRESETS, isHex } from '../core/color.js'
import { SCOPES } from './constants.js'

/** @returns {Promise<{ text: string, open?: boolean }>} */
export async function runCommand(api, args = '') {
    const [word = '', ...rest] = String(args).trim().split(/\s+/)
    const value = rest.join(' ')
    const say = text => ({ text })
    switch (word.toLowerCase()) {
      case '':
      case 'open':
      case 'pet': {
        const m = api.model()
        return { text: `${m.pet.name}: ${m.me.label}. Streak ${m.life.current} day${m.life.current === 1 ? '' : 's'}, ${m.age.days} days old. Use /codepuff help for more.`, open: true }
      }
      case 'help': return say('/codepuff [open] · stats [session|all|7d|30d] · name <name> · character <id> · characters · palette <id> · body <#hex> · accent <#hex> · motion <auto|reduced> · band <on|off|small|medium|large> · sound <question|finish|reset5h|resetWeek> <off|chime|bell|pop|ding|tada> · volume <low|medium|high> · mood <on|off> · line <on|off> · restore · export · import <file> · reset stats|pet confirm · palettes')
      case 'palettes': return say('Palettes: ' + PRESETS.map(p => p.id).join(', '))
      case 'stats': {
        if (value && SCOPES.includes(value)) api.setUi({ scope: value })
        const m = api.model()
        return say([`${m.scopeLabel}`, ...m.stats.rows.map(r => (r.group ? `\n${r.group}\n` : '') + `  ${r.label}: ${r.value}`), `Last 14 days: ${m.spark}`].join('\n').replace(/\n\n\n/g, '\n\n'))
      }
      case 'name': { const n = cleanName(value); await api.setPet({ name: n }); return say(n ? `Your pet is now called ${n}.` : `Name cleared. Your pet is called ${displayName(api.pet)} again. (Names are at most ${NAME_MAX} characters.)`) }
      case 'characters': return say(CHARACTERS.map(id => `${id} (${DEFAULT_NAMES[id]})`).join(', '))
      case 'character': {
        if (!CHARACTERS.includes(value)) return say('Characters: ' + CHARACTERS.join(', '))
        await api.setPet({ character: value }); return say(`Switched to ${DEFAULT_NAMES[value]}. Statistics and progress are unchanged.`)
      }
      case 'mood':
        if (!['on', 'off'].includes(value)) return say('Usage: /codepuff mood on|off')
        await api.setPet({ prefs: { mood: value === 'on' } }); return say(value === 'on' ? 'The hearts react to your messages.' : 'The hearts no longer react to your messages (nothing about them is read).')
      case 'volume':
        if (!VOLUMES.includes(value)) return say('Usage: /codepuff volume <' + VOLUMES.join('|') + '>')
        await api.setPet({ prefs: { volume: value } }); return say(`Sound volume: ${value}.`)
      case 'sound': {
        const [moment, choice] = value.split(/\s+/)
        if (!SOUND_MOMENTS.includes(moment) || !SOUNDS.includes(choice)) return say(`Usage: /codepuff sound <${SOUND_MOMENTS.join('|')}> <${SOUNDS.join('|')}>`)
        await api.setPet({ prefs: { sounds: { [moment]: choice } } }); return say(`Sound for ${moment}: ${choice}.`)
      }
      case 'band':
        if (Object.hasOwn(BAND_SIZES, value)) { await api.setPet({ prefs: { band: true, bandSize: value } }); return say(`Compact band: ${value}.`) }
        if (!['on', 'off'].includes(value)) return say('Usage: /codepuff band on|off|small|medium|large')
        await api.setPet({ prefs: { band: value === 'on' } }); return say(`Compact band ${value}.`)
      case 'palette': {
        const preset = PRESETS.find(p => p.id === value)
        if (!preset) return say('Palettes: ' + PRESETS.map(p => p.id).join(', '))
        await api.setPet({ colors: { body: preset.body, accent: preset.accent } }); return say(`Palette: ${preset.name}.`)
      }
      case 'body':
      case 'accent': {
        if (value !== 'default' && !isHex(value)) return say('Use a color like #7cc4ff, or "default".')
        await api.setPet({ colors: { [word]: value === 'default' ? null : value.toLowerCase() } }); return say('Saved.')
      }
      case 'motion':
        if (!['auto', 'reduced'].includes(value)) return say('Motion: auto or reduced.')
        await api.setPet({ prefs: { motion: value } }); return say(`Motion: ${value}.`)
      case 'line':
        if (!['on', 'off'].includes(value)) return say('Usage: /codepuff line on|off')
        await api.setPet({ prefs: { line: value === 'on' } }); return say(`Status line ${value}.`)
      case 'restore': await api.restoreAppearance(); return say('Default appearance restored. Your pet keeps its birthday and statistics.')
      case 'export': { const r = await api.exportBackup(); return say(`Exported ${r.sessions} sessions to ${r.file}`) }
      case 'import': {
        if (!value) return say('Usage: /codepuff import <path to a CodePuff backup>')
        const r = await api.importFile(value)
        return say(r.ok ? `Imported ${r.imported} sessions${r.skipped ? ` (${r.skipped} invalid entries skipped)` : ''}.` : r.error)
      }
      case 'reset': {
        const [what, confirm] = rest
        if (!['stats', 'pet'].includes(what)) return say('Usage: /codepuff reset stats confirm | reset pet confirm')
        if (confirm !== 'confirm') return say(what === 'stats' ? 'This forgets all statistics (a backup is saved first). Your pet stays. Run: /codepuff reset stats confirm' : 'This starts a brand-new pet with a new birthday. Statistics stay. Run: /codepuff reset pet confirm')
        if (what === 'stats') { const r = await api.resetStats(); return say(`Statistics reset (${r.removed} sessions). Backup: ${r.safety}`) }
        await api.resetPet(); return say('A new pet was created. Statistics are unchanged.')
      }
      default: return say(`Unknown option "${word}". Try /codepuff help`)
    }
}
