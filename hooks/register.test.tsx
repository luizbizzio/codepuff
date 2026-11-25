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

function world(on: any, lang = 'en_US.UTF-8') {
  const files = new Map<string, string>()
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { CODEPUFF_HOME: '/data/codepuff', LANG: lang })
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
    expect(shown.includes('Classic')).toBe(true)
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
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ plugin: 'codepuff', key: 'tab-stats' })
  await clock.advance(400)
  // Platform first (Claude Code, the host, then Codex, then Combined), then the period; the long list is behind a button.
  const texts = async () => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(await texts()).toEqual(expect.arrayContaining(['Platform', 'Period', 'Prompts', 'Tool calls', 'Last 14 days']))
  const labels = async () => (await ui.findAll({ type: 'Button' })).map((x: any) => x.text ?? x.label)
  const first = await labels()
  expect(first.indexOf('Claude Code')).toBeLessThan(first.indexOf('Codex'))
  expect(first.indexOf('Codex')).toBeLessThan(first.indexOf('Combined'))
  expect(first).toEqual(expect.arrayContaining(['This session', '7 days', '30 days', 'All time']))
  expect(await ui.find({ type: 'Text', text: 'Prompts submitted' })).toBeFalsy()
  await ui.press({ plugin: 'codepuff', key: 'details' })
  await clock.advance(400)
  expect(await ui.find({ type: 'Text', text: 'Prompts submitted' })).toBeTruthy()
  // On another platform there is no "this session".
  await ui.press({ plugin: 'codepuff', key: 'agent-codex' })
  await clock.advance(400)
  expect(await labels()).not.toContain('This session')
  await ui.press({ plugin: 'codepuff', key: 'agent-all' })
  await clock.advance(400)
  expect(await labels()).not.toContain('This session')
  await ui.press({ plugin: 'codepuff', key: 'agent-claude' })
  await clock.advance(400)
  expect(await labels()).toContain('This session')

  // The four tabs are just an emoji each (so they fit on one line, in any language), and each page is titled with its name.
  expect(await labels()).toEqual(expect.arrayContaining(['📊', '🎨', '🏆', '⚙️']))
  expect(await labels()).not.toContain('📊 Statistics')
  expect(await texts()).toContain('📊 Statistics')
  // Achievements are a tab of their own (not part of the statistics), each one a badge.
  expect(await texts()).not.toContain('Achievements')
  await ui.press({ plugin: 'codepuff', key: 'tab-achievements' })
  await clock.advance(400)
  expect((await ui.findAll({ type: 'Text' })).some((x: any) => String(x.text).startsWith('🏆 Achievements'))).toBe(true)
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(11) // one badge for each thing that is counted, which levels up
  expect(await ui.find({ type: 'Text', text: 'Tasks together' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: '100 tasks done together!' })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: 'Platform' })).toBeFalsy()

  await ui.press({ plugin: 'codepuff', key: 'tab-look' })
  await clock.advance(400)
  await ui.press({ plugin: 'codepuff', key: 'char-claude' })
  await clock.advance(400)
  await ui.input({ plugin: 'codepuff', key: 'name', text: 'Biscuit', kind: 'submit' })
  await clock.advance(400)
  // Customize is the pet's looks (no settings, no Restore button), and there is no Pet tab; the settings are a tab of their own.
  const customize = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(customize).toEqual(expect.arrayContaining(['Character', 'Colors', 'Accessory', 'Band Frame']))
  expect(await ui.find({ type: 'Button', text: 'Compact band: on' })).toBeFalsy()
  expect(await ui.find({ type: 'Button', text: 'Status line: on' })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: 'Language' })).toBeFalsy()
  expect(await ui.find({ type: 'Button', text: 'Restore default appearance' })).toBeFalsy()
  expect(await ui.find({ type: 'Button', text: 'Pet' })).toBeFalsy()
  await ui.press({ plugin: 'codepuff', key: 'tab-settings' })
  await clock.advance(400)
  expect(await ui.find({ type: 'Button', text: 'Compact band: on' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Status line: on' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Language' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Character' })).toBeFalsy()
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
    // No name; the activity, with the streak and this session's prompts under it.
    expect(shown.some((t: string) => String(t).includes('Classic'))).toBe(false)
    expect(shown.some((t: string) => /🔥 [0-9]+ days?\s+·\s+💬 1 prompt/.test(String(t)))).toBe(true)
    // On the right: how the session's tasks went (a ring on the desktop, counts everywhere).
    expect(shown.some((x: string) => String(x).includes('✔ 1'))).toBe(true)
    expect(shown.some((x: string) => String(x).includes('✖ 0'))).toBe(true)
    // The hearts, under the status block: how much the pet likes the user (drawn as a picture where there are pictures, hearts of text elsewhere).
    if (surface === 'terminal') expect(shown.some((t: string) => String(t).includes('♥♥♥♥♥'))).toBe(true)
    else expect((await ui.findAll({ type: 'Svg' })).some((s: any) => JSON.stringify(s).includes('5 of 5 hearts'))).toBe(true)
    expect(await ui.find({ type: 'Button', text: 'Open' })).toBeFalsy()
    expect(await ui.find({ type: 'Button', text: 'Hide' })).toBeFalsy()
    await ui.press({ plugin: 'codepuff', key: 'pet-it' })
    await clock.advance(400)
    expect((await texts()).some((t: string) => String(t).includes('Happy to see you'))).toBe(true)
    await clock.advance(1200)
    await ui.unmount()
  }
})

test('a sound is played when the agent asks something and when a turn ends well', async ($: any, on: any) => {
  const { clock } = world(on)
  const calls: string[] = []
  on('audio.play', (_: any, e: any) => { calls.push(JSON.stringify(e)); return { value: undefined } })
  on('turn.complete', () => ({ text: 'done' }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 'p1' })
  await clock.advance(500)
  expect(calls.some(c => c.includes('pop'))).toBe(true)
  calls.length = 0
  await clock.advance(5000)
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(500)
  expect(calls.some(c => c.includes('tada'))).toBe(true)
})

test('Settings and Customize: the sound, volume, band size and mood buttons save what they say, and what can be earned is listed with a padlock', async ($: any, on: any) => {
  const { files, clock } = world(on)
  on('audio.play', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ plugin: 'codepuff', key: 'tab-settings' })
  await clock.advance(400)
  for (const key of ['q-bell', 'f-off', 'r5-pop', 'rw-off', 'v-low', 'band-large', 'mood', 'breaks-120', 'rest-20', 'motion-full', 'motion-reduced']) {
    await ui.press({ plugin: 'codepuff', key })
    await clock.advance(400)
  }
  const prefs = JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs
  expect(prefs.sounds).toMatchObject({ question: 'bell', finish: 'off' })
  expect(prefs.sounds).toMatchObject({ reset5h: 'pop', resetWeek: 'off' })
  expect(prefs.volume).toBe('low')
  expect(prefs.bandSize).toBe('large')
  expect(prefs.mood).toBe(false)
  expect(prefs.breakEvery).toBe(120)
  expect(prefs.breakRest).toBe(20)
  // The arrows move it by a quarter of an hour.
  await ui.press({ plugin: 'codepuff', key: 'breaks-plus' })
  await clock.advance(400)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.breakEvery).toBe(135)
  await ui.press({ plugin: 'codepuff', key: 'breaks-minus' })
  await clock.advance(400)
  await ui.press({ plugin: 'codepuff', key: 'breaks-minus' })
  await clock.advance(400)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.breakEvery).toBe(105)
  expect(await ui.find({ type: 'Button', text: '30 min' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: '2h' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Motion' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Hearts: off' })).toBeTruthy()
  expect(prefs.motion).toBe('reduced')
  await ui.press({ plugin: 'codepuff', key: 'tab-look' })
  await clock.advance(400)
  // Every accessory is listed; the ones not earned yet are dim buttons with a padlock that do nothing.
  expect(await ui.find({ type: 'Button', text: '🔒 Crown' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: '🔒 Flower' })).toBeTruthy()
  // The palettes that are rewards and the card frames are listed the same way; the free palettes work as before.
  expect(await ui.find({ type: 'Button', text: '🔒 Sunset' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: '🔒 Rainbow' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Mint' })).toBeTruthy()
  await ui.press({ plugin: 'codepuff', key: 'acc-crown' })
  await clock.advance(400)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.accessory).toBe('none')
  expect(await ui.find({ type: 'Text', text: 'Accessory' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: '📸' })).toBeTruthy()
  expect((await ui.findAll({ type: 'Text' })).map((x: any) => x.text)).toContain('🎨 Customize')
  // Pressing it saves the card, and the pane says where.
  expect([...files.keys()].some(key => /\/cards\//.test(key))).toBe(false)
  await ui.press({ plugin: 'codepuff', key: 'card' })
  await clock.advance(800)
  const card = [...files.keys()].find(key => /\/cards\/codepuff-.*\.svg$/.test(key))
  expect(card).toBeTruthy()
  expect(String(files.get(card!)).startsWith('<svg')).toBe(true)
  // (and a message says where; the card button is the same on every tab)
  expect(await ui.find({ type: 'Button', text: '🔒 Gold' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Band Frame' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Save pet card' })).toBeFalsy() // (the card button is in the tab bar, as an emoji)
  await ui.unmount()
})

test('the compact band fits each size: the same things are there, laid out to fit the pet, and the status can still be pressed', async ($: any, on: any) => {
  const { files, clock } = world(on)
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'x' })
  await clock.advance(500)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ plugin: 'codepuff', key: 'tab-settings' })
  await clock.advance(400)
  for (const size of ['small', 'medium', 'large']) {
    await pane.press({ plugin: 'codepuff', key: 'band-' + size })
    await clock.advance(400)
    expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.bandSize).toBe(size)
    const band = await $.ui.mount({ plugin: 'codepuff', component: 'AbovePrompt', requestId: 'band-' + size, props: { hasSurvey: false }, surface: 'desktop' })
    const texts = [...(await band.findAll({ type: 'Text' })), ...(await band.findAll({ type: 'Button' }))].map((x: any) => String(x.text ?? x.label))
    expect(texts.some((x: string) => /🔥 [0-9]+ days?\s+·\s+💬 1 prompt/.test(x))).toBe(true)
    expect(texts.some((x: string) => x.includes('✔ 0') || x.includes('✔ 1'))).toBe(true)
    expect(await band.find({ type: 'Button', key: 'pet-it' })).toBeTruthy()
    await band.press({ plugin: 'codepuff', key: 'pet-it' })
    await band.unmount()
  }
  await pane.unmount()
})

test('plan limits: the band draws both bars by default, or only once half a window is used when Settings says so', async ($: any, on: any) => {
  const { files, clock } = world(on)
  on('audio.play', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: 'five_hour', percentUsed: 12 }, { kind: 'seven_day', percentUsed: 3 }] } }))
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const bandTexts = async () => {
    const band = await $.ui.mount({ plugin: 'codepuff', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false }, surface: 'terminal' })
    const texts = [...(await band.findAll({ type: 'Text' })), ...(await band.findAll({ type: 'Button' }))].map((t: any) => String(t.text ?? t.label))
    await band.unmount()
    return texts
  }
  // By default both windows are shown, however little of them is used.
  const first = await bandTexts()
  expect(first.some((t: string) => /12%/.test(t))).toBe(true)
  expect(first.some((t: string) => /\b3%/.test(t))).toBe(true)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ plugin: 'codepuff', key: 'tab-settings' })
  await clock.advance(400)
  // Only once half a window is used: nothing at 12% and 3%.
  await pane.press({ plugin: 'codepuff', key: 'plan-auto' })
  await clock.advance(400)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.plan).toBe('auto')
  expect((await bandTexts()).some((t: string) => /12%/.test(t))).toBe(false)
  await pane.press({ plugin: 'codepuff', key: 'plan-always' })
  await clock.advance(400)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.plan).toBe('always')
  const shown = await bandTexts()
  expect(shown.some((t: string) => /12%/.test(t))).toBe(true)
  expect(shown.some((t: string) => /3%/.test(t))).toBe(true)

  // One window only (always), or none.
  await pane.press({ plugin: 'codepuff', key: 'plan-five_hour' })
  await clock.advance(400)
  let only = await bandTexts()
  expect(only.some((t: string) => /12%/.test(t))).toBe(true)
  expect(only.some((t: string) => /\b3%/.test(t))).toBe(false)
  await pane.press({ plugin: 'codepuff', key: 'plan-seven_day' })
  await clock.advance(400)
  only = await bandTexts()
  expect(only.some((t: string) => /\b3%/.test(t))).toBe(true)
  expect(only.some((t: string) => /12%/.test(t))).toBe(false)
  await pane.press({ plugin: 'codepuff', key: 'plan-off' })
  await clock.advance(400)
  only = await bandTexts()
  expect(only.some((t: string) => /\b3%|12%/.test(t))).toBe(false)
  expect(only.some((t: string) => /No plan limit/.test(t))).toBe(false)
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.plan).toBe('off')

  await pane.press({ plugin: 'codepuff', key: 'plan-auto' })
  await clock.advance(400)
  expect((await bandTexts()).some((t: string) => /12%/.test(t))).toBe(false)
  await pane.unmount()
})

test('another agent\'s activity shows up once the pane is looked at, even if nobody looked at the start', async ($: any, on: any) => {
  const { files, clock } = world(on)
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await clock.advance(5 * 60_000) // the pane is not drawn: the refresh loop has stopped by now
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  files.set('/data/codepuff/sessions/codex/other.json', JSON.stringify({ v: 1, agent: 'codex', sid: 'other', started: now, last: now, ended: 0, resumes: 0, proj: [], pname: 'proj', days: { [day]: { pr: 7 } }, git: [], fset: { d: '', h: [] }, seen: [], live: {} }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ plugin: 'codepuff', key: 'agent-codex' })
  await ui.press({ plugin: 'codepuff', key: 'scope-all' })
  await clock.advance(12_000)
  const shown = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(shown).toContain('7')
  await ui.unmount()
})

test('the pane speaks the language of the system, and the Language buttons switch it and save the choice', async ($: any, on: any) => {
  const { files, clock } = world(on, 'pt_BR.UTF-8')
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await clock.advance(400)
  const texts = async () => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
  expect(await texts()).toEqual(expect.arrayContaining(['Plataforma', 'Período', 'Últimos 14 dias']))
  expect(await ui.find({ type: 'Button', text: 'Esta sessão' })).toBeTruthy()
  await ui.press({ plugin: 'codepuff', key: 'tab-look' })
  await clock.advance(400)
  expect(await texts()).toEqual(expect.arrayContaining(['Personagem', 'Cores', 'Acessório']))
  await ui.press({ plugin: 'codepuff', key: 'tab-settings' })
  await clock.advance(400)
  expect(await texts()).toContain('Idioma')
  expect(await texts()).toContain('⚙️ Configurações')
  expect(await ui.find({ type: 'Button', text: 'Faixa compacta: ligada' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'Automático' })).toBeTruthy()
  await ui.press({ plugin: 'codepuff', key: 'lang-ja' })
  await clock.advance(400)
  expect(await texts()).toContain('言語')
  expect(JSON.parse(String(files.get('/data/codepuff/pet.json'))).prefs.language).toBe('ja')
  await ui.press({ plugin: 'codepuff', key: 'lang-auto' })
  await clock.advance(400)
  expect(await texts()).toContain('Idioma')
  await ui.unmount()
})
