# Slime

<p align="center"><img src="../images/states/slime/idle.svg" alt="Slime" height="200"></p>

A glossy, bouncy code slime with a lucky star.

[All characters](../../README.md#what-you-see) · [Features](../FEATURES.md)

## Every animation

All the pictures are animated. Each one shows when it appears, for Slime and for every other character: the states follow what the agent really does (and, when nothing is happening, how long it has been quiet), and the last ones are reactions: to you, and to the clock.

| Picture | Animation | When it appears |
| --- | --- | --- |
| <img src="../images/states/slime/idle.svg" alt="Idle" width="120"> | **Idle** | Nothing is happening: the agent is not working. |
| <img src="../images/states/slime/bored.svg" alt="Bored" width="120"> | **Bored** | Nothing has happened for about five minutes: it looks around, yawns, taps a foot. |
| <img src="../images/states/slime/coffee.svg" alt="Coffee break" width="120"> | **Coffee break** | Nothing has happened for about ten minutes: it has a coffee, steam rising. |
| <img src="../images/states/slime/sleeping.svg" alt="Napping" width="120"> | **Napping** | Nothing has happened for a quarter of an hour: it takes a nap. |
| <img src="../images/states/slime/thinking.svg" alt="Thinking" width="120"> | **Thinking** | The agent is working on a response and no tool call is in flight. |
| <img src="../images/states/slime/reading.svg" alt="Reading" width="120"> | **Reading** | The agent is reading files. |
| <img src="../images/states/slime/searching.svg" alt="Searching" width="120"> | **Searching** | The agent is searching the project. |
| <img src="../images/states/slime/investigating.svg" alt="Investigating" width="120"> | **Investigating** | The agent reads or searches right after something failed: it is looking into the failure. |
| <img src="../images/states/slime/coding.svg" alt="Coding" width="120"> | **Coding** | The agent is editing code. |
| <img src="../images/states/slime/running.svg" alt="Running" width="120"> | **Running** | A command is running. |
| <img src="../images/states/slime/git.svg" alt="Git" width="120"> | **Git** | A git command: a commit, a branch, a push. |
| <img src="../images/states/slime/mcp.svg" alt="Connected tool" width="120"> | **Connected tool** | A tool from an MCP server is being used. |
| <img src="../images/states/slime/testing.svg" alt="Testing" width="120"> | **Testing** | A recognized test run is in flight. |
| <img src="../images/states/slime/web.svg" alt="Web" width="120"> | **Web** | The agent is looking things up online. |
| <img src="../images/states/slime/delegating.svg" alt="Subagents" width="120"> | **Subagents** | Subagents are working: small helpers appear next to the pet. |
| <img src="../images/states/slime/planning.svg" alt="Planning" width="120"> | **Planning** | The agent is updating its plan. |
| <img src="../images/states/slime/success.svg" alt="Success" width="120"> | **Success** | A test run was confirmed passed, or a commit was made. |
| <img src="../images/states/slime/error.svg" alt="Error" width="120"> | **Error** | Something really failed: a tool, the tests or the model request. |
| <img src="../images/states/slime/permission.svg" alt="Needs you" width="120"> | **Needs you** | The agent needs you: an approval or a question. |
| <img src="../images/states/slime/waiting.svg" alt="Waiting" width="120"> | **Waiting** | The turn is done and the agent waits for your next prompt. |
| <img src="../images/states/slime/finished.svg" alt="Finished" width="120"> | **Finished** | The turn has just ended. |
| <img src="../images/states/slime/tired.svg" alt="Tired" width="120"> | **Tired** | Your plan's limit is nearly used up. |
| <img src="../images/states/slime/sad.svg" alt="Sad" width="120"> | **Sad** | The pet's hearts are low (it did not like what it was told). |
| <img src="../images/states/slime/disconnected.svg" alt="Disconnected" width="120"> | **Disconnected** | No agent is connected, or the session ended. |
| <img src="../images/states/slime/petted.svg" alt="Petted" width="120"> | **Petted** | You pressed the pet. |
| <img src="../images/states/slime/giggle.svg" alt="Giggle" width="120"> | **Giggle** | You pressed the pet several times. |
| <img src="../images/states/slime/delighted.svg" alt="Delighted" width="120"> | **Delighted** | You pressed the pet a lot, or thanked it. |
| <img src="../images/states/slime/morning.svg" alt="Good morning" width="120"> | **Good morning** | A greeting when a session starts (or you come back after hours away) in the morning: a stretch, a yawn, a wave under the sun. |
| <img src="../images/states/slime/afternoon.svg" alt="Good afternoon" width="120"> | **Good afternoon** | The same greeting in the afternoon: a hop and a wave, the sun high. |
| <img src="../images/states/slime/evening.svg" alt="Good evening" width="120"> | **Good evening** | The same greeting in the evening: a calm wave under the moon. |
| <img src="../images/states/slime/night.svg" alt="Late night" width="120"> | **Late night** | The same greeting late at night: sleepy, a big yawn under the stars, then it perks up for you. |
| <img src="../images/states/slime/stretch.svg" alt="Stretch" width="120"> | **Stretch** | The break reminder (if you turned it on): after a long stretch of work it stretches and suggests a pause. |
| <img src="../images/states/slime/hurt.svg" alt="Hurt" width="120"> | **Hurt** | Someone was rude to it. Hearts recover with time and kind words. |

<sub>Generated by <code>scripts/characters.mjs</code>: the same pictures the Claude Code band draws.</sub>
