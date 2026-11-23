// Developer tool: fills a data folder with a believable history (both agents, ~40 days) so the UIs can be looked at.
// Usage: CODEPUFF_HOME=./out/demo node scripts/seed-demo.mjs
import { openStore } from '../src/node/store.js'
import { normalizeHook } from '../src/core/normalize.js'

const store = openStore()
const DAY = 86_400_000
const now = Date.now()
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const pet = store.ensurePet(now - 100 * DAY)
store.writePet({ ...pet, createdAt: now - 100 * DAY })

const send = (agent, session, project, name, extra, at) => {
  const ev = normalizeHook(agent, { hook_event_name: name, session_id: session, cwd: '/home/dev/' + project, turn_id: 't', ...extra }, at)
  if (ev) store.applyEvent(ev)
}

for (let d = 40; d >= 0; d--) {
  if (rnd() < 0.18 && d > 3) continue // a quiet day
  const sessions = 1 + Math.floor(rnd() * 3)
  for (let s = 0; s < sessions; s++) {
    const agent = rnd() < 0.6 ? 'claude' : 'codex'
    const project = ['api-server', 'web-app', 'codepuff', 'infra'][Math.floor(rnd() * 4)]
    const sid = `${agent[0]}-${d}-${s}`
    let at = now - d * DAY - 6 * 3600_000 + s * 2 * 3600_000
    send(agent, sid, project, 'SessionStart', { source: 'startup' }, at)
    const prompts = 2 + Math.floor(rnd() * 5)
    for (let p = 0; p < prompts; p++) {
      at += 30_000 + rnd() * 60_000
      send(agent, sid, project, 'UserPromptSubmit', { prompt: 'x' }, at)
      const tools = 3 + Math.floor(rnd() * 9)
      for (let t = 0; t < tools; t++) {
        const kind = rnd()
        const id = `${sid}-${p}-${t}`
        const call = kind < 0.3 ? { tool_name: 'Read', tool_input: { file_path: '/p/f' + Math.floor(rnd() * 30) } }
          : kind < 0.5 ? { tool_name: 'Edit', tool_input: { file_path: '/p/f' + Math.floor(rnd() * 30) } }
          : kind < 0.62 ? { tool_name: 'Grep', tool_input: {} }
          : kind < 0.8 ? { tool_name: 'Bash', tool_input: { command: 'npm test' } }
          : { tool_name: 'Bash', tool_input: { command: 'ls' } }
        at += 2_000 + rnd() * 8_000
        send(agent, sid, project, 'PreToolUse', { ...call, tool_use_id: id }, at)
        at += 1_000 + rnd() * 20_000
        const failed = rnd() < 0.12
        if (agent === 'claude') send(agent, sid, project, failed ? 'PostToolUseFailure' : 'PostToolUse', { ...call, tool_use_id: id, tool_response: {}, error: 'Exit code 1' }, at)
        else send(agent, sid, project, 'PostToolUse', { ...call, tool_use_id: id, tool_response: `Exit code: ${failed ? 1 : 0}\nOutput:\n` }, at)
      }
      at += 5_000
      send(agent, sid, project, 'Stop', {}, at)
    }
    if (rnd() < 0.4) {
      store.applyEvent({ kind: 'commit', agent, session: sid, at, hash: Math.floor(rnd() * 1e15).toString(16).padStart(40, 'a'), added: Math.floor(rnd() * 120), removed: Math.floor(rnd() * 50), files: 1 + Math.floor(rnd() * 5), committedAt: at })
    }
    send(agent, sid, project, 'SessionEnd', {}, at + 60_000)
  }
}
console.log('seeded', store.dir, store.usage())
