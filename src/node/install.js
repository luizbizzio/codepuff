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

/**
 * Whether CodePuff is installed and enabled as a Codex plugin: config.toml has a [plugins."codepuff@..."] table with enabled = true.
 * Read line by line (a table runs until the next [header]), so no pattern can backtrack.
 */
export function codexPluginEnabled(home) {
  let text
  try { text = readFileSync(join(home, 'config.toml'), 'utf8') } catch { return false }
  let inPlugin = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('[')) inPlugin = /^\[plugins\."codepuff@[^"]*"\]/.test(line)
    else if (inPlugin && /^enabled\s*=\s*true\b/.test(line)) return true
  }
  return false
}

/**
 * Runs a command line tool (`claude`, `codex`). On Windows it is usually a .cmd or .exe on PATH, which needs a shell; a shell concatenates its
 * arguments (and Node warns about passing them separately), so they are quoted here and passed as one command.
 */
export function runTool(name, args, options = {}) {
  if (process.platform !== 'win32') return spawnSync(name, args, options)
  return spawnSync([name, ...args].map(quoteWindowsArg).join(' '), { ...options, shell: true })
}
export const runClaude = (args, options) => runTool('claude', args, options)

/** Whether CodePuff is installed and enabled as a Claude Code plugin (the user's settings list it under enabledPlugins). */
export function claudePluginEnabled(home) {
  try { return Object.entries(JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8')).enabledPlugins ?? {}).some(([name, on]) => on && /^codepuff@/.test(name)) } catch { return false }
}

/** Quotes one argument the way Windows programs read their command line: a backslash only matters before a quote or at the end. */
export function quoteWindowsArg(text) {
  if (!/[\s&|<>^"%]/.test(text)) return text
  return '"' + text.replace(/(\\*)"/g, (_, slashes) => slashes + slashes + '\\"').replace(/(\\+)$/, slashes => slashes + slashes) + '"'
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
    const run = (...args) => runClaude(args, { stdio: 'inherit' })
    const probe = runClaude(['--version'], { encoding: 'utf8' })
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

/**
 * The command that starts `claude` or `codex`, or undefined when it cannot be found. It is tried on PATH first; apps do not always put
 * their command line there (the Codex desktop app on Windows lives inside a protected folder, Claude Code installs to ~/.local/bin), so the
 * usual places are tried too. Returns the name itself when PATH has it, otherwise the full path of the program.
 */
export function findTool(name, env = process.env) {
  if (runTool(name, ['--version'], { encoding: 'utf8' }).status === 0) return name
  if (env.CODEPUFF_PATH_ONLY) return undefined // (tests, and anyone who wants only what is on PATH)
  const home = homedir()
  const win = process.platform === 'win32'
  const places = [join(home, '.local', 'bin', win ? name + '.exe' : name), join(home, '.' + name, 'local', name)]
  if (win) {
    if (env.APPDATA) places.push(join(env.APPDATA, 'npm', name + '.cmd'))
    if (name === 'codex') {
      // The Codex desktop app is an installed package; the system knows where it is.
      const where = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "(Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1).InstallLocation"], { encoding: 'utf8' })
      const base = String(where.stdout ?? '').trim()
      if (base) places.push(join(base, 'app', 'resources', 'codex.exe'), join(base, 'codex.exe'))
    }
  } else {
    places.push('/usr/local/bin/' + name, '/opt/homebrew/bin/' + name, join(home, 'bin', name))
    if (name === 'codex') places.push('/Applications/Codex.app/Contents/Resources/codex', '/Applications/ChatGPT.app/Contents/Resources/codex')
  }
  for (const place of places) {
    if (existsSync(place) && runTool(place, ['--version'], { encoding: 'utf8' }).status === 0) return place
  }
  return undefined
}

/** Where CodePuff is installed from: the marketplace of its GitHub repository (never a local folder, which npx deletes). */
export const REPOSITORY = 'luizbizzio/codepuff'

/**
 * `codepuff setup`: installs CodePuff as a plugin in every host it finds (Claude Code, Codex) through their own command lines, which is
 * the same as typing their two plugin commands. Nothing is built or copied; a host that is not found gets the two commands to type.
 * Hosts that already have it are left alone.
 */
export function setupCommand(flags) {
  const dry = !!flags['dry-run']
  const only = ['claude', 'codex'].includes(flags.only) ? flags.only : undefined
  let failed = false
  const found = {}
  const step = (tool, args) => {
    out('  $ ' + [tool, ...args].join(' '))
    if (dry) return true
    const result = runTool(found[tool] ?? tool, args, { stdio: 'inherit' })
    return result.status === 0
  }

  if (only !== 'codex') {
    out('Claude Code')
    const home = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
    if (claudePluginEnabled(home)) out('  already installed')
    else if (!dry && !(found.claude = findTool('claude'))) {
      out('  the claude command was not found. In Claude Code, type:')
      out('    /plugin marketplace add ' + REPOSITORY)
      out('    /plugin install codepuff@codepuff')
    } else {
      // (A marketplace that is already added makes the first step complain; the install is still worth trying.)
      step('claude', ['plugin', 'marketplace', 'add', REPOSITORY])
      if (step('claude', ['plugin', 'install', 'codepuff@codepuff'])) out(dry ? '  (dry run: nothing was changed)' : '  installed: start a new Claude Code session, and the pet appears above the prompt')
      else { failed = true; out('  could not install it from here: in Claude Code, type the two lines above (/plugin marketplace add ' + REPOSITORY + ', /plugin install codepuff@codepuff)') }
    }
    out('')
  }

  if (only !== 'claude') {
    out('Codex')
    const home = codexHome(flags)
    const hooks = existsSync(join(home, 'hooks.json')) && /codepuff/i.test(readFileSync(join(home, 'hooks.json'), 'utf8'))
    if (codexPluginEnabled(home)) out('  already installed')
    else if (hooks) out('  CodePuff is already in Codex as hooks (codepuff install codex): installing the plugin too would count every event twice, so nothing was changed')
    else if (!dry && !(found.codex = findTool('codex'))) {
      out('  the codex command was not found. In a terminal where Codex runs, type:')
      out('    codex plugin marketplace add ' + REPOSITORY)
      out('    codex plugin add codepuff@codepuff')
    } else {
      step('codex', ['plugin', 'marketplace', 'add', REPOSITORY])
      if (step('codex', ['plugin', 'add', 'codepuff@codepuff'])) {
        out(dry ? '  (dry run: nothing was changed.) After installing, trust the hooks: Codex does not run new hooks until you do' : '  installed. One thing is left, and only you can do it: Codex does not run new hooks until you trust them')
        out('    Codex CLI: start Codex and type /hooks.   Codex desktop app: Review hooks.')
        out('  To watch the pet next to Codex: npx github:' + REPOSITORY + ' pet')
      } else { failed = true; out('  could not install it from here: type the two lines above in a terminal where Codex runs') }
    }
    out('')
  }
  out('Check it any time with: npx github:' + REPOSITORY + ' doctor')
  if (failed) process.exitCode = 1
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
