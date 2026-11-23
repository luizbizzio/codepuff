# Performance

Everything here was **measured** with `node scripts/bench.mjs` (and, where stated, the OS's own process counters) on
one machine. Nothing is estimated or extrapolated; where a figure was not measured it says so. Run the script on
your machine for your numbers. The benchmark was run several times: figures that moved with the machine's load are
given as a range.

Machine: Intel Core Ultra 9 285H (16 cores), 31 GB RAM, Windows 11, Node 26.9.0.

## Design choices that keep it light

* No LLM calls, no network, no telemetry, no web server, nothing added to the model's context.
* No polling when idle. The Claude mod does work only when the host raises an event; the terminal animation sets one
  timer at a time, for the moment the next frame is due, and only while it is drawn; with reduced motion there are no
  frame timers at all.
* The desktop picture is an SVG animated by CSS: the host animates it, we do not redraw per frame. Bodies are painted
  once per pose and cached, so animation frames that only change the face cost almost nothing.
* Storage per session is a single small file that does not grow with the number of tool calls (counters are per day).
* No repository scans: git is run once per *observed successful commit* (one `git show HEAD`, 4 s timeout).

## Measured

| What | Result |
| --- | --- |
| Engine: one hook payload normalized and applied, in memory | **3.4 to 5.7 microseconds** (100,000 events) |
| Claude mod: `observe` (what a hook costs inside Claude Code) | **0.005 ms** median (2,000 events) |
| Claude mod: build the view model for the pane and band | 0.2 to 0.4 ms median |
| Claude mod: write the session record (flush, fake host fs) | about 0.2 ms; the record is 783 bytes |
| Codex hook: apply one event to disk (lock + read + reduce + atomic write) | **2.3 to 5.3 ms** median, up to 7.5 ms p95 |
| Codex hook: whole process wall time (spawn node, import, apply, answer `{}`) | **100 to 170 ms** median; a bare `node -e ""` was 65 to 106 ms in the same runs, so CodePuff adds about **35 to 60 ms** per hook event |
| Codex hook: memory of the process | 47 MB RSS (a bare node process is 42 MB: +5 MB), 6 MB heap |
| Read and add up 500 sessions (what the terminal app does each second) | 67 to 118 ms cold; **23 to 35 ms warm** (files unchanged: only `stat` calls); statistics 0.5 ms; priority rule 0.03 ms |
| Hi-res pet picture as SVG (72x56 scene, 8 characters, 2 styles) | 3 to 5 ms median; 25 to 36 KB per animated picture (the host's limit is 131 KB); 4 KB with reduced motion |
| Terminal frame (hi-res, shrunk to fit) / ANSI | 0.5 to 0.7 ms / 0.5 to 0.7 ms per frame |
| Storage | 419 bytes per session on average over 500 sessions (205 KB for 500); a session that ran 500 tool calls: 725 bytes |

The art got twice the resolution in this version; the per-frame costs above were measured after that change.

## What the Codex numbers mean

Codex starts one process per hook event. Most of the time is Node's own start-up, which CodePuff cannot remove. That is
why CodePuff's hooks are marked `async` for everything except end-of-turn events: Codex does not wait for them
(verified to be accepted and run by Codex 0.171; see STATUS.md), so the cost is CPU in the background, not latency in
the agent. With synchronous hooks each event would add about 0.1 s.

## Not measured

* CPU use of the terminal app as a percentage. Only its per-operation costs are known: a frame about 0.5 ms and a
  once-a-second refresh of 23 to 35 ms for 500 sessions (far less with the handful of sessions typical for one person).
* CPU and memory of the Claude Code pane and band inside a live Claude Code session.
* macOS and Linux.
* Real-Codex per-event latency (only the isolated hook process was timed).
