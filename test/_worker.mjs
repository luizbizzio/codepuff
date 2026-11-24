// A test helper process: applies N tool completions to one session, as a separate OS process would.
import { openStore } from '../src/node/store.js'
import { normalizeHook } from '../src/core/normalize.js'

const [dir, agent, session, count, tag] = process.argv.slice(2)
// Six processes on one session is far more contention than a real machine sees: they wait as long as it takes, so the test checks
// that the lock keeps every update (a hook in real use gives up after a few seconds rather than hang the agent).
const store = openStore(dir, { lockTimeout: 120_000 })
for (let i = 0; i < Number(count); i++) {
  const ev = normalizeHook(agent, { hook_event_name: 'PostToolUse', session_id: session, cwd: '/p', tool_name: 'Read', tool_use_id: `${tag}-${i}`, tool_response: {} }, Date.now())
  store.applyEvent(ev)
}
