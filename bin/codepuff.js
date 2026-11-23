#!/usr/bin/env node
// `codepuff hook <agent>` is the hot path: it is started once per agent event, so it imports only what it needs.
if (process.argv[2] === 'hook') {
  const agent = process.argv[3] === 'claude' ? 'claude' : 'codex'
  const { runHookProcess } = await import('../src/node/hook.js')
  await runHookProcess(agent)
} else {
  const { main } = await import('../src/node/cli.js')
  await main(process.argv.slice(2))
}
