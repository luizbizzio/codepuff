// Measures what CodePuff costs. Every number printed here is measured on the machine that runs it; nothing is estimated.
// Usage: node scripts/bench.mjs [--json]
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { cpus, tmpdir, totalmem } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { openStore } from '../src/node/store.js'
import { normalizeHook } from '../src/core/normalize.js'
import { newRecord, reduce } from '../src/core/session.js'
import { aggregate } from '../src/core/aggregate.js'
import { focus } from '../src/core/petstate.js'
import { createController } from '../src/claude/controller.js'
import { petSvg, terminalFrame, toAnsi } from '../src/core/render/raster.js'
import { animation } from '../src/core/art/anim.js'

const ROOT = join(import.meta.dirname, '..')
const CLI = join(ROOT, 'bin', 'codepuff.js')
const out = {}
const stat = list => {
  const s = [...list].sort((a, b) => a - b)
  const at = q => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3), median: +at(0.5).toFixed(3), p95: +at(0.95).toFixed(3), max: +s.at(-1).toFixed(3) }
}
const time = (fn, n) => { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); fn(i); t.push(performance.now() - a) } return stat(t) }

out.machine = { cpu: cpus()[0]?.model, cores: cpus().length, ramGB: +(totalmem() / 2 ** 30).toFixed(1), node: process.version, platform: process.platform }

// 1. Pure engine: one hook payload through normalize + reduce, in memory.
{
  const payloads = Array.from({ length: 2000 }, (_, i) => ({ hook_event_name: i % 2 ? 'PostToolUse' : 'PreToolUse', session_id: 's', cwd: '/p/app', tool_name: i % 3 ? 'Bash' : 'Edit', tool_input: { command: 'npm test -- --watch=false', file_path: '/p/a.js' }, tool_use_id: 't' + (i >> 1), tool_response: { stdout: 'ok' } }))
  let rec
  time(() => {}, 1)
  const t0 = performance.now()
  for (let round = 0; round < 50; round++) for (const p of payloads) { const ev = normalizeHook('claude', p, Date.now()); rec ??= newRecord(ev); reduce(rec, ev) }
  const total = performance.now() - t0
  out.engine = { events: 100_000, totalMs: +total.toFixed(1), microsecondsPerEvent: +((total / 100_000) * 1000).toFixed(2) }
}

// 2. Store: one event applied to disk (lock + read + reduce + atomic write), as a hook process does.
const dir = mkdtempSync(join(tmpdir(), 'codepuff-bench-'))
try {
  const store = openStore(dir)
  store.ensurePet()
  let i = 0
  out.storeApplyMs = time(() => { store.applyEvent(normalizeHook('codex', { hook_event_name: 'PostToolUse', session_id: 'bench', cwd: '/p/app', tool_name: 'Read', tool_use_id: 'x' + i++, tool_response: 'ok' }, Date.now())) }, 500)
  const file = join(dir, 'sessions', 'codex', 'bench.json')
  out.storage = { recordBytesAfter500Tools: statSync(file).size }

  // 3. A whole hook process, the way Codex runs it: spawn node, import, apply one event, answer {}.
  const payload = JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 'bench2', cwd: '/p/app', turn_id: 't', tool_name: 'Read', tool_use_id: 'z', tool_response: 'ok' })
  const env = { ...process.env, CODEPUFF_HOME: dir }
  const run = (args, input) => { const a = performance.now(); const r = spawnSync(process.execPath, args, { input, env, encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return performance.now() - a }
  const baseline = []; const withHook = []
  for (let k = 0; k < 5; k++) run(['-e', ''], '') // warm the disk cache
  for (let k = 0; k < 25; k++) { baseline.push(run(['-e', ''], '')); withHook.push(run([CLI, 'hook', 'codex'], payload.replace('"z"', `"z${k}"`))) }
  out.hookProcessMs = { nodeStartupAlone: stat(baseline), hookProcess: stat(withHook), netOfNodeStartup: +(stat(withHook).median - stat(baseline).median).toFixed(2) }

  // 4. Memory of a hook process (peak working set and heap, reported by the process itself).
  const mem = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { handleHook } from ${JSON.stringify(new URL('../src/node/hook.js', import.meta.url).href)}
    handleHook('codex', ${JSON.stringify(payload)}, {})
    const m = process.memoryUsage()
    console.log(JSON.stringify({ rssMB: +(m.rss / 2 ** 20).toFixed(1), heapUsedMB: +(m.heapUsed / 2 ** 20).toFixed(1) }))
  `], { env, encoding: 'utf8' })
  out.hookProcessMemory = JSON.parse(mem.stdout)
  const bare = spawnSync(process.execPath, ['-e', 'const m=process.memoryUsage();console.log(JSON.stringify({rssMB:+(m.rss/2**20).toFixed(1)}))'], { encoding: 'utf8' })
  out.nodeBareRssMB = JSON.parse(bare.stdout).rssMB

  // 5. Reading everything: the cost a UI pays to list and add up N sessions (cold, then warm with unchanged files).
  const many = openStore(join(dir, 'many'))
  for (let s = 0; s < 500; s++) for (let e = 0; e < 3; e++) many.applyEvent(normalizeHook(s % 2 ? 'claude' : 'codex', { hook_event_name: e ? 'PostToolUse' : 'UserPromptSubmit', session_id: 'sess' + s, cwd: '/p/' + (s % 5), tool_name: 'Read', tool_use_id: 'u' + e, tool_response: 'ok', turn_id: 't' }, Date.now() - s * 86_400_000 / 5))
  const cold = performance.now(); const records = many.listRecords(); const coldMs = performance.now() - cold
  const warm = time(() => many.listRecords(), 20)
  const agg = time(() => aggregate(records, {}), 20)
  const foc = time(() => focus(records, Date.now()), 20)
  const files = readdirSync(join(dir, 'many', 'sessions', 'claude')).length + readdirSync(join(dir, 'many', 'sessions', 'codex')).length
  let bytes = 0
  for (const agent of ['claude', 'codex']) for (const f of readdirSync(join(dir, 'many', 'sessions', agent))) bytes += statSync(join(dir, 'many', 'sessions', agent, f)).size
  out.readAll = { sessions: records.length, coldListMs: +coldMs.toFixed(1), warmListMs: warm, aggregateMs: agg, focusMs: foc, diskKB: +(bytes / 1024).toFixed(1), filesOnDisk: files, bytesPerSession: Math.round(bytes / files) }

  // 6. The Claude Code mod's controller: an event, and the view model the pane draws.
  const fs = new Map()
  const io = { dataDir: async () => '/d', read: async p => { const t = fs.get(p); if (t === undefined) throw new Error('x'); return t }, write: async (p, t) => { fs.set(p, t) }, list: async () => { throw new Error('x') }, now: () => Date.now() }
  const ctl = createController(io)
  await ctl.init({ sid: 's', cwd: '/p/app' })
  let n = 0
  out.modObserveMs = time(() => { ctl.observe(n % 2 ? 'PostToolUse' : 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: '/a.js' }, tool_use_id: 't' + (n++ >> 1), tool_response: {} }) }, 2000)
  out.modModelMs = time(() => ctl.model(), 200)
  const flush = performance.now(); ctl.observe('UserPromptSubmit', {}); await ctl.flush(); out.modFlushMs = +(performance.now() - flush).toFixed(2)
  out.modRecordBytes = fs.get('/d/sessions/claude/s.json').length

  // 7. Drawing.
  out.render = {
    svgBuildMsFirst: undefined,
    svgBuildMs: time(i => petSvg({ character: i % 2 ? 'alpha' : 'claude', state: ['idle', 'coding', 'success'][i % 3], helpers: i % 4 }), 60),
    svgBytes: { idle: petSvg({ character: 'alpha', state: 'idle' }).length, coding: petSvg({ character: 'alpha', state: 'coding' }).length, success: petSvg({ character: 'claude', state: 'success', helpers: 3 }).length, reduced: petSvg({ character: 'alpha', state: 'coding', reduced: true }).length },
    terminalFrameMs: time(i => terminalFrame({ character: 'alpha', state: 'coding', elapsed: i * 170 }), 300),
    ansiMs: time(() => { const f = terminalFrame({ character: 'claude', state: 'idle' }); toAnsi(f.canvas, f.palette, f.box) }, 300),
  }
  out.render.svgBuildMsFirst = out.render.svgBuildMs.max
  out.render.framesPerState = Object.fromEntries(['idle', 'coding', 'success', 'thinking'].map(s => [s, animation(s).frames.length]))
} finally { rmSync(dir, { recursive: true, force: true }) }

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2))
else {
  console.log('Machine:', JSON.stringify(out.machine))
  const line = (k, v) => console.log(k.padEnd(34), typeof v === 'object' ? JSON.stringify(v) : v)
  line('Engine, per event (µs)', out.engine.microsecondsPerEvent + ` (100k events in ${out.engine.totalMs} ms)`)
  line('Store: apply one event (ms)', out.storeApplyMs)
  line('Hook process wall time (ms)', out.hookProcessMs)
  line('Hook process memory (MB)', { ...out.hookProcessMemory, bareNodeRss: out.nodeBareRssMB })
  line('Read+sum 500 sessions', out.readAll)
  line('Claude mod: observe (ms)', out.modObserveMs)
  line('Claude mod: view model (ms)', out.modModelMs)
  line('Claude mod: record size (bytes)', out.modRecordBytes)
  line('Render', out.render)
  line('Record size after 500 tools', out.storage.recordBytesAfter500Tools + ' bytes')
}
