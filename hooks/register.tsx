// CodePuff for Claude Code. This file only binds the host to the controller (src/claude/controller.js) and
// draws the pane; every decision about events, statistics and storage lives in the controller and the shared
// core, which are the same code the Codex integration runs.
//
// What it does on the host:
//   - observes the agent's real lifecycle through the host's hook events and records them (counters only);
//   - draws one pane: the pet (animated), what the agent is doing, a few numbers, statistics and customization;
//   - adds /codepuff for text control, and an optional one-line status.
// What it never does: call a model, touch the network, add context for the model, block, rewrite or deny
// anything. Every hook returns `next(e)` untouched, and a failure here is swallowed.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// The shared engine is plain JavaScript (ES modules) with no build step, so it has no declaration files.
// @ts-ignore
import { createController } from '../src/claude/controller.js'
// @ts-ignore
import { PRESETS } from '../src/core/color.js'
// @ts-ignore
import { AGENT_LABELS } from '../src/core/format.js'
// @ts-ignore
import { pieSvg } from '../src/core/render/pie.js'
// @ts-ignore
import { base64, petSvg, terminalFrame } from '../src/core/render/raster.js'
// @ts-ignore
import { MASCOTS, MASCOT_IDS } from '../src/core/art/registry.js'

const PANE = 'codepuff'
const rev = atom({ plugin: 'codepuff', key: 'rev' } as const, 0)

const COLORS: Record<string, string> = { success: '#3fb950', error: '#f85149', permission: '#d29922', investigating: '#d29922', finished: '#3fb950', disconnected: '#8b949e' }

/** The few host calls the long-lived parts need, as closures made inside a hook (the host's `$` is never stored). */
type Bridge = {
  later: (name: string, ms: number, fn: () => void) => void
  redraw: () => void
  status: (text: string | undefined) => void
  blit: (args: { requestId: string; key: string; cells: string; columns: number; rows: number }) => Promise<any>
  usage: () => Promise<any>
}

export const register: Register = on => {
  let ctl: ReturnType<typeof createController> | undefined
  let bridge: Bridge | undefined
  const timers: Record<string, { cancel: () => void } | undefined> = {}
  let seenAt = 0
  let epoch = { key: '', at: 0 }
  let lastCells = ''
  let lastLine: string | undefined = undefined

  const flushSoon = () => bridge?.later('flush', 600, () => { void ctl?.flush() })
  const refreshSoon = () => bridge?.later('refresh', 10_000, async () => {
    // Other sessions are only read while the pane is actually on screen.
    if (Date.now() - seenAt > 60_000) return
    if (await ctl?.refreshOthers()) bridge?.redraw()
    refreshSoon()
  })
  const tick = () => {
    const wait = ctl?.nextTick()
    if (wait !== undefined) bridge?.later('tick', wait + 20, () => { bridge?.redraw(); tick() })
  }
  const applyStatusLine = () => {
    if (!ctl || !bridge) return
    const m = ctl.model()
    const text = m.pet.line ? `${m.pet.name} · ${m.me.label}` : undefined
    if (text !== lastLine) { lastLine = text; bridge.status(text) }
  }

  // The plan's usage (the rate-limit windows the host reports) tells the pet whether to look tired. It is read every minute;
  // a host that cannot say simply leaves the pet rested.
  const readUsage = async () => {
    try { ctl?.setUsage(await bridge?.usage()) } catch { /* no usage figures: the pet is simply not tired */ }
  }
  const watchUsage = () => {
    void readUsage()
    bridge?.later('usage', 60_000, () => { watchUsage() })
  }

  // The animation restarts from its first frame whenever what is drawn changes.
  const epochFor = (character: string, colors: any, state: string, helpers: number) => {
    const key = [character, colors?.body, colors?.accent, state, helpers].join('|')
    if (epoch.key !== key) { epoch = { key, at: Date.now() }; lastCells = '' }
    return Date.now() - epoch.at
  }

  // Terminal animation: frame stepping with $.ui.blit, which repaints cells without a redraw. It runs only while
  // the pane is drawn (a refused blit ends it) and stops by itself when the pose is still.
  const animate = (requestId: string, character: string, colors: any, state: string, helpers: number, reduced: boolean, columns: number) => {
    if (reduced || !bridge) { timers.anim?.cancel(); return }
    const step = async () => {
      const frame = terminalFrame({ character, colors, state, helpers, elapsed: epochFor(character, colors, state, helpers), reduced, columns })
      const cells = base64(frame.cells)
      if (cells !== lastCells) {
        const out = await bridge!.blit({ requestId, key: 'pet', cells, columns: frame.columns, rows: frame.rows }).catch(() => ({ deny: 'failed' }))
        if (out && 'deny' in out) return // not drawn any more: stop until the next render
        lastCells = cells
      }
      if (Number.isFinite(frame.until)) bridge!.later('anim', Math.max(70, frame.until), step)
    }
    bridge.later('anim', 70, step)
  }

  // ---- lifecycle -------------------------------------------------------------------------------------------

  on('session.start', async ($, e, next) => {
    try {
      bridge = {
        later: (name, ms, fn) => {
          timers[name]?.cancel()
          timers[name] = $.clock.after(ms, () => { timers[name] = undefined; fn() })
        },
        redraw: () => {
          timers.redraw?.cancel()
          timers.redraw = $.clock.after(150, () => { timers.redraw = undefined; void update($, rev, (n: number) => n + 1).catch(() => {}) })
        },
        status: text => $.ui.status(text),
        blit: args => $.ui.blit(args as any),
        usage: () => $.session.usage(),
      }
      const io = {
        dataDir: async () => {
          const own = await $.env.get('CODEPUFF_HOME')
          if (own) return own
          const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
          return home ? home.replace(/[\\/]+$/, '') + '/.codepuff' : `${$.plugin.root}/.data`
        },
        read: async (path: string) => String(await $.fs.read(path)),
        write: (path: string, text: string) => $.fs.write(path, text),
        list: (path: string) => $.fs.list(path) as any,
        now: () => Date.now(),
        run: (argv: string[], cwd?: string) => $.process.run(argv, { cwd, timeoutMs: 4000 }) as any,
      }
      ctl = createController(io)
      ctl.onChange(() => { bridge?.redraw(); flushSoon(); tick(); applyStatusLine() })
      await ctl.init({ sid: await $.session.id(), cwd: e.cwd })
      watchUsage()
      await $.command.register({ name: 'codepuff', description: 'Open your CodePuff pet; /codepuff help lists the options' })
      void $.ui.open({ id: PANE, title: 'CodePuff', placement: 'widget' }).catch(() => {})
      refreshSoon()
      tick()
    } catch (error) {
      $.ui.log('CodePuff could not start: ' + String((error as Error)?.message ?? error), { to: 'debug' })
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try { await ctl?.flush() } catch { /* never block shutdown */ }
    for (const t of Object.values(timers)) t?.cancel()
    return next(e)
  })

  on('command.run', { command: 'codepuff' }, async ($, e) => {
    if (!ctl) return { text: 'CodePuff is not ready yet.' }
    const out = await ctl.command((e as any).args ?? '')
    if (out.open) { await ctl.refreshOthers(); void $.ui.open({ id: PANE, title: 'CodePuff' }).catch(() => {}) }
    return { text: out.text }
  })

  // ---- observation: every hook records and returns the host's own answer untouched ---------------------------------

  on('classic.UserPromptSubmit', ($, e, next) => { ctl?.observe('UserPromptSubmit', e); return next(e) })
  on('classic.PreToolUse', ($, e, next) => { ctl?.observe('PreToolUse', e); return next(e) })
  on('classic.PostToolUse', ($, e, next) => { ctl?.observe('PostToolUse', e); return next(e) })
  on('classic.PostToolUseFailure', ($, e, next) => { ctl?.observe('PostToolUseFailure', e); return next(e) })
  on('classic.PermissionRequest', ($, e, next) => { ctl?.observe('PermissionRequest', e); return next(e) })
  on('classic.PermissionDenied', ($, e, next) => { ctl?.observe('PermissionDenied', e); return next(e) })
  on('classic.SubagentStart', ($, e, next) => { ctl?.observe('SubagentStart', e); return next(e) })
  on('classic.SubagentStop', ($, e, next) => { ctl?.observe('SubagentStop', e); return next(e) })
  on('classic.Stop', ($, e, next) => { ctl?.observe('Stop', e); return next(e) })
  on('classic.StopFailure', ($, e, next) => { ctl?.observe('StopFailure', e); return next(e) })

  on('turn.start', ($, e, next) => {
    if (!(e as any).agentId) ctl?.observe('TurnStart', {})
    return next(e)
  })
  on('turn.complete', ($, e, next) => {
    const ev = e as any
    if (!ev.agentId) {
      // `Stop` covers a normal end; this adds the two endings it does not report.
      if (ev.reason === 'aborted') ctl?.observe('Interrupt', {})
      else if (ev.reason === 'error' || ev.reason === 'refusal') ctl?.observe('StopFailure', {})
      void ctl?.flush()
    }
    return next(e)
  })

  // ---- the compact band above the prompt: the pet, standing still, and what it is doing right now -------------------

  const GLYPH: Record<string, string> = { success: '^_^', finished: '^_^', error: '>_<', permission: 'O_O', investigating: 'o_O', disconnected: '-_-', waiting: 'o_o', idle: 'o_o', thinking: 'o.o' }
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, rev)
    if (!ctl || (e as any).props?.hasSurvey) return next(e)
    const m = ctl.model()
    if (!m.pet.band) return next(e)
    const { Box, Text, Button, Svg } = $.ui.resolve(e as any) as any
    const surface = (e as any).surface as string
    const color = COLORS[m.me.state]
    const reduced = m.pet.motion === 'reduced'
    // The pet and the pie chart are the same height, whatever size the user picked (the picture is cropped tight, so the pet fills it).
    const size: number = m.pet.bandHeight
    const face = surface !== 'terminal' && Svg
      ? <Svg source={petSvg({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers: m.me.helpers, height: size, reduced, crop: 'band', hover: true })} alt={`${m.pet.name}: ${m.me.label}`} isInteractive />
      : <Text color={color ?? undefined}>{GLYPH[m.me.state] ?? 'o_o'}</Text>
    const { ok, failed } = m.outcome
    const total = ok + failed
    const pie = surface !== 'terminal' && Svg
      ? <Svg source={pieSvg({ ok, failed, size })} alt={total ? `${ok} of ${total} tasks succeeded, ${failed} failed` : 'No tasks yet'} />
      : null
    // The pet sits at the left edge and the pie chart at the right edge; what the pet is doing fills the space between.
    // Under the pie: what it is, and the counts.
    const counts = (
      <Box flexDirection="row" gap={1} justifyContent="center">
        <Text dimColor>Tasks</Text>
        <Text color="#3fb950">{'✔ ' + ok}</Text>
        <Text color="#f85149">{'✖ ' + failed}</Text>
      </Box>
    )
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        {face}
        <Box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="flex-start">
          <Button plain key="pet-it" onPress={() => ctl!.pat()}>{m.me.label}</Button>
        </Box>
        <Box flexDirection="column" alignItems="center" justifyContent="center">
          {pie}
          {counts}
        </Box>
      </Box>
    )
  })

  // ---- the pane ----------------------------------------------------------------------------------------------

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, rev) // subscribes this drawing to redraws
    const { Box, Text, Button, Input, Svg, Raster } = $.ui.resolve(e as any) as any
    if (!ctl) return <Text dimColor>CodePuff is starting…</Text>
    const props = (e as any).props ?? {}
    const m = ctl.model()
    const surface = (e as any).surface as string
    const columns: number = props.bodyColumns ?? 40
    seenAt = Date.now()
    const isWidget = props.placement === 'widget'
    const reduced = m.pet.motion === 'reduced'
    const helpers = m.me.helpers
    const colorOf = COLORS[m.me.state]

    // The picture.
    let picture: any = null
    if (surface === 'terminal') {
      const elapsed = epochFor(m.pet.character, m.pet.colors, m.me.state, helpers)
      const frame = terminalFrame({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers, elapsed, reduced, columns: Math.max(12, columns) })
      if (frame.columns <= columns) {
        picture = <Raster key="pet" columns={frame.columns} rows={frame.rows} cells={base64(frame.cells)} />
        animate((e as any).requestId, m.pet.character, m.pet.colors, m.me.state, helpers, reduced, Math.max(12, columns))
      }
    } else if (Svg) {
      const svg = petSvg({ character: m.pet.character, colors: m.pet.colors, state: m.me.state, helpers, scale: isWidget ? 2.2 : 2.8, reduced, hover: true })
      picture = <Svg source={svg} alt={`${m.pet.name}: ${m.me.label}`} isInteractive />
    }

    const who = `${AGENT_LABELS.claude}${m.sessionLabel ? ' · ' + m.sessionLabel : ''}`
    const head = (
      <Box flexDirection="column">
        <Text weight="bold">{m.pet.name}</Text>
        <Text color={colorOf}>{m.me.label}</Text>
        {!isWidget && <Text dimColor>{who}</Text>}
        {!isWidget && m.otherCount > 0 && (
          <Text dimColor wrap="truncate-end">
            Also: {m.others.map((o: any) => `${AGENT_LABELS[o.agent as 'claude' | 'codex']}${o.project ? ' · ' + o.project : ''} (${o.label.toLowerCase()})`).slice(0, 2).join('; ')}{m.otherCount > 2 ? ` +${m.otherCount - 2}` : ''}
          </Text>
        )}
      </Box>
    )
    if (isWidget) return <Box flexDirection="column" alignItems="center">{picture}{head}</Box>

    const tabs = (
      <Box gap={1} flexWrap="wrap">
        {(['stats', 'look'] as const).map(tab => (
          <Button key={'tab-' + tab} variant={m.ui.tab === tab ? 'primary' : 'secondary'} onPress={() => ctl!.setUi({ tab })}>
            {tab === 'stats' ? 'Statistics' : 'Customize'}
          </Button>
        ))}
      </Box>
    )

    if (m.ui.tab !== 'look') {
      return (
        <Box flexDirection="column" gap={1}>
          {tabs}
          <Box gap={1} flexWrap="wrap">
            {(['session', 'all', '7d', '30d'] as const).map(scope => (
              <Button key={'scope-' + scope} variant={m.ui.scope === scope ? 'primary' : 'secondary'} onPress={() => ctl!.setUi({ scope })}>
                {scope === 'session' ? 'This session' : scope === 'all' ? 'All time' : scope === '7d' ? '7 days' : '30 days'}
              </Button>
            ))}
          </Box>
          {m.ui.scope !== 'session' && (
            <Box gap={1} flexWrap="wrap">
              {(['all', 'claude', 'codex'] as const).map(agent => (
                <Button key={'agent-' + agent} variant={m.ui.agent === agent ? 'primary' : 'secondary'} onPress={() => ctl!.setUi({ agent })}>
                  {agent === 'all' ? 'Combined' : AGENT_LABELS[agent]}
                </Button>
              ))}
            </Box>
          )}
          <Text weight="bold">{m.scopeLabel}</Text>
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
          {m.stats.categories.length > 0 && <Text dimColor wrap="wrap">Tools: {m.stats.categories.join(' · ')}</Text>}
          <Text>Last 14 days  <Text color="#58a6ff">{m.spark}</Text></Text>
          <Text dimColor>
            {m.pet.name} is {m.age.days} day{m.age.days === 1 ? '' : 's'} old · streak {m.life.current} (best {m.life.longest}) · {m.life.days} active day{m.life.days === 1 ? '' : 's'} · last {m.life.last ?? 'never'}
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {tabs}
        {picture}
        <Input key="name" label="Name" placeholder={`up to 16 characters (${m.pet.name})`} value={m.pet.isCustom ? m.pet.name : ''} submitLabel="save" onSubmit={(value: string) => { void ctl!.setPet({ name: value }) }} />
        <Text dimColor>Character</Text>
        <Box gap={1} flexWrap="wrap">
          {MASCOT_IDS.map((c: string) => (
            <Button key={'char-' + c} variant={m.pet.character === c ? 'primary' : 'secondary'} onPress={() => { void ctl!.setPet({ character: c }) }}>{MASCOTS[c].name}</Button>
          ))}
        </Box>
        <Text dimColor>Colors</Text>
        <Box gap={1} flexWrap="wrap">
          {PRESETS.map((p: any) => (
            <Button key={'pal-' + p.id} variant={(p.body ?? null) === (m.pet.colors.body ?? null) && (p.accent ?? null) === (m.pet.colors.accent ?? null) ? 'primary' : 'secondary'} onPress={() => { void ctl!.setPet({ colors: { body: p.body, accent: p.accent } }) }}>{p.name}</Button>
          ))}
        </Box>
        <Text dimColor>Settings</Text>
        <Box gap={1} flexWrap="wrap">
          <Button key="band" onPress={() => { void ctl!.setPet({ prefs: { band: !m.pet.band } }) }}>{m.pet.band ? 'Compact band: on' : 'Compact band: off'}</Button>
          <Button key="line" onPress={() => { void ctl!.setPet({ prefs: { line: !m.pet.line } }) }}>{m.pet.line ? 'Status line: on' : 'Status line: off'}</Button>
        </Box>
        <Text dimColor>Compact band size</Text>
        <Box gap={1}>
          {(['small', 'medium', 'large'] as const).map(size => (
            <Button key={'band-' + size} variant={m.pet.bandSize === size ? 'primary' : 'secondary'} onPress={() => { void ctl!.setPet({ prefs: { bandSize: size } }) }}>{size.charAt(0).toUpperCase() + size.slice(1)}</Button>
          ))}
        </Box>
      </Box>
    )
  })
}
