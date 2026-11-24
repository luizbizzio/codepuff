<div align="center">

<img src="docs/images/banner.png" alt="CodePuff: a coding pet that lives next to your AI agent. Eight pixel-art characters." width="100%">

<br>

[![CI](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml/badge.svg)](https://github.com/luizbizzio/codepuff/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-7253b9.svg)](CHANGELOG.md)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![Languages](https://img.shields.io/badge/languages-14-orange.svg)](docs/FEATURES.md#languages)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-informational.svg)](#privacy)

**[Install](#install)** &nbsp;&middot;&nbsp; **[What you see](#what-you-see)** &nbsp;&middot;&nbsp; **[The pets](#the-pets)** &nbsp;&middot;&nbsp; **[Claude Code and Codex](#claude-code-and-codex)** &nbsp;&middot;&nbsp; **[Privacy](#privacy)** &nbsp;&middot;&nbsp; **[FAQ](#faq)** &nbsp;&middot;&nbsp; **[Docs](#documentation)**

</div>

<br>

An AI agent can work for minutes at a time, and a blinking cursor tells you nothing about it. CodePuff puts a small pixel-art
companion next to your agent that shows **what it is really doing**: reading, searching, typing, running tests, waiting for you,
failing. It celebrates only when a test run really passed, and it keeps a running record of your work across sessions and across
both agents.

<p align="center">
  <img src="docs/images/band.png" alt="The CodePuff band above the Claude Code prompt: the pet, a two day streak, 58 prompts, five hearts, the status, the plan limit and the success ring." width="820">
</p>

<p align="center"><sub>The compact band above the Claude Code prompt (large size, English).</sub></p>

## Why CodePuff

- **Honest.** Every animation comes from a real event. The success dance needs a test run that exited with code 0; the error face needs a tool that really failed. When CodePuff cannot know something, it says so instead of guessing.
- **Alive.** Thinking, reading, searching, editing, testing, delegating: each has its own scene, and long waits keep changing (a glance, a blink, a bright idea, and a quirk of each character), so it never looks frozen.
- **Yours.** Eight characters, ten palettes or your own colors, your own name, quiet sounds, three levels of motion, and 14 languages picked automatically from your computer.
- **Private.** One local folder. No account, no server, no telemetry, no model calls, no network code at all. Only counters are stored: never your prompts, code or paths.
- **Light.** Zero dependencies and nothing to build. Each hook is a tiny process that writes one small file.

## Install

Pick the agent you use. Nothing to build, nothing to configure.

### Claude Code

**No Node.js needed.** Type these two lines inside Claude Code, then start a new session:

\
In the desktop app: **+** next to the prompt, then **Plugins**, then **Add marketplace**. The pet appears above the prompt, and  opens its pane.

### Codex

**Needs [Node.js](https://nodejs.org) 20 or newer** (CodePuff's hooks are small Node programs; Codex users usually have it already). In a terminal:

\
Then trust the hooks once, because Codex never runs new hooks without asking: type  in the CLI, or use **Review hooks** in the desktop app.

Codex has no plugin screen to draw on, so to watch the pet open the terminal app next to it (also needs Node.js 20+):

\[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;231;212;238m▄[0m[38;2;234;210;239m▄[0m[38;2;241;222;240m▄[0m[38;2;246;230;241m▄[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;232;207;240m▀[0m[38;2;218;184;238m▀[0m[38;2;190;159;228m[48;2;218;184;238m▀[0m[38;2;234;211;240m[48;2;228;206;242m▀[0m[38;2;244;226;241m[48;2;220;191;239m▀[0m[38;2;236;213;239m[48;2;230;208;239m▀[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;134;119;173m▄[0m[38;2;241;222;240m▄[0m[38;2;169;142;220m▄[0m[38;2;134;108;183m▄[0m[38;2;229;212;238m[48;2;147;126;188m▀[0m[38;2;246;230;241m[48;2;147;115;195m▀[0m[38;2;228;200;240m[48;2;141;102;201m▀[0m[38;2;219;197;240m[48;2;147;115;207m▀[0m[38;2;205;177;236m[48;2;153;112;211m▀[0m[38;2;180;141;228m[48;2;155;106;210m▀[0m[38;2;209;176;235m▀[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;229;204;238m▄[0m[38;2;238;218;242m[48;2;219;188;237m▀[0m[38;2;244;226;241m[48;2;114;93;168m▀[0m[38;2;171;151;205m[48;2;64;51;124m▀[0m[38;2;94;73;160m[48;2;61;48;120m▀[0m[38;2;68;54;130m[48;2;56;38;107m▀[0m[38;2;61;48;120m[48;2;89;67;141m▀[0m[38;2;59;42;112m[48;2;148;123;200m▀[0m[38;2;57;45;114m[48;2;202;183;234m▀[0m[38;2;50;40;104m[48;2;217;195;237m▀[0m[38;2;50;40;104m[48;2;217;196;236m▀[0m[38;2;59;44;114m[48;2;184;162;211m▀[0m[38;2;68;46;133m[48;2;72;60;116m▀[0m[38;2;105;75;172m[48;2;44;31;90m▀[0m[38;2;59;41;117m▄[0m[38;2;107;72;177m▄[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;115;93;159m▄[0m[38;2;45;27;88m[48;2;187;167;213m▀[0m[38;2;220;188;238m[48;2;196;155;225m▀[0m[38;2;143;105;195m[48;2;59;48;118m▀[0m[38;2;55;45;112m[48;2;57;45;114m▀[0m[38;2;61;47;118m[48;2;65;53;118m▀[0m[38;2;87;66;143m[48;2;197;166;230m▀[0m[38;2;193;165;229m[48;2;222;203;241m▀[0m[38;2;208;180;237m[48;2;223;204;241m▀[0m[38;2;215;191;239m[48;2;223;204;241m▀[0m[38;2;225;204;242m[48;2;225;205;241m▀[0m[38;2;231;208;241m[48;2;228;206;242m▀[0m[38;2;239;217;240m[48;2;229;206;242m▀[0m[38;2;241;222;240m[48;2;229;206;242m▀[0m[38;2;216;192;232m[48;2;229;207;241m▀[0m[38;2;195;171;225m[48;2;235;214;241m▀[0m[38;2;102;83;146m[48;2;239;220;241m▀[0m[38;2;73;52;133m[48;2;143;125;185m▀[0m[38;2;87;59;153m▄[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m[38;2;45;29;90m▄[0m[38;2;197;162;223m[48;2;206;160;229m▀[0m[38;2;196;162;233m[48;2;119;84;179m▀[0m[38;2;127;89;172m[48;2;87;63;143m▀[0m[38;2;50;40;104m[48;2;55;39;106m▀[0m[38;2;50;38;102m[48;2;54;43;110m▀[0m[38;2;141;115;198m[48;2;136;113;190m▀[0m[38;2;213;194;238m[48;2;216;195;239m▀[0m[38;2;222;203;241m[48;2;220;202;241m▀[0m[38;2;222;203;241m[48;2;220;202;241m▀[0m[38;2;222;203;241m[48;2;220;202;241m▀[0m[38;2;221;203;241m[48;2;221;202;241m▀[0m[38;2;223;204;241m[48;2;221;202;241m▀[0m[38;2;223;204;241m[48;2;222;203;241m▀[0m[38;2;223;204;241m[48;2;222;203;241m▀[0m[38;2;223;204;241m[48;2;222;203;241m▀[0m[38;2;223;204;241m[48;2;223;204;241m▀[0m[38;2;226;205;242m[48;2;222;203;241m▀[0m[38;2;235;215;240m[48;2;225;201;241m▀[0m[38;2;114;85;173m[48;2;202;180;222m▀[0m[38;2;100;72;166m▄[0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m[38;2;92;67;142m▄[0m[38;2;110;76;156m[48;2;204;148;226m▀[0m[38;2;119;75;187m[48;2;100;58;177m▀[0m[38;2;89;47;169m[48;2;100;58;177m▀[0m[38;2;89;47;169m[48;2;111;74;186m▀[0m[38;2;125;82;192m[48;2;94;55;172m▀[0m[38;2;66;49;120m[48;2;110;83;172m▀[0m[38;2;72;57;136m[48;2;57;45;114m▀[0m[38;2;194;175;229m[48;2;130;111;184m▀[0m[38;2;220;202;241m[48;2;216;198;240m▀[0m[38;2;220;202;241m[48;2;218;199;241m▀[0m[38;2;180;168;194m[48;2;121;106;140m▀[0m[38;2;81;73;93m[48;2;23;12;39m▀[0m[38;2;171;154;190m[48;2;122;107;140m▀[0m[38;2;219;201;240m[48;2;220;202;241m▀[0m[38;2;220;201;241m[48;2;220;201;241m▀[0m[38;2;220;202;241m[48;2;219;201;240m▀[0m[38;2;180;168;194m[48;2;72;59;89m▀[0m[38;2;81;73;93m[48;2;81;73;93m▀[0m[38;2;229;209;241m[48;2;179;159;191m▀[0m[38;2;246;230;241m[48;2;233;210;241m▀[0m[38;2;57;45;114m[48;2;102;84;163m▀[0m[38;2;116;81;184m[48;2;77;47;154m▀[0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m[38;2;122;87;161m[48;2;118;77;154m▀[0m[38;2;191;127;220m[48;2;149;109;209m▀[0m[38;2;136;114;203m[48;2;124;98;194m▀[0m[38;2;128;105;196m[48;2;141;122;205m▀[0m[38;2;142;124;203m[48;2;120;89;191m▀[0m[38;2;113;78;186m[48;2;105;71;181m▀[0m[38;2;102;62;177m[48;2;79;46;153m▀[0m[38;2;40;31;87m[48;2;38;25;79m▀[0m[38;2;99;88;152m[48;2;95;85;146m▀[0m[38;2;215;197;241m[48;2;213;194;240m▀[0m[38;2;215;197;241m[48;2;218;172;232m▀[0m[38;2;167;150;190m[48;2;219;152;226m▀[0m[38;2;71;58;89m[48;2;217;174;233m▀[0m[38;2;216;198;241m[48;2;215;197;241m▀[0m[38;2;220;202;241m[48;2;167;151;191m▀[0m[38;2;220;202;241m[48;2;122;107;140m▀[0m[38;2;217;199;239m[48;2;72;59;89m▀[0m[38;2;169;152;189m[48;2;72;59;89m▀[0m[38;2;118;103;139m[48;2;166;149;189m▀[0m[38;2;221;195;239m[48;2;216;173;233m▀[0m[38;2;222;193;239m[48;2;217;171;232m▀[0m[38;2;228;209;239m[48;2;221;200;241m▀[0m[38;2;140;116;193m[48;2;228;210;239m▀[0m[38;2;87;73;145m▄[0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m[38;2;139;95;200m[48;2;64;40;122m▀[0m[38;2;89;47;169m[48;2;99;58;174m▀[0m[38;2;89;57;166m[48;2;70;40;153m▀[0m[38;2;70;40;153m[48;2;70;40;153m▀[0m[38;2;70;40;153m[48;2;50;36;108m▀[0m[38;2;48;31;102m[48;2;34;24;75m▀[0m[38;2;30;23;70m[48;2;62;51;114m▀[0m[38;2;148;125;197m[48;2;205;183;237m▀[0m[38;2;214;195;240m[48;2;217;198;240m▀[0m[38;2;211;187;238m[48;2;214;195;240m▀[0m[38;2;216;173;233m[48;2;214;195;240m▀[0m[38;2;215;194;240m[48;2;214;195;240m▀[0m[38;2;215;197;241m[48;2;215;196;240m▀[0m[38;2;215;197;241m[48;2;214;195;240m▀[0m[38;2;215;196;240m[48;2;215;196;240m▀[0m[38;2;214;195;240m[48;2;214;195;240m▀[0m[38;2;214;195;240m[48;2;214;195;240m▀[0m[38;2;214;195;240m[48;2;214;195;240m▀[0m[38;2;214;195;240m[48;2;213;194;239m▀[0m[38;2;213;194;239m[48;2;213;194;239m▀[0m[38;2;216;196;240m[48;2;213;194;239m▀[0m[38;2;221;201;240m[48;2;206;183;237m▀[0m[38;2;223;200;240m[48;2;130;108;162m▀[0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m[38;2;139;97;169m[48;2;219;152;226m▀[0m[38;2;154;104;210m[48;2;162;101;214m▀[0m[38;2;87;61;148m[48;2;154;100;209m▀[0m[38;2;51;38;102m[48;2;134;94;197m▀[0m[38;2;51;40;103m[48;2;142;95;202m▀[0m[38;2;69;52;124m[48;2;172;127;222m▀[0m[38;2;187;161;228m[48;2;204;178;236m▀[0m[38;2;220;201;241m[48;2;215;196;240m▀[0m[38;2;218;199;239m[48;2;216;197;239m▀[0m[38;2;216;197;240m[48;2;212;193;238m▀[0m[38;2;214;195;240m[48;2;197;173;235m▀[0m[38;2;214;195;240m[48;2;195;170;233m▀[0m[38;2;214;195;240m[48;2;210;190;238m▀[0m[38;2;213;194;239m[48;2;212;193;240m▀[0m[38;2;213;194;240m[48;2;212;193;240m▀[0m[38;2;213;194;240m[48;2;214;195;240m▀[0m[38;2;213;194;240m[48;2;200;176;234m▀[0m[38;2;213;194;240m[48;2;207;187;237m▀[0m[38;2;213;194;240m[48;2;195;170;233m▀[0m[38;2;195;170;233m[48;2;166;131;219m▀[0m[38;2;191;164;231m[48;2;179;143;229m▀[0m[38;2;195;161;232m[48;2;135;108;191m▀[0m[38;2;99;77;151m▀[0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m[38;2;109;73;163m▀[0m[38;2;166;108;217m[48;2;111;78;158m▀[0m[38;2;162;101;214m[48;2;166;108;217m▀[0m[38;2;137;97;200m[48;2;162;101;214m▀[0m[38;2;154;100;209m[48;2;147;92;204m▀[0m[38;2;171;123;221m[48;2;137;97;200m▀[0m[38;2;186;148;230m[48;2;155;112;211m▀[0m[38;2;197;173;235m[48;2;171;128;223m▀[0m[38;2;198;176;235m[48;2;167;130;220m▀[0m[38;2;183;143;228m[48;2;137;107;200m▀[0m[38;2;176;150;227m[48;2;181;150;229m▀[0m[38;2;180;147;229m[48;2;190;165;232m▀[0m[38;2;181;150;229m[48;2;198;174;235m▀[0m[38;2;194;167;233m[48;2;169;140;222m▀[0m[38;2;196;170;235m[48;2;166;131;219m▀[0m[38;2;189;162;232m[48;2;171;128;223m▀[0m[38;2;172;132;223m[48;2;147;117;206m▀[0m[38;2;179;138;228m[48;2;179;138;228m▀[0m[38;2;188;161;231m[48;2;207;187;237m▀[0m[38;2;177;156;225m[48;2;220;198;239m▀[0m[38;2;117;89;170m▀[0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m[38;2;70;40;153m▀[0m [0m[38;2;131;87;194m▀[0m[38;2;123;83;189m▀[0m[38;2;112;78;182m▀[0m[38;2;110;77;181m▀[0m[38;2;143;104;203m▀[0m[38;2;174;144;224m[48;2;151;99;208m▀[0m[38;2;199;175;232m[48;2;144;112;205m▀[0m[38;2;203;181;236m[48;2;150;118;209m▀[0m[38;2;187;160;226m▀[0m[38;2;143;108;204m▀[0m[38;2;112;72;185m▀[0m[38;2;137;105;200m▀[0m[38;2;168;125;220m▀[0m[38;2;168;139;219m[48;2;129;95;195m▀[0m[38;2;172;143;223m▀[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
[0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m [0m
### Both at once (optional, needs Node.js 20+)

One command installs CodePuff in whichever of the two it finds, by running the commands above for you:

\Claude Code
  the claude command was not found. In Claude Code, type:
    /plugin marketplace add luizbizzio/codepuff
    /plugin install codepuff@codepuff

Codex
  the codex command was not found. In a terminal where Codex runs, type:
    codex plugin marketplace add luizbizzio/codepuff
    codex plugin add codepuff@codepuff

Check it any time with: npx github:luizbizzio/codepuff doctor
### Check it works (needs Node.js 20+)

\CodePuff doctor
  ok    Node.js — v26.9.0
  ok    data folder — C:UsersLuiz.codepuff
  ok    pet — classic (classic)
  ok    statistics — 1 sessions, 2 files, 6.0 KB
  ok    hook errors — none logged
  ok    git — git version 2.56.1.windows.1
  warn  Codex — CodePuff is not installed in Codex: run "codex plugin marketplace add luizbizzio/codepuff" and then "codex plugin add codepuff@codepuff"
  warn  Claude Code — the CodePuff plugin is not enabled: in Claude Code run "/plugin marketplace add luizbizzio/codepuff" and then "/plugin install codepuff@codepuff"
It reports whether CodePuff is installed in Claude Code and in Codex, and what to do if it is not. Other routes (from a clone), updating, uninstalling and troubleshooting are in [docs/INSTALL.md](docs/INSTALL.md).

## What you see

<p align="center">
  <img src="docs/images/states-a.png" alt="Foxy in twelve states: idle, tired, thinking, reading, searching, investigating, coding, running, git, a connected tool, testing and looking things up." width="860">
</p>
<p align="center">
  <img src="docs/images/states-b.png" alt="Foxy in seven more states: planning, success, error, permission, waiting, finished and disconnected." width="860">
</p>

| The pet shows | When |
| --- | --- |
| A thought cloud, a light bulb, then a turning gear | The agent is working on a response |
| A book with its eyes sweeping the lines, or a magnifier | Reading files, searching the project |
| A laptop with floating code, or a shell with a spinner | Editing code, running a command |
| A commit graph, or a plug sliding into a socket | A git command, a tool from an MCP server |
| Goggles and a bubbling flask | A test run is in flight |
| Sparkles | A test run was confirmed passed, or a commit was made |
| A red badge (Foxy also floats a 404) | Something really failed |
| A yellow badge, hands up | The agent needs you: an approval or a question |
| Confetti, then a happy face | The turn is done and it waits for your next prompt |
| Half-closed eyes and a sweat drop | Your plan's limit is nearly used up |

When subagents run, small helpers appear. With several sessions open, one fixed rule decides which one the pet shows, and the
label always says which agent and which project it is.

### Statistics and customization

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/images/statistics.png" alt="The Statistics page: platform and period buttons, tiles for prompts, tool calls, files, commits, tests and agent time, a success bar, a 14 day chart and what the agent did." width="100%"></td>
    <td width="50%" align="center"><img src="docs/images/customize.png" alt="The Customize page: name, character, colors, settings, sounds, motion, volume and band size." width="100%"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Statistics</b>: a platform, a period, the numbers that matter, and every number one button away.</sub></td>
    <td align="center"><sub><b>Customize</b>: character, colors, sounds, motion, size and language.</sub></td>
  </tr>
</table>

Statistics are counted, never guessed: prompts, turns, tool calls (succeeded and failed), files changed, tests run, commits, lines
added and deleted, agent time, streaks and a daily chart, by **platform** (Claude Code, Codex or both) and **period** (this session,
7 days, 30 days, all time). Round numbers, such as the hundredth task or a seven day streak, get a small celebration, once each.

### Hearts and sounds

The pet has one to five **hearts** for you, kept between sessions. Be kind and it beams; be abusive to the assistant and the hearts
drop and it gets sad. Swearing at a bug is fine, and harsh feedback on the work only makes it flinch. A prompt is read in memory to
tell the difference, then dropped: only a number is kept, and one switch turns the whole thing off.

Short, original **sounds** play when the agent asks you something, when a turn finishes, and when your 5-hour or weekly limit resets.
Each can be changed or silenced, and they start quiet.

### Fourteen languages

Everything CodePuff says is translated and follows your computer's language by itself: English, Portuguese (Brazil), Spanish, French,
German, Italian, Dutch, Polish, Turkish, Russian, Japanese, Korean, Simplified Chinese and Traditional Chinese. Change it in Customize,
with `/codepuff language`, or `codepuff set language`. Details in [docs/FEATURES.md](docs/FEATURES.md#languages).

## The pets

<p align="center">
  <img src="docs/images/characters.png" alt="The eight characters in four moods: idle, coding, success and error." width="300">
</p>

| Character | Personality |
| --- | --- |
| **Classic** (default) | A fluffy code cloud with headphones. Bounces when it is happy. |
| **Alpha** | The original CodePuff: a round, soft puff with a sprout. Waves hello. |
| **Foxy** | A curious explorer with goggles. Sniffs around, and floats a 404 over its head when something fails. |
| **Bot** | A tidy little robot with a screen face. Scans left and right, status light blinking. |
| **Slime** | A glossy, bouncy code slime with a lucky star. Wobbles. |
| **Mage** | A tiny programming wizard with a book of spells. Sparks while it thinks. |
| **Penny** | A deep-sea puffer with curly dark hair. Floats and sways her fin. |
| **Claude** | A boxy orange critter (an unofficial fan design). Shuffles its feet. |

Every character wears any palette, has its own way of idling, thinking and waiting, and every expression the others have.

## Claude Code and Codex

One pet, one set of settings and one history, shared by both. What differs is what each host lets a plugin do:

| | Claude Code | Codex |
| --- | --- | --- |
| Pet and band above the prompt, pane, status line, sounds, toasts | Yes | No: Codex has no plugin screen |
| Terminal app (`codepuff pet`): pet, statistics, customization | Yes | Yes |
| Prompts, turns, tool calls, sessions, time | Yes | Yes |
| Tool results (passed, failed), test results, commits | Yes | Not reported by the Codex build checked, so those calls are counted with an *unknown* outcome |
| Plan limits (the tired pet, reset sounds) | Yes | No |

CodePuff keeps its word here: nothing is shown for Codex that Codex did not report. If a later Codex sends tool completions, they are
used automatically. What was verified on which system is listed in [docs/STATUS.md](docs/STATUS.md).

## Privacy

Everything stays on your computer, in one folder (`~/.codepuff`). No account, no server, no model calls, no telemetry. Only
**counters** are stored: never your prompts, code, commands, file paths or tool output (tested with sentinel strings). The single place
a prompt is read is the hearts: its text is judged in memory, then dropped. Switch that off (*Hearts react to my messages* in
Customize, or `/codepuff mood off`) and nothing is read at all. Export, import, reset or delete your data any time with `codepuff data`.
See [SECURITY.md](SECURITY.md).

## FAQ

**Does it slow my agent down?** No. The hook is a tiny Node process that writes one small file. Measured numbers are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

**Does it send anything anywhere?** No. There is no network code.

**Can I use it with Claude Code and Codex at once?** Yes, that is the point: they share the pet and the statistics. Install it in Codex
one way only (the plugin, or `codepuff install codex`), or every event is counted twice. `codepuff doctor` warns you if you did both.

**The terminal app says "waiting for an agent".** The agent has not run a hook yet. For Codex, trust the hooks (`/hooks`), then send a prompt.

**How do I change the pet?** `/codepuff`, then **Customize**. Or `/codepuff character fox`, or `codepuff set character fox`.

**Is it affiliated with Anthropic or OpenAI?** No. It is an independent project, and "Claude" is an unofficial fan design.

## Documentation

| Page | What it covers |
| --- | --- |
| [Install](docs/INSTALL.md) | Other ways to install, updating, troubleshooting |
| [Features](docs/FEATURES.md) | Every state, surface, setting (with its default), language and statistic, and the commands |
| [Architecture](docs/ARCHITECTURE.md) | How it is built, the data model, concurrency, adding a character |
| [Platforms](docs/PLATFORMS.md) | What Claude Code and Codex expose, and what only one of them can do |
| [Status](docs/STATUS.md) | What was verified where, known limitations, what comes next |
| [Performance](docs/PERFORMANCE.md) | Measured overhead, and how |
| [Development](docs/DEVELOPMENT.md) | Tests, tools, CI, the art and sound pipelines |
| [Changelog](CHANGELOG.md), [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) | Releases, how to help, reporting problems |

## About version 1.0

1.0.0 means the engine, the Claude Code mod, the terminal app and the installers are complete, documented and covered by tests, on
Windows, macOS and Linux in CI. It does not mean everything was verified everywhere: the Claude Code mod has only been run by hand
on Windows, the translations were written by the project rather than by native speakers, and Codex support works within what the
Codex hooks report. [docs/STATUS.md](docs/STATUS.md) lists exactly what was and was not checked.

## Contributing

Bug reports, ideas, translations and new characters are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). A character is pixel art plus
a few lines of description, and a language is one file; the engine does the rest.

## License

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). CodePuff is independent and not affiliated with Anthropic or OpenAI.
Alpha is drawn in code, "Claude" is an unofficial fan design, and the six other characters are pixel-art conversions of images the
project owner created with an AI image generator (see [NOTICE](NOTICE)).

<p align="center"><sub>Made by <a href="https://github.com/luizbizzio">Luiz Bizzio</a>.</sub></p>
