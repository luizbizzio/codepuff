import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const draw = host => spawnSync(process.execPath, [join(import.meta.dirname, 'fixtures', 'tui-smoke.mjs'), host], { encoding: 'utf8', timeout: 20_000 }).stdout.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')

test('the terminal app\'s statistics: Platform then Period, the host first, tiles and bars instead of a long list', () => {
  for (const [host, order] of [['codex', ['Codex', 'Claude Code', 'Combined']], ['claude', ['Claude Code', 'Codex', 'Combined']]]) {
    const screen = draw(host)
    const line = screen.split('\n').find(l => l.startsWith('Platform')) ?? ''
    assert.ok(line, host + ': a Platform line')
    const at = order.map(name => line.indexOf(name))
    assert.ok(at.every(i => i >= 0) && at[0] < at[1] && at[1] < at[2], `${host}: ${order.join(', ')} in that order (${line.trim()})`)
    assert.match(screen, /Period\s+This session\s+7 days\s+30 days\s+All time/)
    if (host === 'codex') {
      assert.match(screen, /Tool calls\s+4/)
      assert.match(screen, /What it did/)
    } else assert.match(screen, /This session · Claude Code/, "the session is the host's own")
    assert.ok(!/Prompts submitted/.test(screen), 'the long list is behind a key')
  }
})
