# Arcade monorepo: agent guide

Browser games, one per folder, each deployed at `/games/<slug>/` on one static Cloudflare site. Most code here is written by agents, so the repo is built to let you verify your own work without a human opening a browser.

**Before searching the repo, read `docs/repo-map.md`.** It lists every source file and what it's for, plus a "find it fast" table for common changes. A test keeps it in sync with the disk, so when you add, move or delete a file under `packages/`, `tools/`, `apps/` or `templates/`, update its row in the same change.

## Docs

| Read | When |
| --- | --- |
| `docs/repo-map.md` | Finding where anything lives. |
| `docs/architecture.md` | Changing shared packages, hosting, deploys, or questioning a stack decision. |
| `docs/agent-experience.md` | Changing the `arcade` CLI, test harness or guardrails. Its "As built" section lists what isn't built yet. |
| `docs/product-vision.md`, `docs/problem-statement.md` | Deciding what a game or feature should be. |
| `.claude/skills/` | `verify-game` (check, see, smoke), `phaser-game`, `threejs-game`, `game-feel`. |
| `<game>/DESIGN.md` | Working on that game. |
| `plans/<game>.md` | A game's phased build plan while it is being built: lanes, contracts and briefs. DESIGN.md is the source of truth for how the game works. |

## Commands

Run everything through `pnpm arcade` (`pnpm arcade help` for all options).

| When                     | Command                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proving your change      | `pnpm arcade test <slug> <paths or @groups> [-t name]`: only the tests that cover what you changed (see "Test scope" below), plus `pnpm arcade check <slug> --skip-tests` for typecheck and lint. |
| Before a merge           | `pnpm arcade check <slug>`: typecheck, lint and every unit test for the game plus every package changed since HEAD and its dependents. Whoever merges runs it, once. |
| To see the game          | `pnpm arcade see <slug> --scenario <name>` or `--input "right*30 jump"`. Read `.arcade/runs/latest/frame-*.png` / `frames.png` with your image tool; `summary.txt`, `state.json`, `events.jsonl`, `console.log` are next to it. `--query stage=x` passes launch params; `--out dir` then `--compare dir` diffs against a baseline. |
| Before a merge, too      | `pnpm arcade smoke <slug>`: production build served by `wrangler dev`, Playwright on desktop Chromium, a phone, and WebKit (2D). `rr suite -- <slug>` runs the Vitest suite sharded across the remote hosts when this machine is busy. |
| Formatting / safe fixes  | `pnpm fix`                                                                                                                                                                                                                      |
| New game                 | `pnpm arcade new <slug> --template phaser-2d\|three-3d --title "Name"`                                                                                                                                                          |
| Play it                  | `pnpm arcade dev <slug>` then open `/games/<slug>/` (`?debug=1`, `?scene=play`, `?seed=7`, `?touch=1`, `?log=debug`)                                                                                                            |
| Update snapshots         | `pnpm test:update`, only deliberately and say so in the PR. `check` never updates snapshots.                                                                                                                                    |

Input shorthand for `see --input`: `jump` taps for one tick, `right*30` holds for 30 ticks, `right+jump*10` holds both, `_*20` waits. Ticks are fixed 1/60 s logic steps, never rendered frames.

## Layout

```
games/<slug>/        a game (status draft or published in game.json)
templates/<name>/    working template games; CI tests them, they never deploy
packages/core        logger, EventLog, createRng, FixedStep, save types. No DOM.
packages/save        IndexedDB saves: versioned, migrated, never overwrites unreadable data
packages/input       named actions + on-screen touch controls
packages/shell       boot, start gate, sizing, error capture, window.__arcade test hook
packages/testing     scenario kit, GameDriver, Playwright fixture/config
packages/config      tsconfig bases, defineGameConfig (Vite), game.json schema
apps/site            landing page, generated from games/*/game.json
tools/arcade         the CLI
```

Inside a game:

- `src/logic/`: rules and state in plain TypeScript. It compiles without DOM types and may import only `@arcade/core` and `zod`. No engine imports, no `Math.random`/`Date.now`/`new Date()` (use `createRng` and the `dt` you're given). Lint and the logic tsconfig enforce this.
- `src/engine/`: Phaser scenes or the three.js world. Renders logic state, reads `@arcade/input`, emits engine events. Never ticks logic from the engine's own loop in test mode (the shell calls `advance()`).
- `scenarios/*.ts`: start state + typed input + expectations. Each is a Playwright test and works with `arcade see --scenario`.
- `tests/`: `smoke.spec.ts` (the game's own smoke script), `save.test.ts` + `fixtures/save-v<N>.json`.
- `DESIGN.md`: pitch, core loop, controls, scenes and launch params. Keep it current and short.

## Rules

- Storage only through `@arcade/save`. Input only through `@arcade/input` actions. Boot only through `@arcade/shell`.
- Changing a save shape: bump `SAVE_VERSION`, add `migrations[old]`, commit `tests/fixtures/save-v<old>.json` captured from the old code. Never delete old fixtures.
- Engines are pinned to an exact version per game (`"phaser": "4.2.1"`, `"three": "0.187.0"`). Tooling versions come from `catalog:` in `pnpm-workspace.yaml`. Don't upgrade an engine as a side effect of other work.
- Assets: import them (`import url from './assets/x.png?url'`) and pass the URL to the loader, so they're hashed and a missing file fails the build. `public/` only for files that need fixed names.
- Changes under `packages/` affect every game: keep them in their own PR, run `pnpm arcade check` (no slug) and `pnpm arcade smoke` (all games).
- Every game is original. Genre conventions are fine; other games' names, characters, art, music or levels are not.

## Versions (use these, not what you remember)

Phaser **4.2.1** (not 3: read `node_modules/phaser/skills/v3-to-v4-migration/SKILL.md`; Phaser ships agent skills for every subsystem in `node_modules/phaser/skills/`), three.js **r187** with `WebGLRenderer` (avoid WebGPU/TSL for now), Rapier `@dimforge/rapier3d-compat` **0.21** (lazy-loaded), Vite **8**, Vitest **5**, Playwright **1.65**, TypeScript **7** (native compiler; no parameter properties or enums, `erasableSyntaxOnly` is on), Biome **2.6**, Zod **4**. For API details use the Context7 docs tools rather than memory.

Engine guidance for this repo: `.claude/skills/phaser-game`, `.claude/skills/threejs-game`, `.claude/skills/game-feel`, and the `verify-game` skill for the check/see/smoke loop.

## Tests

Follow the behavior-first approach: test what a player or caller can observe.

- Logic tests (Vitest) drive the real world through its public functions (`createWorld`, `stepWorld`) with readable inputs, and assert on state, events and `toAscii()`. Small ASCII levels inline in the test are the clearest fixtures.
- Scenarios and smoke (Playwright) drive the real game through `window.__arcade` at the action level and assert on `debugSummary()`, `debugState()` and events, never pixels. Assert semantic values (scene, counts, status, tiles); round floats.
- The `game` fixture fails any test that logged a console error, had a failed request, reported a game error or dropped events. Don't suppress those; fix them.
- No sleeps. The driver waits on `ready`, `idle()` and ticks.
- Watch every new test fail once: break the behavior, run it, see the failure message you expect, restore.
- Mock nothing you own. Time and randomness are already controlled (ticks, seeds).

## Test scope

Run the narrowest tests that prove your change, and leave the full suite for the merge.

- While working, and before reporting, run `pnpm arcade test <slug>` with the paths or `@groups` that cover the files you touched, plus any guard the change could break (a game's `@behavior` group, for example, if it has one), and `pnpm arcade check <slug> --skip-tests`. Name the paths you ran in your report.
- Don't run `pnpm arcade check <slug>` without `--skip-tests`, the game's whole Vitest suite, slow test projects or `pnpm arcade smoke` unless your brief asks for them or you are the one merging. Several agents run at once on one machine, and full runs from each of them slow everyone down and time out tests.
- The full suite runs once per merge: whoever merges a branch runs `pnpm arcade check <slug>`, any slow project the game defines, and `pnpm arcade smoke <slug>` on the merged result. `rr suite -- <slug>` shards the Vitest part across the remote hosts in `.rr.yaml`.
- A game lists related tests as named groups in its `package.json` (`"arcade": { "testGroups": { "courses": ["src/logic/courses", "src/logic/conformance"] } }`), run with `pnpm arcade test <slug> @courses`. An unknown group lists the ones that exist. Add a group when you find yourself typing the same set of paths twice.

## Done means

For a change someone else merges: the tests covering it pass by "Test scope", typecheck and lint pass, you've looked at a `see` capture of what you changed, `DESIGN.md` reflects the change, and any new behavior has a scenario or logic test. For a merge: `pnpm arcade check <slug>` and `pnpm arcade smoke <slug>` pass as well, you've looked at a `see` capture of what you changed, `DESIGN.md` reflects the change, and any new behavior has a scenario or logic test. If you added, moved or removed a shared or template file, `docs/repo-map.md` says so.

## Hooks

`.claude/hooks/format.ts` (Biome-format each edited file) and `.claude/hooks/check-on-stop.ts` (run `pnpm arcade check` before ending a turn that changed code) exist but only run once a person registers them in a Claude Code `settings.json`. Agents shouldn't register them on their own. Until they're registered, run `pnpm fix` and the checks "Test scope" asks for yourself.
