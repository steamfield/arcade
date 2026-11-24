# Problem Statement

## TL;DR

We want a public web arcade of many original games across very different genres (tile RPG, 2D platformer, 3D action), built mostly by AI coding agents with a human reviewing. The hard part is not any single game. It is that every new game re-solves the same setup problems, and agents re-solve them differently each time, so the collection drifts into a pile of inconsistent, half-working projects. This repo exists to make game number ten as cheap and reliable to ship as game number two.

## The problems

### For the builder (a human directing AI agents)

An AI-assisted solo developer struggles to ship many browser games of different genres because each new game means re-deciding the engine, build config, save system, input handling (including touch), asset pipeline and deploy path, resulting in games that stall before shipping or ship with inconsistent behavior that breaks on phones.

Concretely, without a foundation:

- An agent asked for "a platformer" picks whatever engine and folder layout it remembers best, so no two games share conventions and a reviewer has to relearn each one.
- Agents have no fast way to check their own work. A game that compiles can still be a black screen, and nobody finds out until a human opens it.
- Saves, settings and touch controls get reimplemented per game, each with its own bugs. Safari quietly evicts browser storage, and only one game remembers to handle it.
- Deploying means hand-assembling builds under the right URL paths. One wrong `base` path and a game 404s on its own assets in production but works locally.

### For players

Casual players on desktop and phone want to try a game instantly from a link, with no install, account or download prompt, and pick up where they left off next time. They leave when a game takes too long to load, does not work on their phone, or loses their progress.

## Jobs to be done

When I have an idea for a new game, I want to start it from a template that already builds, deploys, saves and handles input, so I can spend the agent's effort on gameplay instead of plumbing.

When an agent finishes a change, I want it to prove the game still loads and runs (typecheck, tests, a headless smoke run), so I review gameplay rather than chase broken builds.

When I share the arcade link, I want players to land on a page that loads fast and gets them into any game in a tap, so the collection feels like one product and not a folder of experiments.

When a player comes back a week later, they want their save to still be there, so the game respects their time.

## Who this is not for

Public multiplayer and competitive leaderboards are out of scope for now. Nothing ships with a server until a specific game needs one: Rush Racers' races with friends are the first, through a room Worker in `apps/api`.

## Assumptions

| Assumption                                                                                                     | Evidence                                                                         | Confidence | How to validate                                                         |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| Agents produce more consistent games from a working template plus written conventions than from a blank folder | Observed drift when agents scaffold from scratch                                 | High       | Build two games from templates, compare review effort                   |
| One engine cannot serve all genres well, so the repo must support several                                      | Phaser/Pixi are 2D-first; three.js has no 2D tilemap story                       | High       | Research report (see architecture plan)                                 |
| Static hosting plus browser storage covers every game in the first year                                        | Held for single-player games; Rush Racers' online races added one small Worker   | Medium     | Revisit when the first leaderboard idea comes up                        |
| Players will tolerate a few MB of download for a 3D game but not for a 2D one                                  | General web performance norms, no data of our own                                | Low        | Measure load times and bounce once deployed                             |
| Touch controls can be shared across most 2D games                                                              | Platformers and tile RPGs both map to d-pad plus a few buttons                   | Medium     | Build touch input for the first two 2D games and see how much is shared |
| Safari storage eviction will bite returning players                                                            | WebKit's 7-day cap on script-writable storage for sites without user interaction | Medium     | Test a save on iOS Safari after a week of no visits                     |

## What success looks like

- A new game goes from template to deployed and playable at its own URL in one agent session.
- Every game in the arcade loads to an interactive screen on a mid-range phone over 4G in under 5 seconds for 2D and under 10 seconds for 3D.
- No game in production is broken on load. CI catches a black screen before it ships.
- A returning player's save is present after reload and after a browser restart, and a player can export and import a save file as a fallback.
