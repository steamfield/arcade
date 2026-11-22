# Product Vision

## TL;DR

A free, public web arcade of original games that load instantly from a link and run on desktop and phone. Each game is its own small product with its own URL, built on a shared foundation so that AI agents can produce new games quickly and consistently. Everything runs in the browser, hosted as static files, with saves kept on the player's device.

## What the arcade is

A landing page lists every game with a cover image, a one-line pitch and a play button. Each game lives at its own path (`/games/<slug>/`), loads independently, and never pays the download cost of another game. A player can bookmark or share a single game directly.

The collection spans genres on purpose. Early targets:

- A top-down creature-collecting RPG with tile maps, dialogue, turn-based battles and save files.
- A pixel-art side-scrolling platformer with tight arcade physics.
- A 3D game with modern rendering and physics.

Every game is original: our own names, characters, art, music and levels. Genre conventions are fair game; recreating someone else's game, or borrowing its characters, art or level design, is not. This matters more because the site is public.

## Who it serves

Players are casual and mostly arrive from a shared link. They want to be playing within seconds, on whatever device they have, with no account. Some will come back to longer games like the RPG, and they expect their progress to still be there.

The builder is a human directing AI coding agents. They want each new game to start from something that already builds, deploys, saves and takes input, and they want agents to verify their own work before asking for review.

## Experience qualities

Fast and obvious for players. A game should show something interactive quickly and need no instructions to start. Where these conflict with visual ambition (large 3D assets, long intros), fast wins: load a playable scene first and stream the rest.

Predictable for builders. Every game has the same layout, the same scripts and the same checks, so an agent or reviewer who has seen one game can find their way around any other.

## Player journey

| Moment           | What happens                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry            | A shared link to the arcade or directly to one game.                                                                                                               |
| First impression | Landing page shows covers immediately. Inside a game, a title screen appears quickly with a clear start control for keyboard, mouse or touch.                      |
| Core action      | Playing. Controls are shown on screen on touch devices and work with keyboard on desktop.                                                                          |
| Feedback         | The game autosaves at sensible points and says so briefly.                                                                                                         |
| Recovery         | If storage is unavailable (private mode, quota), the game still runs and warns that progress will not persist. Players can export a save file and import it later. |
| Return           | Visiting again, the game offers to continue. The landing page can show which games have a save in progress.                                                        |

## Builder journey

| Moment | What happens                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start  | One command creates a new game from a template (2D or 3D), registers it with the landing page, and it runs locally.                                         |
| Build  | The agent works inside that game's folder, using shared packages for saves, input and settings. Conventions are written in the repo where agents read them. |
| Verify | Typecheck, lint, unit tests and a headless browser smoke test that loads the game and confirms it renders and responds to input.                            |
| Ship   | Merging to main builds every game into one static site and deploys it. No manual assembly.                                                                  |

## Scope

### Must (foundation, before the first game ships)

- Monorepo where each game builds on its own and deploys under its own path.
- Templates for at least one 2D and one 3D game that build, run and pass checks.
- Shared save system on IndexedDB with versioned save data, a fallback when storage is unavailable, and export/import.
- Shared input layer covering keyboard and touch, with on-screen controls for touch devices.
- Landing page generated from each game's metadata.
- CI that runs checks and a smoke test per game, then deploys to Cloudflare.
- Written conventions for agents (where code goes, which packages to use, how to verify).
- The final domain, chosen before the first public deploy. Saves live per origin, so moving domains later would strand every player's progress.

### Should (soon after)

- Gamepad support in the shared input layer.
- Shared settings (volume, controls) persisted per game.
- Performance budget per game enforced in CI (bundle and asset size).
- Asset pipeline helpers for sprite atlases, Tiled or LDtk maps and compressed glTF.

### Could

- Landing page shows "continue" badges for games with saves.
- Offline play via a service worker.
- Shared audio helpers.

### Won't (this version)

- Accounts, cloud saves, leaderboards or multiplayer. These need a backend. When a game needs one, it gets a small Cloudflare Worker scoped to that feature, not a general API.
- A shared in-house game engine. Games use established engines directly; shared code stays small.
- Native app wrappers (Electron, Capacitor, Steam).
- Monetization (ads, payments).

## Success metrics

- Time from "new game" command to a deployed, playable build: one agent session.
- Share of production games that pass the smoke test on every deploy: 100%.
- Load to interactive on a mid-range phone over 4G: under 5 s for 2D, under 10 s for 3D.
- Saves survive reload and browser restart on Chrome, Firefox and Safari.
