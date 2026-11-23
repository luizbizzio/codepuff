import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCommand, classifyTool, exitInfo, outcomeOf, testVerdict } from '../src/core/classify.js'

test('tool names map to categories and activities', () => {
  assert.deepEqual(pick(classifyTool('Read', { file_path: 'a.js' })), { cat: 'read', act: 'read' })
  assert.deepEqual(pick(classifyTool('Grep', {})), { cat: 'search', act: 'search' })
  assert.deepEqual(pick(classifyTool('Edit', { file_path: 'a.js' })), { cat: 'edit', act: 'edit' })
  assert.deepEqual(pick(classifyTool('apply_patch', { command: '*** Begin Patch\n*** Update File: a.js\n*** End Patch' })), { cat: 'edit', act: 'edit' })
  assert.deepEqual(pick(classifyTool('WebFetch', {})), { cat: 'web', act: 'web' })
  assert.deepEqual(pick(classifyTool('Task', {})), { cat: 'agent', act: 'delegate' })
  assert.deepEqual(pick(classifyTool('mcp__github__create_issue', {})), { cat: 'mcp', act: 'mcp' })
  assert.deepEqual(pick(classifyTool('SomethingNew', {})), { cat: 'other', act: 'other' })
  assert.equal(classifyTool('AskUserQuestion', {}).act, 'ask')
})

const pick = ({ cat, act }) => ({ cat, act })

test('edits report opaque file ids, never paths', () => {
  const info = classifyTool('Edit', { file_path: 'C:\\work\\secret\\plan.md' })
  assert.equal(info.files.length, 1)
  assert.match(info.files[0], /^[0-9a-f]{12}$/)
  assert.ok(!JSON.stringify(info).includes('secret'))
  const same = classifyTool('Edit', { file_path: 'c:/work/secret/PLAN.md' })
  assert.deepEqual(same.files, info.files, 'path separators and case do not make a second file on Windows')
  const patch = classifyTool('apply_patch', { command: '*** Begin Patch\n*** Add File: x/a.txt\n*** Update File: x/b.txt\n*** Move to: x/c.txt\n*** End Patch' })
  assert.equal(patch.files.length, 3)
})

test('test commands are recognized across ecosystems', () => {
  const yes = [
    'npm test', 'npm run test', 'npm run test:unit -- --watch=false', 'pnpm test', 'yarn test', 'bun test', 'npx vitest run', 'npx jest --ci',
    'pytest -q', 'python -m pytest tests/', 'py -3 -m pytest', 'python3 -m unittest discover', 'go test ./...', 'cargo test', 'dotnet test', 'mvn -q test',
    './gradlew test', 'node --test test/', 'deno test', 'make test', 'cd app && npm test', 'FOO=1 pytest', 'bash -lc "cargo test --all"',
    'powershell -NoProfile -Command "npm test"', 'cmd /c npm test', 'rspec spec/', 'phpunit', 'swift test',
  ]
  for (const command of yes) assert.equal(analyzeCommand(command).test, true, command)
  const no = ['npm install', 'npm run build', 'git status', 'ls -la', 'echo test', 'cat tests.txt', 'npm run lint', 'node script.js', 'python app.py', 'grep -r "npm test" .']
  for (const command of no) assert.equal(analyzeCommand(command).test, false, command)
})

test('git commits are recognized, dry runs and reads are not', () => {
  assert.equal(analyzeCommand('git commit -m "x"').commit, true)
  assert.equal(analyzeCommand('git add -A && git commit -m "x"').commit, true)
  assert.equal(analyzeCommand('git -C repo commit --amend --no-edit').commit, true)
  assert.equal(analyzeCommand('git commit --dry-run').commit, false)
  assert.equal(analyzeCommand('git log --oneline').commit, false)
  assert.equal(analyzeCommand('echo "git commit"').commit, false)
  assert.equal(analyzeCommand('git status').act, 'read')
  assert.equal(analyzeCommand('git push').act, 'git')
})

test('shell commands get a meaningful activity', () => {
  assert.equal(analyzeCommand('rg -n foo src').act, 'search')
  assert.equal(analyzeCommand('cat README.md').act, 'read')
  assert.equal(analyzeCommand('Get-Content package.json').act, 'read')
  assert.equal(analyzeCommand('npm run build').act, 'run')
  assert.equal(analyzeCommand('cd src && ls').act, 'read')
  assert.equal(analyzeCommand('npm test').act, 'test')
  assert.equal(analyzeCommand('').act, 'run')
})

test('the command text is never part of the result', () => {
  const info = classifyTool('Bash', { command: 'curl -H "Authorization: Bearer SECRET123" https://x' })
  assert.ok(!JSON.stringify(info).includes('SECRET123'))
})

test('exit codes are read from the shapes hosts use, and never guessed', () => {
  assert.equal(exitInfo({ exitCode: 2 }).code, 2)
  assert.equal(exitInfo({ metadata: { exit_code: 1 } }).code, 1)
  assert.equal(exitInfo('Exit code: 3\nWall time: 1s\nOutput:\nboom').code, 3)
  assert.equal(exitInfo('Process exited with code 0').code, 0)
  assert.equal(exitInfo(JSON.stringify({ output: 'x', metadata: { exit_code: 7 } })).code, 7)
  assert.equal(exitInfo('everything went fine').code, undefined)
  assert.equal(exitInfo(undefined).code, undefined)
  assert.equal(exitInfo({ interrupted: true }).interrupted, true)
})

test('outcomes: Claude splits success and failure by hook, Codex by exit code', () => {
  const bash = classifyTool('Bash', { command: 'npm test' })
  assert.deepEqual(outcomeOf(bash, { hostSays: 'success' }), { ok: true, code: 0 })
  assert.equal(outcomeOf(bash, { hostSays: 'failure', error: 'Exit code 1\nnope' }).ok, false)
  assert.equal(outcomeOf(bash, { response: 'Exit code: 0\nOutput:\nok' }).ok, true)
  assert.equal(outcomeOf(bash, { response: { metadata: { exit_code: 1 } } }).ok, false)
  assert.equal(outcomeOf(bash, { response: 'no exit code anywhere' }).ok, null, 'unknown stays unknown')
  assert.equal(outcomeOf(bash, { response: { interrupted: true } }).ok, null)
})

test('a failing grep or diff (exit 1) is "no match", not a failure', () => {
  const grep = classifyTool('Bash', { command: 'grep -r needle src' })
  assert.deepEqual(outcomeOf(grep, { response: 'Exit code: 1' }), { ok: true, code: 1, soft: true })
  assert.equal(outcomeOf(grep, { response: 'Exit code: 2' }).ok, false)
  const test = classifyTool('Bash', { command: 'pytest' })
  assert.equal(outcomeOf(test, { response: 'Exit code: 1' }).ok, false, 'a test run exiting 1 is a failure')
})

test('a piped test command has an unreliable exit code and is reported unknown', () => {
  const piped = classifyTool('Bash', { command: 'npm test | tail -5' })
  assert.equal(piped.piped, true)
  assert.equal(testVerdict(piped, { ok: true }), 'unknown')
  const plain = classifyTool('Bash', { command: 'npm test' })
  assert.equal(testVerdict(plain, { ok: true }), 'pass')
  assert.equal(testVerdict(plain, { ok: false }), 'fail')
  assert.equal(testVerdict(plain, { ok: null }), 'unknown')
})
