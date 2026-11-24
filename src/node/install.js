// Installing and removing the integrations.
//
// Codex: CodePuff's hooks are added to the *user-level* hooks.json (a backup is made first, existing hooks are
//   kept, and the change is idempotent). Codex then asks the user to review and trust them before they run;
//   CodePuff never edits trust state itself.
// Claude Code: CodePuff is a plugin. The installer adds this repository as a plugin marketplace and installs the
//   plugin through the `claude` CLI when it is available, and otherwise prints the two slash commands.
//
// Uninstalling removes only what installing added. It never touches the data folder.

import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { atomicWrite } from './fsx.js'

const out = text => process.stdout.write(text + '\n')

/** Events CodePuff observes on Codex. Sync ones are cheap and end a state; the rest never block the agent. */
export const CODEX_EVENTS = [
  ['SessionStart', true], ['UserPromptSubmit', true], ['PreToolUse', true], ['PostToolUse', true], ['PermissionRequest', true],
  ['PreModelRequest', true], ['PostModelRequest', true], ['SubagentStart', true], ['SubagentStop', true],
  ['Stop', false], ['Interrupt', false], ['SessionEnd', false],
]

/**
 * The command a Codex *plugin* runs. Codex gives plugin hooks the plugin's folder in the PLUGIN_ROOT environment
 * variable (and CLAUDE_PLUGIN_ROOT for compatibility), and does not promise any shell expansion in the command
 * string, so the script reads the variable itself. It works in cmd, PowerShell and POSIX shells, needs only `node`,
 * and answers `{}` even if CodePuff cannot be found, so it can never break the agent.
 */
export const PLUGIN_HOOK_COMMAND = 'node -e "(async()=>{try{const p=require(\'node:path\'),u=require(\'node:url\'),r=process.env.PLUGIN_ROOT||process.env.CLAUDE_PLUGIN_ROOT;process.argv.splice(1,0,\'codepuff\',\'hook\',\'codex\');await import(u.pathToFileURL(p.join(r,\'bin\',\'codepuff.js\')).href)}catch{process.stdout.write(\'{}\')}})()"'

/** The hooks.json shipped inside the Codex plugin (codex/hooks.json), generated from one template. */
export function pluginHooksDocument() {
  const hooks = {}
  for (const [event, isAsync] of CODEX_EVENTS) {
    hooks[event] = [{ hooks: [{ type: 'command', command: PLUGIN_HOOK_COMMAND, timeout: event === 'Interrupt' || event === 'SessionEnd' ? 3 : 10, ...(isAsync ? { async: true } : {}) }] }]
  }
  return { description: 'CodePuff observes Codex lifecycle events so your pet can react. It records counters only (never prompts, code, commands or outputs) and answers {} to every event.', hooks }
}

export const codexHome = flags => resolve(String(flags?.['codex-home'] ?? process.env.CODEX_HOME ?? join(homedir(), '.codex')))

/** The command Codex runs. `node` is resolved from PATH on purpose: it works in cmd, PowerShell and POSIX shells alike. */
export const hookCommand = cliPath => `node "${cliPath}" hook codex`

const isOurs = handler => typeof handler?.command === 'string' && /codepuff/i.test(handler.command) && /\bhook codex\b/.test(handler.command)

/** Pure: the hooks document after adding (or removing) CodePuff's entries. */
export function mergeCodexHooks(doc, cliPath, { remove = false } = {}) {
  const next = doc && typeof doc === 'object' && !Array.isArray(doc) ? structuredClone(doc) : {}
  next.hooks = next.hooks && typeof next.hooks === 'object' ? next.hooks : {}
  for (const [event, isAsync] of CODEX_EVENTS) {
    const groups = (Array.isArray(next.hooks[event]) ? next.hooks[event] : [])
      .map(group => ({ ...group, hooks: (group.hooks ?? []).filter(handler => !isOurs(handler)) }))
      .filter(group => group.hooks.length > 0)
    if (!remove) groups.push({ hooks: [{ type: 'command', command: hookCommand(cliPath), timeout: 10, ...(isAsync ? { async: true } : {}) }] })
    if (groups.length) next.hooks[event] = groups
    else delete next.hooks[event]
  }
  return next
}

function readJson(file) {
  if (!existsSync(file)) return { exists: false, doc: {} }
  const text = readFileSync(file, 'utf8')
  try { return { exists: true, doc: text.trim() ? JSON.parse(text) : {} } } catch (error) { return { exists: true, error: `${file} is not valid JSON (${error.message}); not touching it.` } }
}

export function installCodex({ home, cliPath, dryRun = false, remove = false }) {
  const file = join(home, 'hooks.json')
  const read = readJson(file)
  if (read.error) throw new Error(read.error)
  const merged = mergeCodexHooks(read.doc, cliPath, { remove })
  const text = JSON.stringify(merged, null, 2) + '\n'
  const unchanged = read.exists && JSON.stringify(read.doc, null, 2) + '\n' === text
  if (!dryRun && !unchanged) {
    if (read.exists && !existsSync(file + '.codepuff-backup')) copyFileSync(file, file + '.codepuff-backup')
    atomicWrite(file, text)
  }
  return { file, unchanged, text, backedUp: read.exists && !dryRun && !unchanged }
}

/** Whether CodePuff is installed and enabled as a Codex plugin (config.toml has an enabled [plugins."codepuff@..."] entry). */
export function codexPluginEnabled(home) {
  try { return /\[plugins\."codepuff@[^"]*"\]\s*\n(?:[^\[]*\n)*?\s*enabled\s*=\s*true/.test(readFileSync(join(home, 'config.toml'), 'utf8')) } catch { return false }
}

export function installCommand(target, flags, root) {
  const cliPath = join(root, 'bin', 'codepuff.js')
  if (target === 'codex') {
    const home = codexHome(flags)
    // The hooks written below point at this copy of CodePuff. A copy that npx unpacked into its temporary cache is deleted later, and
    // then every hook would fail; and with the plugin installed too, every event would be counted twice. So: a clone, or the plugin.
    if (!flags.force && /[\\/]_npx[\\/]/.test(root)) {
      out('"codepuff install codex" needs a copy of CodePuff that stays where it is (a clone). This one was unpacked by npx into a temporary')
      out('cache, and the hooks would stop working when it is cleaned up. Easier: install CodePuff as a Codex plugin instead:')
      out('  codex plugin marketplace add luizbizzio/codepuff')
      out('  codex plugin add codepuff@codepuff')
      process.exitCode = 1
      return
    }
    if (!flags.force && codexPluginEnabled(home)) {
      out('CodePuff is already installed in Codex as a plugin. Adding its hooks too would count every event twice, so nothing was changed.')
      out('(Use one or the other. To switch: codex plugin remove codepuff, then run this again. --force adds the hooks anyway.)')
      process.exitCode = 1
      return
    }
    const done = installCodex({ home, cliPath, dryRun: !!flags['dry-run'] })
    if (flags['dry-run']) return out(`Would write ${done.file}:\n${done.text}`)
    out(done.unchanged ? `CodePuff hooks are already in ${done.file}.` : `Added CodePuff hooks to ${done.file}${done.backedUp ? ' (a backup was saved next to it as hooks.json.codepuff-backup)' : ''}.`)
    out('')
    out('Codex will not run new hooks until you review them:')
    out('  • Codex CLI: start Codex, then run /hooks and trust the CodePuff entries.')
    out('  • Codex desktop app: open "Review hooks" in the composer, or Settings → Hooks.')
    out('Then run "codepuff pet" in another terminal to see your pet react.')
    return
  }
  if (target === 'claude') {
    const run = (...args) => spawnSync('claude', args, { stdio: 'inherit', shell: process.platform === 'win32' })
    const probe = spawnSync('claude', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
    if (flags['dry-run'] || probe.status !== 0) {
      out('Install the CodePuff plugin from inside Claude Code:')
      out(`  /plugin marketplace add ${root}`)
      out('  /plugin install codepuff@codepuff')
      out('(In the desktop app: + next to the prompt → Plugins → Add marketplace → this folder, then Add plugin.)')
      if (!flags['dry-run']) out('\nThe `claude` command was not found on PATH, so nothing was installed automatically.')
      return
    }
    const added = run('plugin', 'marketplace', 'add', root)
    const installed = added.status === 0 ? run('plugin', 'install', 'codepuff@codepuff') : added
    if (installed.status !== 0) process.exitCode = 1
    else out('Installed. Start a new Claude Code session; the pet pane opens with /codepuff.')
    return
  }
  throw new Error('Usage: codepuff install codex|claude [--dry-run]')
}

export function uninstallCommand(target, flags, root) {
  const cliPath = join(root, 'bin', 'codepuff.js')
  if (target === 'codex') {
    const home = codexHome(flags)
    const done = installCodex({ home, cliPath, dryRun: !!flags['dry-run'], remove: true })
    if (flags['dry-run']) return out(`Would write ${done.file}:\n${done.text}`)
    out(done.unchanged ? 'No CodePuff hooks were found.' : `Removed CodePuff hooks from ${done.file}. Your other hooks were not touched.`)
    out('Your pet and statistics were kept. "codepuff data delete --yes" removes them.')
    return
  }
  if (target === 'claude') {
    out('Remove the plugin from inside Claude Code:  /plugin uninstall codepuff@codepuff')
    out('Your pet and statistics were kept. "codepuff data delete --yes" removes them.')
    return
  }
  throw new Error('Usage: codepuff uninstall codex|claude [--dry-run]')
}
