// `codepuff doctor`: a read-only check of the installation. It changes nothing.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CODEX_EVENTS, codexPluginEnabled, runClaude } from './install.js'
import { dataDir } from './paths.js'

export function doctor(store, root) {
  const lines = []
  const ok = (label, detail = '') => lines.push(`  ok    ${label}${detail ? ' — ' + detail : ''}`)
  const warn = (label, detail = '') => lines.push(`  warn  ${label}${detail ? ' — ' + detail : ''}`)
  const nodeMajor = Number(process.versions.node.split('.')[0])
  nodeMajor >= 20 ? ok('Node.js', process.version) : warn('Node.js', `${process.version}; CodePuff needs 20 or newer`)

  const dir = dataDir()
  ok('data folder', dir)
  const pet = store.readPet()
  if (!pet.exists) warn('pet', 'none yet (it is created the first time an agent event arrives, or by "codepuff set name ...")')
  else if (pet.corrupt) warn('pet', 'pet.json is damaged; it will be moved aside and replaced on next use')
  else ok('pet', `${pet.pet.name || pet.pet.character} (${pet.pet.character})`)
  const records = store.listRecords()
  const usage = store.usage()
  ok('statistics', `${records.length} sessions, ${usage.files} files, ${(usage.bytes / 1024).toFixed(1)} KB`)
  const errors = store.paths.errors
  if (existsSync(errors)) {
    const last = readFileSync(errors, 'utf8').trim().split('\n').slice(-3)
    warn('hook errors logged', `see ${errors}; latest: ${last.join(' | ').slice(0, 200)}`)
  } else ok('hook errors', 'none logged')

  const git = spawnSync('git', ['--version'], { encoding: 'utf8' })
  git.status === 0 ? ok('git', git.stdout.trim()) : warn('git', 'not found: commit statistics will read "Unavailable"')

  // Codex: CodePuff can be there as a plugin (codex plugin add codepuff@codepuff) or as hooks in the user's hooks.json (codepuff install codex).
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')
  const readText = file => { try { return readFileSync(file, 'utf8') } catch { return '' } }
  const asPlugin = codexPluginEnabled(codexHome)
  const hooksFile = join(codexHome, 'hooks.json')
  let asHooks = 0
  let hooksBroken = false
  if (existsSync(hooksFile)) {
    try {
      const doc = JSON.parse(readFileSync(hooksFile, 'utf8'))
      asHooks = CODEX_EVENTS.filter(([event]) => (doc.hooks?.[event] ?? []).some(g => (g.hooks ?? []).some(h => /codepuff/i.test(h.command ?? '') && /hook codex/.test(h.command ?? '')))).length
    } catch { hooksBroken = true }
  }
  if (asPlugin && asHooks) warn('Codex', 'CodePuff is installed both as a plugin and as hooks in ' + hooksFile + ': every event is counted twice. Keep one ("codepuff uninstall codex" removes the hooks)')
  else if (asPlugin) ok('Codex', 'the CodePuff plugin is installed and enabled (Codex still asks you to trust its hooks: /hooks)')
  else if (asHooks === CODEX_EVENTS.length) ok('Codex', 'hooks installed in ' + hooksFile + ' (Codex still asks you to trust them: /hooks)')
  else if (asHooks) warn('Codex', asHooks + '/' + CODEX_EVENTS.length + ' hook events installed; run "codepuff install codex"')
  else if (hooksBroken) warn('Codex', hooksFile + ' is not valid JSON')
  else warn('Codex', 'CodePuff is not installed in Codex: run "codex plugin marketplace add luizbizzio/codepuff" and then "codex plugin add codepuff@codepuff"')

  // Claude Code: the plugin is enabled in the user's settings once it is installed.
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  let claudePlugin = false
  try { claudePlugin = Object.entries(JSON.parse(readText(join(claudeHome, 'settings.json')) || '{}').enabledPlugins ?? {}).some(([name, on]) => on && /^codepuff@/.test(name)) } catch { /* unreadable settings: not known */ }
  const claude = runClaude(['--version'], { encoding: 'utf8' })
  if (claudePlugin) ok('Claude Code', 'the CodePuff plugin is installed and enabled' + (claude.status === 0 ? ' (' + claude.stdout.trim().split('\n')[0] + ')' : ''))
  else warn('Claude Code', 'the CodePuff plugin is not enabled: in Claude Code run "/plugin marketplace add luizbizzio/codepuff" and then "/plugin install codepuff@codepuff"')
  console.log('CodePuff doctor\n' + lines.join('\n'))
}
