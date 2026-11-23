// `codepuff doctor`: a read-only check of the installation. It changes nothing.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CODEX_EVENTS } from './install.js'
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

  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')
  const hooksFile = join(codexHome, 'hooks.json')
  if (existsSync(hooksFile)) {
    try {
      const doc = JSON.parse(readFileSync(hooksFile, 'utf8'))
      const have = CODEX_EVENTS.filter(([event]) => (doc.hooks?.[event] ?? []).some(g => (g.hooks ?? []).some(h => /codepuff/i.test(h.command ?? '') && /hook codex/.test(h.command ?? ''))))
      have.length === CODEX_EVENTS.length ? ok('Codex hooks', `installed in ${hooksFile} (Codex still asks you to trust them: /hooks)`) : have.length ? warn('Codex hooks', `${have.length}/${CODEX_EVENTS.length} events installed; run "codepuff install codex"`) : warn('Codex hooks', 'not installed; run "codepuff install codex"')
    } catch { warn('Codex hooks', `${hooksFile} is not valid JSON`) }
  } else warn('Codex hooks', 'not installed; run "codepuff install codex"')
  const claude = spawnSync('claude', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
  claude.status === 0 ? ok('Claude Code', claude.stdout.trim().split('\n')[0] + ' (install the plugin with: codepuff install claude)') : warn('Claude Code', '`claude` not found on PATH (the desktop app has its own copy; install the plugin from inside it)')
  console.log('CodePuff doctor\n' + lines.join('\n'))
}
