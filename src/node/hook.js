// The command-hook entry point. Codex (and any Claude-style command hook) starts this process per event
// and pipes the event JSON to stdin. The handler's whole job: normalize, record, and answer `{}`.
//
// It must never block, delay or break the agent: every failure is swallowed (and noted in errors.log),
// it never writes a decision, and it answers with an empty JSON object, which every host reads as
// "no opinion". It makes no network request and calls no model.

import { appendFileSync, mkdirSync, statSync, truncateSync } from 'node:fs'
import { dirname } from 'node:path'
import { openStore } from './store.js'
import { readHeadCommit } from './git.js'
import { normalizeHook } from '../core/normalize.js'
import { dayKey } from '../core/days.js'
import { felt, judge } from '../core/mood.js'

/**
 * @param {'claude' | 'codex'} agent
 * @param {string} text the hook payload (JSON)
 */
export function handleHook(agent, text, { store = openStore(), now = Date.now(), readCommit = readHeadCommit } = {}) {
  // Windows PowerShell 5.1 puts a byte-order mark in front of piped text (sometimes mis-decoded); hosts do not.
  const payload = JSON.parse(String(text).replace(/^(?:﻿|ï»¿)+/, ''))
  const ev = normalizeHook(agent, payload, now)
  if (!ev) return { applied: false }
  const pet = store.ensurePet(now)
  // How the user's message felt (see mood.js): the text is judged here and dropped; only the affection number is kept.
  if (ev.kind === 'prompt' && pet.prefs.mood) {
    const affection = felt(pet.affection, judge(payload.prompt), dayKey(now), now)
    if (affection !== pet.affection) store.writePet({ ...pet, affection })
  }
  store.applyEvent(ev)
  let commit
  if (ev.commit && ev.cwd) {
    commit = readCommit(ev.cwd, now)
    if (commit) store.applyEvent({ kind: 'commit', agent, session: ev.session, at: now, hash: commit.hash, added: commit.added, removed: commit.removed, files: commit.files, committedAt: commit.committedAt })
  }
  return { applied: true, kind: ev.kind, commit: commit?.hash }
}

function note(store, error) {
  try {
    const file = store.paths.errors
    mkdirSync(dirname(file), { recursive: true })
    try { if (statSync(file).size > 64 * 1024) truncateSync(file, 0) } catch { /* new file */ }
    // A parse error's message quotes the start of the input, which could be a prompt: log the kind of failure only.
    const what = error instanceof SyntaxError ? 'SyntaxError: the hook input was not valid JSON' : String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')
    appendFileSync(file, new Date().toISOString() + ' ' + what + '\n')
  } catch { /* nothing more can be done, and nothing must propagate */ }
}

/** Reads stdin, handles the hook, prints `{}`, and always exits cleanly. */
export async function runHookProcess(agent) {
  const store = openStore()
  try {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    handleHook(agent, Buffer.concat(chunks).toString('utf8'), { store })
  } catch (error) {
    note(store, error)
  }
  process.stdout.write('{}\n')
  process.exit(0)
}
