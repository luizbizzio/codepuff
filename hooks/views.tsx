// What CodePuff draws, as plain functions of the controller's model: the compact band above the prompt, the pet's heading, the
// statistics and the Customize tab. The host's elements come in as arguments (they depend on the surface), and every press goes
// back through the callbacks, so nothing here keeps state or touches the host. The wiring is in register.tsx.

// @ts-ignore
import { PRESETS } from '../src/core/color.js'
// @ts-ignore
import { achievementSvg, TIER_COLORS } from '../src/core/render/badge.js'
// @ts-ignore
import { AGENT_LABELS, minutesText, resetIn } from '../src/core/format.js'
// @ts-ignore
import { bandStyle } from '../src/core/frames.js'
// @ts-ignore
import { ringSvg } from '../src/core/render/pie.js'
// @ts-ignore
import { activitySvg, heartsSvg } from '../src/core/render/charts.js'
// @ts-ignore
import { BREAK_MAX, BREAK_MIN, BREAK_PRESETS, BREAK_STEP, REST_PRESETS, SOUNDS, VOLUMES } from '../src/core/settings.js'
// @ts-ignore
import { petSvg } from '../src/core/render/raster.js'
// @ts-ignore
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'
// @ts-ignore
import { LANGUAGES, cellWidth, t } from '../src/core/i18n/index.js'

/** The size a picture asks for (its own width and height attributes), so the host draws it at exactly that size.
 *  (Only a picture has a size in pixels: a Box's width and height are in terminal cells, so none is given one.) */
export const sizeOf = (svg: string) => ({ width: Math.round(Number(/ width="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined, height: Math.round(Number(/ height="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined })

export const COLORS: Record<string, string> = { success: '#3fb950', error: '#f85149', permission: '#d29922', investigating: '#d29922', finished: '#3fb950', disconnected: '#8b949e' }
const GLYPH: Record<string, string> = { bored: '-_-', coffee: 'u_u', sleeping: '-_-', morning: '^_^', afternoon: '^_^', evening: '^_^', night: 'o_o', stretch: '^o^', success: '^_^', finished: '^_^', error: '>_<', permission: 'O_O', investigating: 'o_O', disconnected: '-_-', waiting: '^_^', idle: 'o_o', thinking: 'o.o', sad: 'T_T', hurt: '>_<', petted: '^_^', giggle: '^o^', delighted: '^o^' }

/** The moments that can make a sound: its key in the preferences and the prefix of its buttons (its name is `ui.sound.<moment>`). */
const MOMENTS: [string, string][] = [['question', 'q'], ['finish', 'f'], ['reset5h', 'r5'], ['resetWeek', 'rw']]

type Els = { Box: any; Text: any; Button?: any; Svg?: any; Input?: any }

/** One to five hearts: how much the pet likes the user (filled ones red, the rest outlined). Where the window draws pictures the
 *  hearts say what they mean when the pointer rests on them; in a terminal they are characters. */
export function heartsRow({ Box, Text, Svg }: Els, m: any, surface: string, tooltip = true, scale = 1) {
  const n: number = m.pet.hearts
  const note = t('ui.hearts.note', { n, score: m.pet.heartScore })
  if (tooltip && surface !== 'terminal' && Svg) return <Svg source={heartsSvg(n, { title: note })} width={Math.round(84 * scale)} height={Math.round(15 * scale)} isInteractive alt={t('ui.hearts.alt', { n })} />
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
  if (['petted', 'giggle', 'delighted', 'morning', 'afternoon', 'evening', 'night', 'stretch'].includes(state)) return '#f778ba'
  if (state === 'coffee') return '#d29922'
  if (['idle', 'sad', 'disconnected', 'bored', 'sleeping'].includes(state)) return '#8b949e'
  return '#58a6ff'
}

/** Which of the plan's windows to draw, by the person's choice: `auto` the ones half used or more, `always` all of them, `five_hour`
 *  or `seven_day` that one only (always), `off` none. */
export function planShown(plan: any[], mode: string): any[] {
  if (mode === 'off') return []
  if (mode === 'always') return plan
  if (mode === 'five_hour' || mode === 'seven_day') return plan.filter(w => w.id === mode)
  return plan.filter(w => w.percent >= 50)
}

/** The plan's windows as small bars: how much is used, and when it resets. Every bar is the same size (the label and the percentage sit in
 *  boxes with a minimum width in cells, the longest label's, so "5h" and "week" do not change it), and a note says so when the person
 *  asked to always see a window and the host reports none. */
function renderPlan({ Box, Text }: Els, plan: any[], mode = 'auto') {
  const shown = planShown(plan, mode)
  if (shown.length === 0) return mode === 'off' || mode === 'auto' ? [] : [<Text key="plan-none" dimColor>{t('plan.none')}</Text>]
  const labelWidth = Math.max(...['five_hour', 'seven_day', 'spend_limit'].map(id => cellWidth(t('plan.' + id))))
  return shown.map(w => {
    const filled = Math.max(1, Math.round(w.percent / 10))
    const tone = w.percent >= 90 ? '#f85149' : w.percent >= 70 ? '#d29922' : '#3fb950'
    return (
      <Box key={'plan-' + w.id} flexDirection="row" gap={1}>
        <Box minWidth={labelWidth}><Text dimColor>{w.label}</Text></Box>
        <Box flexDirection="row">
          <Text color={tone}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(10 - filled)}</Text>
        </Box>
        <Box minWidth={4} justifyContent="flex-end"><Text color={tone}>{w.percent + '%'}</Text></Box>
        {w.resetsInMs > 0 ? <Text dimColor>{t('plan.resets', { time: resetIn(w.resetsInMs) })}</Text> : null}
      </Box>
    )
  })
}

/** The compact band: the pet at the left edge, then the streak, the prompts and the session's estimated cost (when the host reports
 *  one), and under them the status block with the color of what is going on, and the hearts under that; at the right edge a ring of how the tasks went; and, as a strip under all of it, the plan's bars when it
 *  is getting used up (or always, as the person chose). */
export function renderBand(els: Els, m: any, surface: string, onPat: () => void) {
  const { Box, Text, Button, Svg } = els
  const reduced = m.pet.motion === 'reduced'
  const size: number = m.pet.bandHeight
  const ringSize = Math.round(size * 0.6)
  const drawn = surface !== 'terminal' && Svg
  const petPicture = drawn ? petSvg({ character: m.pet.character, worn: m.pet.worn, colors: m.pet.colors, state: m.me.state, helpers: m.me.helpers, height: size, reduced, motion: m.pet.motion, crop: 'band', hover: true, title: `${m.pet.name}: ${m.me.label}` }) : ''
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
  // space between them: the streak, prompts and estimated cost above, the status block (a fixed minimum width, so it does not jump as
  // the words change) below, and the hearts right under it. The same layout at every size: the smaller sizes scale all of it down together
  // (the type size, the air between the lines and the hearts), so the band can be as short as the pet and nothing is taken away.
  const tier = m.pet.bandSize === 'small' ? 0 : m.pet.bandSize === 'medium' ? 1 : 2
  const type = (['caption', 'footnote', undefined] as const)[tier]
  const air = ([0, 'xs', 1] as const)[tier]
  const sideSpace = (['sm', 'md', 2] as const)[tier]
  const heartsScale = [0.62, 0.8, 1][tier]
  const stats = <Text size={type} dimColor>{`🔥 ${t('unit.day', { n: days })}  ·  💬 ${t('unit.prompt', { n: m.sessionPrompts })}` + (m.sessionCost ? `  ·  💵 ${m.sessionCost}` : '')}</Text>
  const hearts = m.pet.mood ? heartsRow(els, m, surface, true, heartsScale) : null
  const centre = (
    <Box flexDirection="column" alignItems="center" gap={air}>
      <Box flexDirection="row" gap={2} justifyContent="center">{stats}</Box>
      <Box flexDirection="column" alignItems="center" gap={air}>
        <Box borderStyle="round" borderColor={tone} paddingX={sideSpace} minWidth={[24, 30, 34][tier]} flexDirection="row" gap={1} justifyContent="center">
          <Text size={type} color={tone}>●</Text>
          <Button plain key="pet-it" onPress={onPat}><Text size={type}>{m.me.label}</Text></Button>
        </Box>
        {hearts}
      </Box>
    </Box>
  )
  const band = (
    <Box flexDirection="row" gap={2} alignItems="center" paddingRight={3}>
      {face}
      <Box flexGrow={1} />
      {centre}
      <Box flexGrow={1} />
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        {ring}
        <Box flexDirection="row" gap={1} justifyContent="center">
          <Text size={type} color="#3fb950">{'✔ ' + ok}</Text>
          <Text size={type} color="#f85149">{'✖ ' + failed}</Text>
        </Box>
      </Box>
    </Box>
  )
  // The plan's limits are a band of their own under the pet's, next to the prompt: a little air, a faint rule, then one line of text (no
  // background and no border, which both add height), both windows side by side (they wrap onto a second line only if the window is
  // narrow). The rule runs edge to edge where the surface clips it, and is a fixed length on the terminal. The pet's band above is
  // exactly as it was.
  const plan = renderPlan(els, m.plan ?? [], m.pet.plan)
  // With every achievement unlocked, the card frame can go around the band (its main color on its background).
  const frame = bandStyle(m.pet.bandFrame)
  // (A column, so the band fills the width either way; and the same inset with or without the frame, so nothing moves when it is switched on.)
  const shown = frame
    ? <Box flexDirection="column" borderStyle={frame.line} borderColor={frame.border} backgroundColor={frame.background} paddingX={1}>{band}</Box>
    : <Box flexDirection="column" paddingX={1}>{band}</Box>
  if (plan.length === 0) return shown
  return (
    <Box flexDirection="column">
      {shown}
      <Box marginTop={1} justifyContent="center"><Text color="#3a3a3a" wrap="clip">{'─'.repeat(surface === 'terminal' ? 72 : 400)}</Text></Box>
      <Box flexDirection="row" gap={4} justifyContent="center" flexWrap="wrap">{plan}</Box>
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

/** One emoji for each tab (so the four fit on one line, in any language); the name of the tab is the title of its page. */
const TAB_EMOJI = { stats: '📊', look: '🎨', achievements: '🏆', settings: '⚙️' } as const
const tabTitle = (tab: keyof typeof TAB_EMOJI) => TAB_EMOJI[tab] + ' ' + t(tab === 'stats' ? 'ui.tab.stats' : tab === 'look' ? 'ui.tab.look' : tab === 'achievements' ? 'ui.ach' : 'ui.tab.settings')

/** The four tab buttons, and at the right the one that saves the pet card (a snapshot to share). */
export function renderTabs({ Box, Button }: Els, m: any, ctl: any) {
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Box gap={1} flexWrap="wrap">
        {(['stats', 'look', 'achievements', 'settings'] as const).map(tab => (
          <Button key={'tab-' + tab} variant={m.ui.tab === tab ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ tab })}>
            {TAB_EMOJI[tab]}
          </Button>
        ))}
      </Box>
      <Button key="card" onPress={() => { void ctl.saveCard().catch(() => {}) }}>📸</Button>
    </Box>
  )
}

/** The Achievements tab: one card for each thing that is counted, as a game-style badge that levels up (a bronze, silver, gold or diamond
 *  medal; grey with a padlock until the first goal), the metals reached so far, and the progress toward the next goal. One column, so every
 *  card is as wide as the pane and nothing misaligns. */
export function renderAchievements(els: Els, m: any, ctl: any, tabs: any, surface: string) {
  const { Box, Text, Svg } = els as Required<Els>
  const { done, total, groups } = m.achievements
  const emoji = (tier: number | null) => (tier === null ? '🔒' : ['🥉', '🥈', '🥇', '💎'][tier])
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      <Text weight="bold">{tabTitle('achievements')} · {t('ui.ach.count', { done, total })}</Text>
      {groups.map((g: any) => {
        const filled = Math.round((g.current / g.target) * 20)
        const started = g.tier !== null
        const picture = surface !== 'terminal' && Svg
          ? <Svg source={achievementSvg({ kind: g.kind, tier: g.tier ?? 0, reached: started, size: 80, title: `${g.title} · ${g.tierName ?? t('ach.locked')}` })} width={80} height={80} alt={`${g.title}: ${g.tierName ?? t('ach.locked')}`} />
          : <Text>{emoji(g.tier)}</Text>
        return (
          <Box key={'ach-' + g.kind} flexDirection="row" gap={2} alignItems="center" borderStyle="round" borderColor={g.complete ? '#d29922' : '#30363d'} paddingX={1}>
            {picture}
            <Box flexDirection="column">
              <Text weight="bold">{g.title}</Text>
              <Box flexDirection="row" gap={1}>
                {g.levels.map((level: any) => <Text key={'pip-' + level.id} color={level.reached ? TIER_COLORS[level.tier] : '#30363d'}>●</Text>)}
                <Text dimColor={!started}>{g.tierName ?? t('ach.locked')}</Text>
              </Box>
              {g.complete
                ? <Text color="#3fb950">✔ {t('ach.max')}</Text>
                : (
                  <Box flexDirection="column">
                    <Box flexDirection="row" gap={1}>
                      <Text color="#58a6ff">{'█'.repeat(filled)}</Text>
                      <Text color="#30363d">{'█'.repeat(20 - filled)}</Text>
                    </Box>
                    <Text dimColor>{g.current} / {g.target} · {t('ach.next', { goal: g.nextName })}{g.reward ? ' · ' + t('ui.ach.reward', { name: g.reward }) : ''}</Text>
                  </Box>
                )}
            </Box>
          </Box>
        )
      })}
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
      <Text weight="bold">{tabTitle('stats')}</Text>
      <Text dimColor>
        {t('ui.footer', { name: m.pet.name, age: t('unit.day', { n: m.age.days }), streak: m.life.current, best: m.life.longest, active: t('unit.activeDay', { n: m.life.days }), last: m.life.last ?? t('ago.never') })}
      </Text>
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
      {/* The numbers that matter, two to a row and all the same size (a row's tiles are as tall as the tallest). */}
      <Box flexDirection="column" gap={1}>
        {Array.from({ length: Math.ceil(m.stats.tiles.length / 2) }, (_, row) => (
          <Box key={'tiles-' + row} flexDirection="row" gap={1}>
            {m.stats.tiles.slice(row * 2, row * 2 + 2).map((tile: any) => (
              <Box key={'tile-' + tile.id} flexDirection="column" alignItems="center" justifyContent="center" borderStyle="round" borderColor="#30363d" paddingX={1} width="48%">
                <Text weight="bold">{tile.value}</Text>
                <Text dimColor>{tile.label}</Text>
                {tile.note ? <Text dimColor>{tile.note}</Text> : null}
              </Box>
            ))}
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
    </Box>
  )
}

/** The Customize tab: how the pet looks (its name, character, colors, what it wears, the frame of its band and its card). */
export function renderCustomize({ Box, Text, Button, Input }: Els, m: any, ctl: any, tabs: any, picture: any) {
  const set = (patch: any) => { void ctl.setPet(patch) }
  const choice = (key: string, label: string, on: boolean, onPress: () => void) => <Button key={key} variant={on ? 'primary' : 'secondary'} onPress={onPress}>{label}</Button>
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      <Text weight="bold">{tabTitle('look')}</Text>
      {picture}
      <Input key="name" label={t('ui.name')} placeholder={t('ui.name.placeholder', { max: 16, name: m.pet.name })} value={m.pet.isCustom ? m.pet.name : ''} submitLabel={t('ui.save')} onSubmit={(value: string) => set({ name: value })} />
      <Text dimColor>{t('ui.character')}</Text>
      <Box gap={1} flexWrap="wrap">
        {MASCOT_IDS.map((c: string) => choice('char-' + c, MASCOTS[c].name, m.pet.character === c, () => set({ character: c })))}
      </Box>
      <Text dimColor>{t('ui.colors')}</Text>
      <Box gap={1} flexWrap="wrap">
        {/* A palette that is a reward and not earned yet is a dim button with a padlock that does nothing. */}
        {PRESETS.map((p: any) => (m.palettes[p.id] === false
          ? <Button key={'pal-' + p.id} dimColor onPress={() => {}}>{'🔒 ' + t('palette.' + p.id)}</Button>
          : choice('pal-' + p.id, t('palette.' + p.id), (p.body ?? null) === (m.pet.colors.body ?? null) && (p.accent ?? null) === (m.pet.colors.accent ?? null), () => set({ colors: { body: p.body, accent: p.accent } }))))}
      </Box>
      <Text dimColor>{t('ui.accessory')}</Text>
      <Box gap={1} flexWrap="wrap">
        {choice('acc-none', t('ui.acc.none'), m.pet.worn === null, () => set({ prefs: { accessory: 'none' } }))}
        {/* Every accessory is listed; one that is still locked is a dim button with a padlock that does nothing when pressed. */}
        {m.accessories.map((a: any) => (a.unlocked
          ? choice('acc-' + a.id, a.name, m.pet.worn === a.id, () => set({ prefs: { accessory: a.id } }))
          : <Button key={'acc-' + a.id} dimColor onPress={() => {}}>{'🔒 ' + a.name}</Button>))}
      </Box>
      <Text dimColor>{t('ui.frame')}</Text>
      <Box gap={1} flexWrap="wrap">
        {choice('frame-none', t('ui.acc.none'), m.pet.frame === null, () => set({ prefs: { frame: 'none' } }))}
        {m.frames.map((f: any) => (f.unlocked
          ? choice('frame-' + f.id, f.name, m.pet.frame === f.id, () => set({ prefs: { frame: f.id } }))
          : <Button key={'frame-' + f.id} dimColor onPress={() => {}}>{'🔒 ' + f.name}</Button>))}
      </Box>
    </Box>
  )
}

/** The Settings tab: how the plugin behaves (what is shown, the sounds, the motion, the size of the band, the plan's limits, the break
 *  reminder, the language). `play` plays a sound as it is chosen. */
export function renderSettings({ Box, Text, Button }: Els, m: any, ctl: any, tabs: any, play: (sound: string, volume: string) => void) {
  const set = (patch: any) => { void ctl.setPet(patch) }
  const choice = (key: string, label: string, on: boolean, onPress: () => void) => <Button key={key} variant={on ? 'primary' : 'secondary'} onPress={onPress}>{label}</Button>
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      <Text weight="bold">{tabTitle('settings')}</Text>
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
      <Text dimColor>{t('ui.volume')}</Text>
      <Box gap={1}>
        {VOLUMES.map((volume: string) => choice('v-' + volume, t('ui.volume.' + volume), m.pet.volume === volume, () => { set({ prefs: { volume } }); play(m.pet.sounds.finish === 'off' ? 'chime' : m.pet.sounds.finish, volume) }))}
      </Box>
      <Text dimColor>{t('ui.motion')}</Text>
      <Box gap={1}>
        {(['full', 'calm', 'reduced'] as const).map(level => choice('motion-' + level, t('ui.motion.' + level), m.pet.motion === level, () => set({ prefs: { motion: level } })))}
      </Box>
      <Text dimColor>{t('ui.bandSize')}</Text>
      <Box gap={1}>
        {(['small', 'medium', 'large'] as const).map(size => choice('band-' + size, t('ui.size.' + size), m.pet.bandSize === size, () => set({ prefs: { bandSize: size } })))}
      </Box>
      <Text dimColor>{t('ui.plan')}</Text>
      <Box gap={1} flexWrap="wrap">
        {(['auto', 'always', 'five_hour', 'seven_day', 'off'] as const).map(mode => choice('plan-' + mode, t('ui.plan.' + mode), m.pet.plan === mode, () => set({ prefs: { plan: mode } })))}
      </Box>
      <Text dimColor>{t('ui.breaks')}{m.pet.breakEvery ? ' · ' + t('ui.breaks.every', { time: minutesText(m.pet.breakEvery) }) : ''}</Text>
      <Box gap={1} flexWrap="wrap">
        {choice('breaks-off', t('ui.breaks.off'), m.pet.breakEvery === 0, () => set({ prefs: { breakEvery: 0 } }))}
        {BREAK_PRESETS.map((minutes: number) => choice('breaks-' + minutes, minutesText(minutes), m.pet.breakEvery === minutes, () => set({ prefs: { breakEvery: minutes } })))}
        <Button key="breaks-minus" onPress={() => set({ prefs: { breakEvery: m.pet.breakEvery - BREAK_STEP < BREAK_MIN ? 0 : m.pet.breakEvery - BREAK_STEP } })}>{'− ' + minutesText(BREAK_STEP)}</Button>
        <Button key="breaks-plus" onPress={() => set({ prefs: { breakEvery: m.pet.breakEvery === 0 ? 60 : Math.min(BREAK_MAX, m.pet.breakEvery + BREAK_STEP) } })}>{'+ ' + minutesText(BREAK_STEP)}</Button>
      </Box>
      <Text dimColor>{t('ui.breaks.rest')}</Text>
      <Box gap={1} flexWrap="wrap">
        {REST_PRESETS.map((minutes: number) => choice('rest-' + minutes, minutesText(minutes), m.pet.breakRest === minutes, () => set({ prefs: { breakRest: minutes } })))}
      </Box>
      <Text dimColor>{t('ui.language')}</Text>
      <Box gap={1} flexWrap="wrap">
        {choice('lang-auto', t('ui.language.auto'), m.pet.language === 'auto', () => set({ prefs: { language: 'auto' } }))}
        {LANGUAGES.map((language: any) => choice('lang-' + language.code, language.name, m.pet.language === language.code, () => set({ prefs: { language: language.code } })))}
      </Box>
    </Box>
  )
}
