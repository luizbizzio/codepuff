// Engine-level test: runs the mod against Claude Code's own test kit (`claude plugin test .`).
// It raises the host's real hook events, lets the mod persist through a fake file system, and mounts the pane
// on every surface to check what a person would see.
import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'codepuff',
  component: 'Pane',
  requestId: 'codepuff',
  props: { title: 'CodePuff', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const
// The small pet shown beside the chat: its picture, its name and what it is doing.
const WIDGET = { ...PANE, props: { ...PANE.props, placement: 'widget' } } as const

function world(on: any) {
  const files = new Map<string, string>()
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { CODEPUFF_HOME: '/data/codepuff' })
  on('session.id', () => ({ value: 'chat-1' }))
  on('command.register', () => ({ value: { command: 'codepuff' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  // The engine resolves paths for the platform it runs on (C:\data\... on Windows); the fake keeps one spelling.
  const norm = (path: string) => String(path).replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
  on('fs.read', (_: any, e: any) => {
    const text = files.get(norm(e.path))
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', (_: any, e: any) => { files.set(norm(e.path), e.text); return { value: undefined } })
  on('fs.list', (_: any, e: any) => {
    const base = norm(e.path).replace(/\/$/, '') + '/'
    const out = [...files.entries()].filter(([k]) => k.startsWith(base) && !k.slice(base.length).includes('/')).map(([k, v]) => ({ name: k.slice(base.length), kind: 'file', size: v.length, mtimeMs: v.length, isLink: false }))
    return out.length ? { value: out } : { deny: 'ENOENT' }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  // Beneath the plugins the host has no opinion on any of these.
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostToolUse', () => ({}))
  on('classic.PostToolUseFailure', () => ({}))
  on('classic.PermissionRequest', () => ({}))
  on('session.end', (_: any, e: any) => ({ sessionId: e.sessionId ?? 'chat-1' }))
  return { files, clock }
}

test('the pet follows real agent events and draws on every surface', async ($: any, on: any) => {
  const { files, clock } = world(on)
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  await $.classic.UserPromptSubmit({ prompt: 'a prompt that must never be stored' })
  await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 't1', tool_response: { stdout: 'ok' } })
  await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/work/app/a.js' }, tool_use_id: 't2', tool_response: {} })
  await clock.advance(1000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...WIDGET, surface })
    const shown = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
    expect(shown.includes('Alpha')).toBe(true)
    expect(shown.some((t: string) => /Tests passed|Working on a response|Editing code/.test(t))).toBe(true)
    await ui.unmount()
  }

  // Counters were persisted in the shared layout, and nothing from the prompt was.
  await $.session.end({ reason: 'other' })
  const saved = files.get('/data/codepuff/sessions/claude/chat-1.json')
  expect(saved).toBeTruthy()
  expect(String(saved).includes('must never be stored')).toBe(false)
  expect(files.has('/data/codepuff/pet.json')).toBe(true)
})

test('the statistics tab shows the current session, and the pane can be customized', async ($: any, on: any) => {
  const { clock } = world(on)
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ plugin: 'codepuff', key: 'tab-stats' })
  await clock.advance(400)
  expect(await ui.find({ type: 'Text', text: 'Prompts submitted' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'This session' })).toBeTruthy()

  await ui.press({ plugin: 'codepuff', key: 'tab-look' })
  await clock.advance(400)
  await ui.press({ plugin: 'codepuff', key: 'char-claude' })
  await clock.advance(400)
  await ui.input({ plugin: 'codepuff', key: 'name', text: 'Biscuit', kind: 'submit' })
  await clock.advance(400)
  // Customize has Settings under Colors (no Restore button), and there is no Pet tab.
  const customize = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(customize).toContain('Settings')
  expect(await ui.find({ type: 'Button', text: 'Compact band: on' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Status line: off' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Restore default appearance' })).toBeFalsy()
  expect(await ui.find({ type: 'Button', text: 'Pet' })).toBeFalsy()
  await ui.press({ plugin: 'codepuff', key: 'tab-stats' })
  await clock.advance(400)
  expect((await ui.findAll({ type: 'Text' })).some((x: any) => String(x.text).includes('Biscuit'))).toBe(true)
  await ui.unmount()
})

test('a failed tool and a permission request are shown, and the hooks never alter the host', async ($: any, on: any) => {
  const { clock } = world(on)
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })
  await $.classic.PostToolUseFailure({ tool_name: 'Bash', tool_input: { command: 'node broken.js' }, tool_use_id: 'f1', error: 'Exit code 1\nboom' })
  await clock.advance(300)
  let ui = await $.ui.mount({ ...WIDGET, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'A tool failed' })).toBeTruthy()
  await ui.unmount()

  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  await clock.advance(300)
  ui = await $.ui.mount({ ...WIDGET, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Waiting for permission' })).toBeTruthy()
  await ui.unmount()
})

test('the compact band shows the pet and what it is doing; pressing the activity pets it', async ($: any, on: any) => {
  const { clock } = world(on)
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })
  await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/work/app/a.js' }, tool_use_id: 'b1', tool_response: {} })
  await clock.advance(500)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'codepuff', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false }, surface })
    const texts = async () => [...(await ui.findAll({ type: 'Text' })), ...(await ui.findAll({ type: 'Button' }))].map((t: any) => t.text ?? t.label)
    const shown = await texts()
    expect(shown.length).toBeGreaterThan(0)
    // No name and no numbers: just the activity.
    expect(shown.some((t: string) => String(t).includes('Alpha') || /prompt|tools|streak/.test(String(t)))).toBe(false)
    // On the right: how the session's tasks went (a pie on the desktop, counts everywhere).
    expect(shown.some((x: string) => String(x).includes('✔ 1'))).toBe(true)
    expect(shown.some((x: string) => String(x).includes('✖ 0'))).toBe(true)
    expect(await ui.find({ type: 'Button', text: 'Open' })).toBeFalsy()
    expect(await ui.find({ type: 'Button', text: 'Hide' })).toBeFalsy()
    await ui.press({ plugin: 'codepuff', key: 'pet-it' })
    await clock.advance(400)
    expect((await texts()).some((t: string) => String(t).includes('Happy to see you'))).toBe(true)
    await clock.advance(1200)
    await ui.unmount()
  }
})
