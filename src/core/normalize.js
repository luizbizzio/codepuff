// Host hook payloads -> CodePuff events.
//
// Claude Code and OpenAI Codex both deliver hook payloads with Claude-style names
// (`hook_event_name`, `session_id`, `tool_name`, `tool_input`, `tool_response`, ...). The Claude Code
// adapter feeds the payloads of its `classic.*` events here; the Codex adapter feeds the JSON a command
// hook receives on stdin. Differences between the hosts are handled in one place, below.
//
// The output is a small event with *no content*: no prompt text, no command text, no paths, no output.
// What survives is a category, an activity, an outcome, opaque ids and the project's folder name.

import { classifyTool, outcomeOf, testVerdict } from './classify.js'
import { pathId, sessionKey } from './hash.js'


const DENIED = /(?:user|you) (?:doesn't|does not|did not|rejected|denied|declined|refused|chose not)|permission (?:to use .* )?(?:has been )?denied|was rejected|tool use was rejected/i

const baseName = path => String(path ?? '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
const clip = (text, max) => String(text).replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, max)

/**
 * @param {'claude' | 'codex'} agent
 * @param {Record<string, any>} payload a host hook payload
 * @param {number} at the time it was observed (epoch ms)
 * @returns {object | undefined} an event, or undefined when the payload means nothing to CodePuff
 */
export function normalizeHook(agent, payload, at) {
  if (!payload || typeof payload !== 'object') return undefined
  const name = String(payload.hook_event_name ?? '')
  const session = sessionKey(payload.session_id)
  if (!payload.session_id) return undefined
  const cwd = typeof payload.cwd === 'string' ? payload.cwd : ''
  const event = {
    agent,
    session,
    at,
    cwd,
    project: cwd ? pathId(cwd) : undefined,
    projectName: cwd ? clip(baseName(cwd), 40) : undefined,
    // A hook that fires inside a subagent carries the subagent's id: its prompts and turns are not the user's.
    sub: typeof payload.agent_id === 'string' && payload.agent_id !== '',
  }

  switch (name) {
    case 'SessionStart':
      return { ...event, kind: 'start', source: ['startup', 'resume', 'clear', 'compact', 'fork'].includes(payload.source) ? payload.source : 'startup' }
    case 'SessionEnd':
      return { ...event, kind: 'end' }
    case 'UserPromptSubmit':
      return event.sub ? undefined : { ...event, kind: 'prompt' }
    case 'TurnStart':
      return event.sub ? undefined : { ...event, kind: 'turn_start' }
    case 'Stop':
      return event.sub ? undefined : { ...event, kind: 'turn_end', reason: 'done' }
    case 'StopFailure':
      return event.sub ? undefined : { ...event, kind: 'turn_end', reason: 'error' }
    case 'Interrupt':
      return event.sub ? undefined : { ...event, kind: 'turn_end', reason: 'aborted' }
    case 'PermissionRequest':
      return { ...event, kind: 'perm' }
    case 'PermissionDenied':
      return { ...event, kind: 'denied', id: id(payload) }
    case 'SubagentStart':
      return { ...event, kind: 'sub_start', sub: false, agentId: clip(payload.agent_id ?? '', 64) }
    case 'SubagentStop':
      return { ...event, kind: 'sub_stop', sub: false, agentId: clip(payload.agent_id ?? '', 64) }
    case 'PreModelRequest':
      return event.sub || (payload.kind && payload.kind !== 'sampling') ? undefined : { ...event, kind: 'think', on: true }
    case 'PostModelRequest':
      if (event.sub || (payload.kind && payload.kind !== 'sampling')) return undefined
      // A request that really failed (for example an exhausted usage limit) is a real failure worth showing. The
      // error text itself is never read or kept.
      return payload.status === 'failed' ? { ...event, kind: 'model_failed' } : { ...event, kind: 'think', on: false }
    case 'PreToolUse': {
      const info = classifyTool(payload.tool_name, payload.tool_input)
      return { ...event, kind: 'tool_start', id: id(payload), cat: info.cat, act: info.act }
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const info = classifyTool(payload.tool_name, payload.tool_input)
      // Claude Code runs PostToolUse for successes and PostToolUseFailure for failures. Codex runs
      // PostToolUse for both, so its outcome has to be read from the result.
      const hostSays = agent === 'claude' ? (name === 'PostToolUse' ? 'success' : 'failure') : undefined
      // A call the user interrupted or refused is not the tool failing.
      if (name === 'PostToolUseFailure' && (payload.is_interrupt === true || DENIED.test(String(payload.error ?? '').slice(0, 300)))) {
        return { ...event, kind: 'tool_end', id: id(payload), cat: info.cat, act: info.act, ok: null, soft: false, interrupted: true, test: info.test ? 'unknown' : undefined, commit: false, files: [] }
      }
      const outcome = outcomeOf(info, { hostSays, response: payload.tool_response, error: name === 'PostToolUseFailure' ? payload.error : undefined })
      return {
        ...event,
        kind: 'tool_end',
        id: id(payload),
        cat: info.cat,
        act: info.act,
        ok: outcome.ok,
        soft: outcome.soft === true,
        interrupted: outcome.interrupted === true,
        test: info.test ? testVerdict(info, outcome) : undefined,
        commit: info.commit === true && outcome.ok === true,
        files: info.files,
      }
    }
    default:
      return undefined
  }
}

function id(payload) {
  const raw = payload.tool_use_id ?? payload.call_id
  return typeof raw === 'string' && raw ? clip(raw, 80) : undefined
}
