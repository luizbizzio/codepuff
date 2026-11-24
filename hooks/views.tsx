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
import { activitySvg } from '../src/core/render/charts.js'
// @ts-ignore
import { SOUNDS, VOLUMES } from '../src/core/settings.js'
// @ts-ignore
import { petSvg } from '../src/core/render/raster.js'
// @ts-ignore
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'

/** The size a picture asks for (its own width and height attributes), so the host draws it at exactly that size.
 *  (Only a picture has a size in pixels: a Box's width and height are in terminal cells, so none is given one.) */
export const sizeOf = (svg: string) => ({ width: Math.round(Number(/ width="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined, height: Math.round(Number(/ height="([0-9.]+)"/.exec(svg)?.[1] ?? 0)) || undefined })

export const COLORS: Record<string, string> = { success: '#3fb950', error: '#f85149', permission: '#d29922', investigating: '#d29922', finished: '#3fb950', disconnected: '#8b949e' }
const GLYPH: Record<string, string> = { success: '^_^', finished: '^_^', error: '>_<', permission: 'O_O', investigating: 'o_O', disconnected: '-_-', waiting: '^_^', idle: 'o_o', thinking: 'o.o', sad: 'T_T', hurt: '>_<', petted: '^_^', giggle: '^o^', delighted: '^o^' }

/** The moments that can make a sound: its key in the preferences, the prefix of its buttons, and what to call it. */
const MOMENTS: [string, string, string][] = [
  ['question', 'q', 'Sound when Claude asks you something'],
  ['finish', 'f', 'Sound when Claude finishes'],
  ['reset5h', 'r5', 'Sound when the 5-hour limit resets'],
  ['resetWeek', 'rw', 'Sound when the weekly limit resets'],
]

type Els = { Box: any; Text: any; Button?: any; Svg?: any; Input?: any }
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** One to five hearts: how much the pet likes the user (filled ones red, the rest outlined). */
export const heartsRow = ({ Box, Text }: Els, n: number) => (
  <Box flexDirection="row">
    <Text color="#f85149">{'♥'.repeat(n)}</Text>
    <Text dimColor>{'♡'.repeat(5 - n)}</Text>
  </Box>
)

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
        <Text dimColor>{w.label.padEnd(5)}</Text>
        <Box flexDirection="row">
          <Text color={tone}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(10 - filled)}</Text>
        </Box>
        <Text color={tone}>{w.percent + '%'}</Text>
        {w.resetsInMs > 0 ? <Text dimColor>{'resets in ' + duration(w.resetsInMs)}</Text> : null}
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
  const petPicture = drawn ? petSvg({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers: m.me.helpers, height: size, reduced, crop: 'band', hover: true, title: `${m.pet.name}: ${m.me.label}` }) : ''
  const face = drawn
    ? <Svg source={petPicture} alt={`${m.pet.name}: ${m.me.label}`} isInteractive {...sizeOf(petPicture)} />
    : <Text color={COLORS[m.me.state] ?? undefined}>{GLYPH[m.me.state] ?? 'o_o'}</Text>
  const { ok, failed } = m.outcome
  const total = ok + failed
  const tip = total ? `${ok} of ${total} tasks succeeded (${Math.floor((ok / total) * 100)}%), ${failed} failed, as Claude reported them` : 'No tasks yet in this session'
  const ring = drawn
    ? <Svg source={ringSvg({ ok, failed, size: ringSize, title: tip })} width={ringSize} height={ringSize} isInteractive alt={tip} />
    : null
  const days = m.life.current
  const tone = toneOf(m.me.state)
  return (
    <Box flexDirection="row" gap={2} alignItems="center">
      {face}
      <Box flexDirection="column" alignItems="flex-start" gap={1}>
        <Box flexDirection="row" gap={2}>
          <Text dimColor>{`🔥 ${days} day${days === 1 ? '' : 's'}  ·  💬 ${m.sessionPrompts} prompt${m.sessionPrompts === 1 ? '' : 's'}`}</Text>
          {m.pet.mood ? heartsRow(els, m.pet.hearts) : null}
        </Box>
        <Box borderStyle="round" borderColor={tone} paddingX={1} flexDirection="row" gap={1}>
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
export function renderHead(els: Els, m: any, isWidget: boolean) {
  const { Box, Text } = els
  const who = `${AGENT_LABELS.claude}${m.sessionLabel ? ' · ' + m.sessionLabel : ''}`
  return (
    <Box flexDirection="column">
      <Text weight="bold">{m.pet.name}</Text>
      {m.pet.mood && heartsRow(els, m.pet.hearts)}
      <Text color={COLORS[m.me.state]}>{m.me.label}</Text>
      {!isWidget && <Text dimColor>{who}</Text>}
      {!isWidget && m.otherCount > 0 && (
        <Text dimColor wrap="truncate-end">
          Also: {m.others.map((o: any) => `${AGENT_LABELS[o.agent as 'claude' | 'codex']}${o.project ? ' · ' + o.project : ''} (${o.label.toLowerCase()})`).slice(0, 2).join('; ')}{m.otherCount > 2 ? ` +${m.otherCount - 2}` : ''}
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
          {tab === 'stats' ? 'Statistics' : 'Customize'}
        </Button>
      ))}
    </Box>
  )
}

const PERIOD_LABEL: Record<string, string> = { session: 'This session', '7d': '7 days', '30d': '30 days', all: 'All time' }

/** The Statistics tab: the platform, the period, the few numbers that matter as tiles, how the work went, what it was made of,
 *  and (only when asked for) the long list of every number. */
export function renderStats(els: Els, m: any, ctl: any, tabs: any, surface: string) {
  const { Box, Text, Button, Svg } = els as Required<Els>
  const { ok, failed } = m.stats
  const settled = ok + failed
  const green = settled ? Math.max(ok ? 1 : 0, Math.round((ok / settled) * 24)) : 0
  const chart = activitySvg(m.chart, { width: 280, height: 64 })
  return (
    <Box flexDirection="column" gap={1}>
      {tabs}
      <Text weight="bold">Platform</Text>
      <Box gap={1} flexWrap="wrap">
        {m.platforms.map((agent: string) => (
          <Button key={'agent-' + agent} variant={m.ui.agent === agent ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ agent })}>
            {agent === 'all' ? 'Combined' : AGENT_LABELS[agent as 'claude' | 'codex']}
          </Button>
        ))}
      </Box>
      <Text weight="bold">Period</Text>
      <Box gap={1} flexWrap="wrap">
        {m.periods.map((scope: string) => (
          <Button key={'scope-' + scope} variant={m.period === scope ? 'primary' : 'secondary'} onPress={() => ctl.setUi({ scope })}>
            {PERIOD_LABEL[scope]}
          </Button>
        ))}
      </Box>
      <Text dimColor>{m.scopeLabel}</Text>
      <Box gap={1} flexWrap="wrap">
        {m.stats.tiles.map((tile: any) => (
          <Box key={'tile-' + tile.id} flexDirection="column" alignItems="center" borderStyle="round" borderColor="#30363d" paddingX={1}>
            <Text weight="bold">{tile.value}</Text>
            <Text dimColor>{tile.label}</Text>
            {tile.note ? <Text dimColor>{tile.note}</Text> : null}
          </Box>
        ))}
      </Box>
      {settled > 0 && (
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Success</Text>
          <Text color="#3fb950">{'█'.repeat(green)}</Text>
          <Text color="#f85149">{'█'.repeat(Math.max(failed ? 1 : 0, 24 - green))}</Text>
          <Text dimColor>{Math.round((ok / settled) * 100)}%</Text>
        </Box>
      )}
      <Text weight="bold">Last 14 days</Text>
      {surface !== 'terminal' && Svg
        ? <Svg source={chart} width={280} height={64} isInteractive alt={'Tool calls per day over the last 14 days'} />
        : <Text color="#58a6ff">{m.spark}</Text>}
      {m.stats.bars.length > 0 && (
        <Box flexDirection="column">
          <Text weight="bold">What it did</Text>
          {m.stats.bars.map((bar: any) => (
            <Box key={'bar-' + bar.id} flexDirection="row" gap={1}>
              <Text dimColor>{bar.label.padEnd(9)}</Text>
              <Text color="#58a6ff">{'█'.repeat(Math.max(1, Math.round(bar.share * 16)))}</Text>
              <Text>{bar.count}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Button key="details" onPress={() => ctl.setUi({ details: !m.ui.details })}>{m.ui.details ? 'Hide all numbers' : 'Show all numbers'}</Button>
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
        {m.pet.name} is {m.age.days} day{m.age.days === 1 ? '' : 's'} old · streak {m.life.current} (best {m.life.longest}) · {m.life.days} active day{m.life.days === 1 ? '' : 's'} · last {m.life.last ?? 'never'}
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
      <Input key="name" label="Name" placeholder={`up to 16 characters (${m.pet.name})`} value={m.pet.isCustom ? m.pet.name : ''} submitLabel="save" onSubmit={(value: string) => set({ name: value })} />
      <Text dimColor>Character</Text>
      <Box gap={1} flexWrap="wrap">
        {MASCOT_IDS.map((c: string) => choice('char-' + c, MASCOTS[c].name, m.pet.character === c, () => set({ character: c })))}
      </Box>
      <Text dimColor>Colors</Text>
      <Box gap={1} flexWrap="wrap">
        {PRESETS.map((p: any) => choice('pal-' + p.id, p.name, (p.body ?? null) === (m.pet.colors.body ?? null) && (p.accent ?? null) === (m.pet.colors.accent ?? null), () => set({ colors: { body: p.body, accent: p.accent } })))}
      </Box>
      <Text dimColor>Settings</Text>
      <Box gap={1} flexWrap="wrap">
        <Button key="band" onPress={() => set({ prefs: { band: !m.pet.band } })}>{m.pet.band ? 'Compact band: on' : 'Compact band: off'}</Button>
        <Button key="mood" onPress={() => set({ prefs: { mood: !m.pet.mood } })}>{m.pet.mood ? 'Hearts react to my messages: on' : 'Hearts react to my messages: off'}</Button>
        <Button key="line" onPress={() => set({ prefs: { line: !m.pet.line } })}>{m.pet.line ? 'Status line: on' : 'Status line: off'}</Button>
      </Box>
      {MOMENTS.map(([moment, key, label]) => (
        <Box key={'sounds-' + moment} flexDirection="column" gap={1}>
          <Text dimColor>{label}</Text>
          <Box gap={1} flexWrap="wrap">
            {SOUNDS.map((sound: string) => choice(key + '-' + sound, cap(sound), m.pet.sounds[moment] === sound, () => { set({ prefs: { sounds: { [moment]: sound } } }); play(sound, m.pet.volume) }))}
          </Box>
        </Box>
      ))}
      <Text dimColor>Sound volume</Text>
      <Box gap={1}>
        {VOLUMES.map((volume: string) => choice('v-' + volume, cap(volume), m.pet.volume === volume, () => { set({ prefs: { volume } }); play(m.pet.sounds.finish === 'off' ? 'chime' : m.pet.sounds.finish, volume) }))}
      </Box>
      <Text dimColor>Compact band size</Text>
      <Box gap={1}>
        {(['small', 'medium', 'large'] as const).map(size => choice('band-' + size, cap(size), m.pet.bandSize === size, () => set({ prefs: { bandSize: size } })))}
      </Box>
    </Box>
  )
}
