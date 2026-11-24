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
import { base64, petSvg, terminalFrame } from '../src/core/render/raster.js'
import { renderBand, renderCustomize, renderHead, renderStats, renderTabs, sizeOf } from './views.js'

const PANE = 'codepuff'
const rev = atom({ plugin: 'codepuff', key: 'rev' } as const, 0)

/** The few host calls the long-lived parts need, as closures made inside a hook (the host's `$` is never stored). */
type Bridge = {
  later: (name: string, ms: number, fn: () => void) => void
  redraw: () => void
  status: (text: string | undefined) => void
  blit: (args: { requestId: string; key: string; cells: string; columns: number; rows: number }) => Promise<any>
  usage: () => Promise<any>
  play: (sound: string, volume: string) => void
  toast: (text: string) => void
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
        toast: (text: string) => { try { $.ui.toast(text) } catch { /* a toast is only a nicety */ } },
        // The host's own player only exists on macOS; on Windows the clip goes through the system's sound player.
        play: (sound: string, volume: string) => {
          const root = String($.plugin.root)
          const file = `${root.replace(/[\\/]+$/, '')}/assets/sounds/${sound}-${volume}.wav`
          const log = (text: string) => { try { $.ui.log('CodePuff sound: ' + text, { to: 'debug' }) } catch { /* only a note */ } }
          const hostPlayer = () => Promise.resolve($.audio.play({ asset: `assets/sounds/${sound}-${volume}.wav` })).catch((error: unknown) => log('the host could not play ' + sound + ': ' + String((error as Error)?.message ?? error)))
          if (/^[A-Za-z]:|^\\\\/.test(root)) {
            // Windows: the system's own sound player, through PowerShell; the host's player is the fallback.
            const script = `(New-Object System.Media.SoundPlayer '${file.replace(/\//g, '\\').replace(/'/g, "''")}').PlaySync()`
            Promise.resolve($.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 8000 }))
              .then((result: any) => { if (result && result.exitCode) { log('PowerShell exited with ' + result.exitCode + ' ' + String(result.stderr ?? '').slice(0, 200)); return hostPlayer() } })
              .catch((error: unknown) => { log('could not run PowerShell: ' + String((error as Error)?.message ?? error)); return hostPlayer() })
          } else void hostPlayer()
        },
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
      ctl.onChange(() => { bridge?.redraw(); flushSoon(); tick(); applyStatusLine(); for (const cue of ctl!.takeCues()) bridge?.play(cue.sound, cue.volume); for (const text of ctl!.takeToasts()) bridge?.toast('🎉 ' + text) })
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
      else ctl?.cue('finish') // a turn that ended well (the same moment as `Stop`, which is counted once)
      void ctl?.flush()
    }
    return next(e)
  })

  // ---- the compact band above the prompt: the pet, standing still, and what it is doing right now -------------------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, rev)
    if (!ctl || (e as any).props?.hasSurvey) return next(e)
    const m = ctl.model()
    if (!m.pet.band) return next(e)
    return renderBand($.ui.resolve(e as any) as any, m, (e as any).surface as string, () => ctl!.pat())
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
      picture = <Svg source={svg} alt={`${m.pet.name}: ${m.me.label}`} isInteractive {...sizeOf(svg)} />
    }

    const els = { Box, Text, Button, Input, Svg }
    const head = renderHead(els, m, isWidget)
    if (isWidget) return <Box flexDirection="column" alignItems="center">{picture}{head}</Box>

    const tabs = renderTabs(els, m, ctl)
    if (m.ui.tab !== 'look') return renderStats(els, m, ctl, tabs, surface)
    return renderCustomize(els, m, ctl, tabs, picture, (sound, volume) => bridge?.play(sound, volume))
  })
}
