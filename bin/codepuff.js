#!/usr/bin/env node
// `codepuff hook <agent>` is the hot path: it is started once per agent event, so it imports only what it needs.
if (process.argv[2] === 'hook') {
  const agent = process.argv[3] === 'claude' ? 'claude' : 'codex'
  const { runHookProcess } = await import('../src/node/hook.js')
  await runHookProcess(agent)
} else {
  // `codepuff stats | head` closes the pipe early; that is not an error.
  process.stdout.on('error', error => { if (error.code === 'EPIPE') process.exit(0); throw error })
  const { main } = await import('../src/node/cli.js')
  await main(process.argv.slice(2))
}
