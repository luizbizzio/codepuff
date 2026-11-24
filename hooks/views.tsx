// What CodePuff draws, as plain functions of the controller's model: the compact band above the prompt, the pet's heading, the
// statistics and the Customize tab. The host's elements come in as arguments (they depend on the surface), and every press goes
// back through the callbacks, so nothing here keeps state or touches the host. The wiring is in register.tsx.

// @ts-ignore
import { PRESETS } from '../src/core/color.js'
// @ts-ignore
import { AGENT_LABELS, duration } from '../src/core/format.js'
// @ts-ignore
import { ringSvg } from '../src/core/render/pie.js'
// @ts-ignore
import { activitySvg, heartsSvg } from '../src/core/render/charts.js'
// @ts-ignore
import { SOUNDS, VOLUMES } from '../src/core/settings.js'
// @ts-ignore
import { petSvg } from '../src/core/render/raster.js'
// @ts-ignore
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'
// @ts-ignore
import { LANGUAGES, padCells, t } from '../src/core/i18n/index.js'

/** The size a picture asks for (its own width and height attributes), so the host draws it at exactly that size.
 *  (Only a picture has a size in pixels: a Box's width and height are in terminal cells, so none is given one.) */
export const sizeOf = (svg: string) => ({ width: Math.round(Number(/ width="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined, height: Math.round(Number(/ height="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined })

export const COLORS: Record<string, string> = { success: '#3fb950', error: '#f85149', permission: '#d29922', investigating: '#d29922', finished: '#3fb950', disconnected: '#8b949e' }
const GLYPH: Record<string, string> = { success: '^_^', finished: '^_^', error: '>_<', permission: 'O_O', investigating: 'o_O', disconnected: '-_-', waiting: '^_^', idle: 'o_o', thinking: 'o.o', sad: 'T_T', hurt: '>_<', petted: '^_^', giggle: '^o^', delighted: '^o^' }

/** The moments that can make a sound: its key in the preferences and the prefix of its buttons (its name is `ui.sound.<moment>`). */
const MOMENTS: [string, string][] = [['question', 'q'], ['finish', 'f'], ['reset5h', 'r5'], ['resetWeek', 'rw']]

type Els = { Box: any; Text: any; Button?: any; Svg?: any; Input?: any }

/** One to five hearts: how much the pet likes the user (filled ones red, the rest outlined). Where the window draws pictures the
 *  hearts say what they mean when the pointer rests on them; in a terminal they are characters. */
export function heartsRow({ Box, Text, Svg }: Els, m: any, surface: string, tooltip = true) {
  const n: number = m.pet.hearts
  const note = t('ui.hearts.note', { n, score: m.pet.heartScore })
  if (tooltip && surface !== 'terminal' && Svg) return <Svg source={heartsSvg(n, { title: note })} width={84} height={15} isInteractive alt={t('ui.hearts.alt', { n })} />
  return (
    <Box flexDirection="row">
      <Text color="#f85149">{'♥'.repeat(n)}</Text>
      <Text dimColor>{'♡'.repeat(5 - n)}</Text>
    </Box>
  )
}

/** The color of the dot and the outline of the status block: green when things went well, amber when it needs you or is worn out,
 *  red when something failed, blue while it works, grey when there is nothing going on. */
function toneOf(state: string): string {
  if (['success', 'finished', 'waiting'].includes(state)) return '#3fb950'
  if (['error', 'hurt'].includes(state)) return '#f85149'
  if (['permission', 'investigating', 'tired'].includes(state)) return '#d29922'
  if (['petted', 'giggle', 'delighted'].includes(state)) return '#f778ba'
  if (['idle', 'sad', 'disconnected'].includes(state)) return '#8b949e'
  return '#58a6ff'
}

/** The plan's windows worth showing (half used or more) as small bars: how much is used, and when it resets. */
function renderPlan({ Box, Text }: Els, plan: any[]) {
  return plan.filter(w => w.percent >= 50).map(w => {
    const filled = Math.max(1, Math.round(w.percent / 10))
    const tone = w.percent >= 90 ? '#f85149' : w.percent >= 70 ? '#d29922' : '#3fb950'
    return (
      <Box key={'plan-' + w.id} flexDirection="row" gap={1}>
        <Text dimColor>{padCells(w.label, 5)}</Text>
        <Box flexDirection="row">
          <Text color={tone}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(10 - filled)}</Text>
        </Box>
        <Text color={tone}>{w.percent + '%'}</Text>
        {w.resetsInMs > 0 ? <Text dimColor>{t('plan.resets', { time: duration(w.resetsInMs) })}</Text> : null}
      </Box>
    )
  })
}

/** The compact band: the pet at the left edge, then (hugging it) the streak, the prompts and the hearts, the status block with
 *  the color of what is going on, and the plan's bars when it is getting used up; and at the right edge a ring of how the tasks went. */
export function renderBand(els: Els, m: any, surface: string, onPat: () => void) {
  const { Box, Text, Button, Svg } = els
  const reduced = m.pet.motion === 'reduced'
  const size: number = m.pet.bandHeight
  const ringSize = Math.round(size * 0.6)
  const drawn = surface !== 'terminal' && Svg
  const petPicture = drawn ? petSvg({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers: m.me.helpers, height: size, reduced, motion: m.pet.motion, crop: 'band', hover: true, title: `${m.pet.name}: ${m.me.label}` }) : ''
  const face = drawn
    ? <Svg source={petPicture} alt={`${m.pet.name}: ${m.me.label}`} isInteractive {...sizeOf(petPicture)} />
    : <Text color={COLORS[m.me.state] ?? undefined}>{GLYPH[m.me.state] ?? 'o_o'}</Text>
  const { ok, failed } = m.outcome
  const total = ok + failed
  const tip = total ? t('ui.tasksTip', { ok, total, pct: Math.floor((ok / total) * 100), failed }) : t('ui.noTasks')
  const ring = drawn
    ? <Svg source={ringSvg({ ok, failed, size: ringSize, title: tip })} width={ringSize} height={ringSize} isInteractive alt={tip} />
    : null
  const days = m.life.current
  const tone = toneOf(m.me.state)
  // The pet at the left, the ring at the right (with a margin, not flush against the edge), and the information centered in the
  // space between them: the streak, prompts and hearts above, the status block (a fixed minimum width, so it does not jump as the
  // words change) in the middle, the plan's bars below.
  return (
    <Box flexDirection="row" gap={2} alignItems="center" paddingRight={3}>
      {face}
      <Box flexGrow={1} />
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Box flexDirection="row" gap={2} justifyContent="center">
          <Text dimColor>{`🔥 ${t('unit.day', { n: days })}  ·  💬 ${t('unit.prompt', { n: m.sessionPrompts })}`}</Text>
          {m.pet.mood ? heartsRow(els, m, surface, false) : null}
        </Box>
        <Box borderStyle="round" borderColor={tone} paddingX={2} minWidth={34} flexDirection="row" gap={1} justifyContent="center">
          <Text color={tone}>●</Text>
          <Button plain key="pet-it" onPress={onPat}>{m.me.label}</Button>
        </Box>
        {renderPlan(els, m.plan ?? [])}
      </Box>
      <Box flexGrow={1} />
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        {ring}
        <Box flexDirection="row" gap={1} justifyContent="center">
          <Text color="#3fb950">{'✔ ' + ok}</Text>
          <Text color="#f85149">{'✖ ' + failed}</Text>
        </Box>
      </Box>
    </Box>
  )
}

/** The name, hearts and what the pet is doing (and, in the docked pane, which session and what else is going on). */
export function renderHead(els: Els, m: any, isWidget: boolean, surface: string) {
  const { Box, Text } = els
  const who = `${AGENT_LABELS.claude}${m.sessionLabel ? ' · ' + m.sessionLabel : ''}`
  return (
    <Box flexDirection="column">
      <Text weight="bold">{m.pet.name}</Text>
      {m.pet.mood && heartsRow(els, m, surface)}
      <Text color={COLORS[m.me.state]}>{m.me.label}</Text>
      {!isWidget && <Text dimColor>{who}</Text>}
      {!isWidget && m.otherCount > 0 && (
        <Text dimColor wrap="truncate-end">
          {t('ui.also', { list: m.others.map((o: any) => `${AGENT_LABELS[o.agent as 'claude' | 'codex']}${o.project ? ' · ' + o.project : ''} (${o.label.toLowerCase()})`).slice(0, 2).join('; ') + (m.otherCount > 2 ? ` +${m.otherCount - 2}` : '') })}
        </Text>
      )}
    </Box>
  )
}

/** The Statistics and Customize buttons. */
export function renderTabs({ Box, Button }: Els, m: any, ctl: any) {
  return (
    <Box gap={1} flexWrap="wrap">
      {(['stats', 'look'] as const).map(tab => (
        <Button key={'tab-' + tab} variant={m.ui.tab === tab ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ tab })}>
          {t(tab === 'stats' ? 'ui.tab.stats' : 'ui.tab.look')}
        </Button>
      ))}
    </Box>
  )
}

/** The Statistics tab: the platform, the period, the few numbers that matter as tiles, how the work went, what it was made of,
 *  and (only when asked for) the long list of every number. */
export function renderStats(els: Els, m: any, ctl: any, tabs: any, surface: string) {
  const { Box, Text, Button, Svg } = els as Required<Els>
  const { ok, failed } = m.stats
  const settled = ok + failed
  const green = settled ? Math.max(ok ? 1 : 0, Math.round((ok / settled) * 24)) : 0
  const chart = activitySvg(m.chart, { width: 280, height: 64 })
  const chartSize = sizeOf(chart)
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      <Text weight="bold">{t('ui.platform')}</Text>
      <Box gap={1} flexWrap="wrap">
        {m.platforms.map((agent: string) => (
          <Button key={'agent-' + agent} variant={m.ui.agent === agent ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ agent })}>
            {agent === 'all' ? t('agent.all') : AGENT_LABELS[agent as 'claude' | 'codex']}
          </Button>
        ))}
      </Box>
      <Text weight="bold">{t('ui.period')}</Text>
      <Box gap={1} flexWrap="wrap">
        {m.periods.map((scope: string) => (
          <Button key={'scope-' + scope} variant={m.period === scope ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ scope })}>
            {t('ui.period.' + scope)}
          </Button>
        ))}
      </Box>
      <Text dimColor>{m.rangeLabel}</Text>
      <Box gap={1} flexWrap="wrap">
        {m.stats.tiles.map((tile: any) => (
          <Box key={'tile-' + tile.id} flexDirection="column" alignItems="center" borderStyle="round" borderColor="#30363d" paddingX={1} minWidth={17}>
            <Text weight="bold">{tile.value}</Text>
            <Text dimColor>{tile.label}</Text>
            {tile.note ? <Text dimColor>{tile.note}</Text> : null}
          </Box>
        ))}
      </Box>
      {settled > 0 && (
        <Box flexDirection="row" gap={1}>
          <Box minWidth={9}><Text dimColor>{t('ui.success')}</Text></Box>
          <Text color="#3fb950">{'█'.repeat(green)}</Text>
          <Text color="#f85149">{'█'.repeat(Math.max(failed ? 1 : 0, 24 - green))}</Text>
          <Text dimColor>{Math.round((ok / settled) * 100)}%</Text>
        </Box>
      )}
      <Text weight="bold">{t('ui.last14')}</Text>
      {surface !== 'terminal' && Svg
        ? <Svg source={chart} {...chartSize} isInteractive alt={t('ui.chartAlt')} />
        : <Text color="#58a6ff">{m.spark}</Text>}
      {m.stats.bars.length > 0 && (
        <Box flexDirection="column">
          <Text weight="bold">{t('ui.whatItDid')}</Text>
          {m.stats.bars.map((bar: any) => (
            <Box key={'bar-' + bar.id} flexDirection="row" gap={1}>
              <Box minWidth={9}><Text dimColor>{bar.label}</Text></Box>
              <Text color="#58a6ff">{'█'.repeat(Math.max(1, Math.round(bar.share * 16)))}</Text>
              <Text>{bar.count}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Button key="details" onPress={() => ctl.setUi({ details: !m.ui.details })}>{t(m.ui.details ? 'ui.hideAll' : 'ui.showAll')}</Button>
      {m.ui.details && (
        <Box flexDirection="column">
          {m.stats.rows.map((row: any) => (
            <Box key={row.id} flexDirection="column">
              {row.group && <Text dimColor>{row.group}</Text>}
              <Box justifyContent="space-between" gap={2}>
                <Text>{row.label}</Text>
                <Text weight="bold">{row.value}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Text dimColor>
        {t('ui.footer', { name: m.pet.name, age: t('unit.day', { n: m.age.days }), streak: m.life.current, best: m.life.longest, active: t('unit.activeDay', { n: m.life.days }), last: m.life.last ?? t('ago.never') })}
      </Text>
    </Box>
  )
}

/** The Customize tab: name, character, colors, settings, sounds and band size. `play` plays a sound as it is chosen. */
export function renderCustomize({ Box, Text, Button, Input }: Els, m: any, ctl: any, tabs: any, picture: any, play: (sound: string, volume: string) => void) {
  const set = (patch: any) => { void ctl.setPet(patch) }
  const choice = (key: string, label: string, on: boolean, onPress: () => void) => <Button key={key} variant={on ? 'primary' : 'secondary'} onPress={onPress}>{label}</Button>
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      {picture}
      <Input key="name" label={t('ui.name')} placeholder={t('ui.name.placeholder', { max: 16, name: m.pet.name })} value={m.pet.isCustom ? m.pet.name : ''} submitLabel={t('ui.save')} onSubmit={(value: string) => set({ name: value })} />
      <Text dimColor>{t('ui.character')}</Text>
      <Box gap={1} flexWrap="wrap">
        {MASCOT_IDS.map((c: string) => choice('char-' + c, MASCOTS[c].name, m.pet.character === c, () => set({ character: c })))}
      </Box>
      <Text dimColor>{t('ui.colors')}</Text>
      <Box gap={1} flexWrap="wrap">
        {PRESETS.map((p: any) => choice('pal-' + p.id, t('palette.' + p.id), (p.body ?? null) === (m.pet.colors.body ?? null) && (p.accent ?? null) === (m.pet.colors.accent ?? null), () => set({ colors: { body: p.body, accent: p.accent } })))}
      </Box>
      <Text dimColor>{t('ui.settings')}</Text>
      <Box gap={1} flexWrap="wrap">
        <Button key="band" onPress={() => set({ prefs: { band: !m.pet.band } })}>{t(m.pet.band ? 'ui.set.band.on' : 'ui.set.band.off')}</Button>
        <Button key="mood" onPress={() => set({ prefs: { mood: !m.pet.mood } })}>{t(m.pet.mood ? 'ui.set.mood.on' : 'ui.set.mood.off')}</Button>
        <Button key="line" onPress={() => set({ prefs: { line: !m.pet.line } })}>{t(m.pet.line ? 'ui.set.line.on' : 'ui.set.line.off')}</Button>
      </Box>
      {MOMENTS.map(([moment, key]) => (
        <Box key={'sounds-' + moment} flexDirection="column" gap={1}>
          <Text dimColor>{t('ui.sound.' + moment)}</Text>
          <Box gap={1} flexWrap="wrap">
            {SOUNDS.map((sound: string) => choice(key + '-' + sound, t('sound.' + sound), m.pet.sounds[moment] === sound, () => { set({ prefs: { sounds: { [moment]: sound } } }); play(sound, m.pet.volume) }))}
          </Box>
        </Box>
      ))}
      <Text dimColor>{t('ui.motion')}</Text>
      <Box gap={1}>
        {(['full', 'calm', 'reduced'] as const).map(level => choice('motion-' + level, t('ui.motion.' + level), m.pet.motion === level, () => set({ prefs: { motion: level } })))}
      </Box>
      <Text dimColor>{t('ui.volume')}</Text>
      <Box gap={1}>
        {VOLUMES.map((volume: string) => choice('v-' + volume, t('ui.volume.' + volume), m.pet.volume === volume, () => { set({ prefs: { volume } }); play(m.pet.sounds.finish === 'off' ? 'chime' : m.pet.sounds.finish, volume) }))}
      </Box>
      <Text dimColor>{t('ui.bandSize')}</Text>
      <Box gap={1}>
        {(['small', 'medium', 'large'] as const).map(size => choice('band-' + size, t('ui.size.' + size), m.pet.bandSize === size, () => set({ prefs: { bandSize: size } })))}
      </Box>
      <Text dimColor>{t('ui.language')}</Text>
      <Box gap={1} flexWrap="wrap">
        {choice('lang-auto', t('ui.language.auto'), m.pet.language === 'auto', () => set({ prefs: { language: 'auto' } }))}
        {LANGUAGES.map((language: any) => choice('lang-' + language.code, language.name, m.pet.language === language.code, () => set({ prefs: { language: language.code } })))}
      </Box>
    </Box>
  )
}
