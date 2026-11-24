// What a tool call *is*, decided from its name and arguments, and what a finished shell command
// *did*, decided from its exit code. Nothing here stores or returns the command text, a path, or any
// output: callers get a category, an activity, a few booleans, and opaque file ids.
//
// Two vocabularies:
//   cat  how the call is counted in statistics (stable, small):
//        read search edit shell web agent plan mcp other
//   act  what the pet should look like it is doing (finer, for animation):
//        read search edit run test git web delegate plan ask mcp other

import { pathId } from './hash.js'

export const CATEGORIES = ['read', 'search', 'edit', 'shell', 'web', 'agent', 'plan', 'mcp', 'other']

const BY_NAME = new Map()
const add = (cat, act, names) => names.forEach(name => BY_NAME.set(name, { cat, act }))
add('read', 'read', ['read', 'view', 'view_image', 'notebookread', 'ls', 'readmcpresource', 'listmcpresources'])
add('search', 'search', ['glob', 'grep', 'toolsearch', 'search', 'find'])
add('edit', 'edit', ['edit', 'multiedit', 'write', 'notebookedit', 'apply_patch', 'str_replace_editor', 'create', 'str_replace_based_edit_tool'])
add('shell', 'run', ['bash', 'powershell', 'shell', 'exec_command', 'local_shell', 'shell_command', 'run_command', 'write_stdin', 'bashoutput', 'killshell', 'monitor'])
add('web', 'web', ['webfetch', 'websearch', 'web_search', 'web_fetch'])
add('agent', 'delegate', ['task', 'agent', 'spawn_agent', 'subagent', 'send_input', 'wait_agent'])
add('plan', 'plan', ['todowrite', 'update_plan', 'exitplanmode', 'enterplanmode', 'taskcreate', 'taskupdate', 'tasklist', 'taskget', 'taskstop', 'taskoutput'])
add('other', 'ask', ['askuserquestion', 'request_user_input'])

const SHELLS = new Set(['shell'])

/**
 * @param {string} tool the host's tool name
 * @param {unknown} input the host's tool arguments (read, never stored)
 */
export function classifyTool(tool, input) {
  const name = String(tool ?? '').trim()
  const lower = name.toLowerCase()
  const args = input && typeof input === 'object' ? /** @type {Record<string, unknown>} */ (input) : {}
  if (lower.startsWith('mcp__') || lower.startsWith('mcp:')) return { cat: 'mcp', act: 'mcp', files: [] }
  const known = BY_NAME.get(lower)
  if (!known) return { cat: 'other', act: 'other', files: [] }
  if (known.cat === 'edit') return { ...known, files: filesOf(lower, args) }
  if (SHELLS.has(known.cat)) {
    const command = commandOf(args)
    if (command === undefined) return { ...known, files: [] }
    const found = analyzeCommand(command)
    return { cat: 'shell', act: found.act, test: found.test, commit: found.commit, piped: found.piped, soft: found.soft, files: [] }
  }
  return { ...known, files: [] }
}

/** The command string of a shell tool call, from the argument names hosts use. */
function commandOf(args) {
  const raw = args.command ?? args.cmd ?? args.script ?? args.input
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.filter(part => typeof part === 'string').join(' ')
  return undefined
}

/** Opaque ids of the files an edit touches. Paths are hashed and never kept. */
function filesOf(tool, args) {
  const direct = args.file_path ?? args.path ?? args.notebook_path ?? args.filePath
  if (typeof direct === 'string' && direct) return [pathId(direct)]
  if (tool === 'apply_patch') {
    const patch = [args.command, args.input, args.patch].find(value => typeof value === 'string')
    if (typeof patch !== 'string') return []
    const ids = new Set()
    for (const match of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$/gm)) ids.add(pathId(match[1]))
    for (const match of patch.matchAll(/^\*\*\* Move to: (.+?)\s*$/gm)) ids.add(pathId(match[1]))
    return [...ids]
  }
  return []
}

// ---------------------------------------------------------------------------------------------------
// Shell commands

const TEST_PATTERNS = [
  /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|tests|t|test:[\w:.-]+|check|verify)(?:\s|$)/,
  /^(?:npx|pnpx|bunx)\s+(?:--?\w[\w-]*\s+)*(?:jest|vitest|mocha|ava|tap|playwright\s+test|cypress\s+run|uvu)\b/,
  /^yarn\s+dlx\s+(?:jest|vitest|mocha)\b/,
  /^(?:jest|vitest|mocha|ava|tap|uvu|pytest|py\.test|tox|nox|rspec|phpunit|ctest|busted|nosetests|behave)\b/,
  /^(?:playwright\s+test|cypress\s+run)\b/,
  /^go\s+test\b/,
  /^cargo\s+(?:test|nextest)\b/,
  /^dotnet\s+test\b/,
  /^(?:mvn|mvnw|\.\/mvnw)\s+(?:.*\s)?(?:test|verify)\b/,
  /^(?:gradle|gradlew|\.\/gradlew)\s+(?:.*\s)?(?:test|check)\b/,
  /^swift\s+test\b/,
  /^mix\s+test\b/,
  /^(?:deno|bun)\s+test\b/,
  /^node\s+(?:.*\s)?--test\b/,
  /^(?:python3?|py)\s+(?:-\d\s+)?-m\s+(?:pytest|unittest|nose2|tox)\b/,
  /^(?:make|just|task)\s+(?:test|tests|check)\b/,
  /^(?:bundle\s+exec\s+)?rake\s+(?:test|spec)\b/,
  /^(?:\.\/)?vendor\/bin\/(?:phpunit|pest)\b/,
]

const SOFT_EXIT_ONE = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'diff', 'cmp', 'test', '[', 'findstr', 'select-string', 'sls', 'fc', 'comp'])
const READ_PROGRAMS = new Set(['cat', 'head', 'tail', 'less', 'more', 'type', 'get-content', 'gc', 'bat', 'nl', 'wc', 'stat', 'file', 'ls', 'dir', 'tree', 'get-childitem', 'gci', 'pwd', 'get-item', 'readlink', 'realpath', 'du', 'df', 'get-location', 'sed', 'awk', 'sort', 'uniq', 'cut'])
const SEARCH_PROGRAMS = new Set(['rg', 'grep', 'egrep', 'fgrep', 'ag', 'ack', 'find', 'fd', 'fdfind', 'select-string', 'sls', 'findstr', 'locate', 'where', 'which', 'get-command', 'gcm'])
const READ_GIT = new Set(['status', 'log', 'diff', 'show', 'blame', 'rev-parse', 'ls-files', 'grep', 'shortlog', 'describe', 'remote', 'config', 'branch', 'tag', 'stash'])
const TRIVIAL = new Set(['cd', 'pushd', 'popd', 'echo', 'set', 'export', 'true', 'false', 'sleep', 'clear', 'cls', 'set-location', 'sl', 'write-host', 'write-output', ':'])
const WRAPPERS = new Set(['sudo', 'time', 'env', 'command', 'nohup', 'call', 'exec', 'nice', 'stdbuf', 'timeout', 'doas', 'xargs'])

/** Splits a command line at unquoted `&&`, `||`, `;`, `|` and newlines. */
function splitSegments(text) {
  const segments = []
  let current = ''
  let quote = ''
  let piped = false
  const flush = () => { if (current.trim()) segments.push(current.trim()); current = '' }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      current += ch
      if (ch === '\\' && quote === '"' && i + 1 < text.length) current += text[++i]
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch === '`' ? '' : ch; current += ch; continue }
    if (ch === '\n' || ch === ';') { flush(); continue }
    if (ch === '&' && text[i + 1] === '&') { flush(); i++; continue }
    if (ch === '|' && text[i + 1] === '|') { flush(); i++; continue }
    if (ch === '|') { piped = true; flush(); continue }
    current += ch
  }
  flush()
  return { segments, piped }
}

/** Splits one segment into words, honoring quotes (the quotes are dropped). */
function words(segment) {
  const out = []
  let current = ''
  let quote = ''
  let has = false
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < segment.length) { current += segment[++i]; continue }
      if (ch === quote) { quote = ''; continue }
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; has = true; continue }
    if (/\s/.test(ch)) { if (has || current) out.push(current); current = ''; has = false; continue }
    current += ch
  }
  if (has || current) out.push(current)
  return out
}

const programName = word => word.replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd|bat|ps1)$/i, '').toLowerCase()

/** The program and arguments of a segment, after env assignments and wrapper programs. */
function head(parts) {
  let i = 0
  while (i < parts.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i]) || parts[i] === '&' || parts[i] === '.\\' )) i++
  while (i < parts.length && WRAPPERS.has(programName(parts[i]))) {
    i++
    while (i < parts.length && (parts[i].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i]) || /^\d+[smhd]?$/.test(parts[i]))) i++
  }
  return { program: i < parts.length ? programName(parts[i]) : '', args: parts.slice(i + 1), line: parts.slice(i).join(' ').toLowerCase() }
}

/** `bash -lc "..."`, `powershell -Command "..."`, `cmd /c ...`: the command that really runs. */
function innerCommand(program, args) {
  if (['bash', 'sh', 'zsh', 'dash', 'fish'].includes(program)) {
    const at = args.findIndex(arg => /^-[a-z]*c[a-z]*$/.test(arg))
    return at >= 0 ? args[at + 1] : undefined
  }
  if (['powershell', 'pwsh'].includes(program)) {
    const at = args.findIndex(arg => /^-(?:c|command|commandwithargs)$/i.test(arg))
    return at >= 0 ? args.slice(at + 1).join(' ') : undefined
  }
  if (program === 'cmd') {
    const at = args.findIndex(arg => /^\/[ck]$/i.test(arg))
    return at >= 0 ? args.slice(at + 1).join(' ') : undefined
  }
  return undefined
}

function gitSubcommand(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-C' || arg === '-c' || arg === '--git-dir' || arg === '--work-tree') { i++; continue }
    if (arg.startsWith('-')) continue
    return arg.toLowerCase()
  }
  return ''
}

/**
 * @param {string} command
 * @param {number} [depth]
 * @returns {{ act: string, test: boolean, commit: boolean, piped: boolean, soft: boolean }}
 */
export function analyzeCommand(command, depth = 0) {
  const result = { act: 'run', test: false, commit: false, piped: false, soft: false }
  if (typeof command !== 'string' || !command.trim()) return result
  const { segments, piped } = splitSegments(command.slice(0, 4000))
  result.piped = piped
  let act
  let lastProgram = ''
  for (const segment of segments) {
    const { program, args, line } = head(words(segment))
    if (!program) continue
    const inner = depth < 2 ? innerCommand(program, args) : undefined
    if (inner !== undefined) {
      const found = analyzeCommand(inner, depth + 1)
      result.test ||= found.test
      result.commit ||= found.commit
      result.piped ||= found.piped
      result.soft ||= found.soft
      if (!act && found.act !== 'run') act = found.act
      lastProgram = ''
      continue
    }
    lastProgram = program
    if (TEST_PATTERNS.some(pattern => pattern.test(line))) { result.test = true; continue }
    if (program === 'git') {
      const sub = gitSubcommand(args)
      if (sub === 'commit' && !args.includes('--dry-run')) result.commit = true
      act ??= READ_GIT.has(sub) && !(sub === 'branch' && args.some(a => !a.startsWith('-') && a !== 'branch')) ? 'read' : 'git'
      continue
    }
    if (TRIVIAL.has(program)) continue
    if (SEARCH_PROGRAMS.has(program)) { act ??= 'search'; continue }
    if (READ_PROGRAMS.has(program)) { act ??= 'read'; continue }
    act ??= 'run'
  }
  result.soft = result.soft || (lastProgram !== '' && SOFT_EXIT_ONE.has(lastProgram))
  result.act = result.test ? 'test' : result.commit ? 'git' : act ?? 'run'
  return result
}

// ---------------------------------------------------------------------------------------------------
// Outcomes

/**
 * Reads an exit code out of whatever a host gives for a tool result, without keeping any of it.
 * Returns `undefined` when no exit code can be found, which callers must treat as *unknown*.
 * @param {unknown} value
 * @returns {{ code?: number, interrupted: boolean, isError: boolean }}
 */
export function exitInfo(value) {
  const info = { interrupted: false, isError: false }
  const visit = (item, depth) => {
    if (depth > 3 || item === null || item === undefined) return
    if (typeof item === 'string') {
      const head = item.slice(0, 600)
      const match = /(?:^|\n)\s*(?:exit(?:ed)?(?:\s+with)?\s+code|process exited with code|exit status|returncode|exit_code)\s*[:=]?\s*(-?\d+)/i.exec(head)
      if (match && info.code === undefined) info.code = Number(match[1])
      if (info.code === undefined && /^\s*[{[]/.test(head)) {
        try { visit(JSON.parse(item), depth + 1) } catch { /* not JSON: fine */ }
      }
      return
    }
    if (typeof item !== 'object') return
    for (const key of ['exitCode', 'exit_code', 'returncode', 'returnCode', 'code', 'status']) {
      if (info.code === undefined && Number.isInteger(item[key])) info.code = item[key]
    }
    if (item.interrupted === true || item.aborted === true || item.cancelled === true) info.interrupted = true
    if (item.isError === true || item.is_error === true) info.isError = true
    for (const key of ['metadata', 'output', 'result', 'content', 'stdout', 'text']) {
      if (key in item && info.code === undefined) visit(item[key], depth + 1)
    }
    if (Array.isArray(item.content)) item.content.slice(0, 3).forEach(part => visit(part?.text ?? part, depth + 1))
  }
  visit(value, 0)
  return info
}

/**
 * Decides the outcome of a finished tool call.
 * `true` = succeeded, `false` = failed, `null` = cannot be determined (never guessed).
 * @param {{ cat: string, test?: boolean, piped?: boolean, soft?: boolean }} info classifyTool's answer
 * @param {{ hostSays?: 'success' | 'failure', response?: unknown, error?: unknown }} seen
 */
export function outcomeOf(info, seen) {
  const fromResponse = exitInfo(seen.response)
  const fromError = typeof seen.error === 'string' ? exitInfo(seen.error) : { interrupted: false, isError: false }
  const interrupted = fromResponse.interrupted || fromError.interrupted
  const code = fromError.code ?? fromResponse.code
  if (interrupted) return { ok: null, interrupted: true, code }
  if (info.cat === 'shell') {
    // Claude Code says outright whether a call succeeded; Codex does not, so its exit code is read.
    if (seen.hostSays === 'success') return { ok: true, code: 0 }
    if (code !== undefined) {
      if (code === 0) return { ok: true, code }
      if (code === 1 && info.soft) return { ok: true, code, soft: true }
      return { ok: false, code }
    }
    if (seen.hostSays === 'failure') return { ok: false }
    return { ok: fromResponse.isError ? false : null }
  }
  if (seen.hostSays === 'failure' || fromResponse.isError) return { ok: false }
  if (seen.hostSays === 'success') return { ok: true }
  // Not a shell command and the host does not split success from failure (Codex): a tool that finished with a
  // result and no error indication counts as completed. A result that says it failed does not.
  if (typeof seen.response === 'string' && /^\s*(?:error|failed|failure)\b/i.test(seen.response)) return { ok: false }
  if (seen.response !== undefined) return { ok: true }
  return { ok: null }
}

/**
 * The verdict of a test command. A pipeline hides the exit code of the test (`npm test | tail`), so it
 * is reported as unknown rather than guessed.
 * @returns {'pass' | 'fail' | 'unknown'}
 */
export function testVerdict(info, outcome) {
  if (!info.test) return 'unknown'
  if (info.piped) return 'unknown'
  if (outcome.ok === true) return 'pass'
  if (outcome.ok === false) return 'fail'
  return 'unknown'
}
