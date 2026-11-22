# Repo map

Where everything is, so you can open the right file instead of searching. Every source file under `packages/*/src`, `tools/*/src`, `apps/*/src`, `templates/*/src` and `templates/*/scenarios` is listed here; `tools/arcade/src/repo-map.test.ts` fails `pnpm arcade check` when a file is added or removed without updating this map, or when a path below no longer exists.

## Find it fast

| I want to... | Go to |
| --- | --- |
| Start a new game | `pnpm arcade new <slug> --template phaser-2d\|three-3d`, copies a folder from `templates/` |
| Change a game's rules | `<game>/src/logic/world.ts` (state, `stepWorld`), tests next to it in `world.test.ts` |
| Change how a game looks | `<game>/src/engine/game.ts` |
| Add an input action or touch button | `<game>/src/engine/input.ts`; the mechanism is `packages/input/src/index.ts` |
| Change a save shape | `<game>/src/logic/save.ts`, then `<game>/tests/fixtures/` and `<game>/tests/save.test.ts` |
| Add a scenario (Playwright test + `arcade see --scenario`) | `<game>/scenarios/<name>.ts`, using `<game>/scenarios/kit.ts` |
| Change what every game does at boot (start gate, errors, `window.__arcade`) | `packages/shell/src/index.ts` |
| Change the test harness or scenario format | `packages/testing/src/` |
| Change a `pnpm arcade` command | `tools/arcade/src/<command>.ts`, wired up in `tools/arcade/src/cli.ts` |
| Change the Vite or TypeScript setup for every game | `packages/config/src/vite.ts`, `packages/config/tsconfig.*.json` |
| Change the `game.json` schema | `packages/config/src/manifest.ts` |
| Change the landing page | `apps/site/` |
| Change a lint rule | `biome.json`, plus `tools/biome/no-nondeterminism.grit` for logic-only bans |
| Change CI or deploys | `.github/workflows/ci.yml`, `wrangler.jsonc`, `tools/arcade/src/assemble.ts` |

`<game>` is `games/<slug>` or `templates/<name>`.

## Root

| Path | What it is |
| --- | --- |
| `AGENTS.md` | Agent guide: commands, rules, versions, test rules, definition of done. `CLAUDE.md` imports it. |
| `README.md` | Human-facing quick start. |
| `package.json` | Root scripts: `fix`, `test:update`, `build`, `deploy`. `pnpm arcade` resolves to the CLI's bin. |
| `pnpm-workspace.yaml` | Workspace globs and the `catalog:` of tooling versions. Engines are pinned per game, not here. |
| `turbo.json` | `typecheck`, `test`, `build` task graph and cache inputs. |
| `biome.json` | Lint and format, with per-folder overrides (test files, game `src/`, logic folders). |
| `tsconfig.json` | Editor-level config. Each package has its own. |
| `wrangler.jsonc` | Cloudflare Workers static assets config. Serves `dist/`. |
| `.github/workflows/ci.yml` | CI: `arcade check --all`, `arcade smoke`, preview upload on PRs, deploy on main. |
| `.nvmrc` | Node 24. |

Generated and ignored, never worth searching: `node_modules/`, `dist/` (assembled site), `.arcade/runs/` (`arcade see` output, `latest` symlink), `test-results/`, `.turbo/`, `.wrangler/`.

## Docs

| Path | What it is |
| --- | --- |
| `docs/repo-map.md` | This file. |
| `docs/architecture.md` | Stack, key decisions and why, shared packages, hosting, risks. |
| `docs/agent-experience.md` | The agent tooling design: inner loop, determinism, `see`, guardrails, tests. "As built" at the end lists what differs from the plan and what isn't built. |
| `docs/product-vision.md` | Who the arcade is for and what success looks like. |
| `docs/problem-statement.md` | The problem the repo solves. |
| `docs/research/stack-research-2026-11.md` | The stack research behind the architecture. Background only. |

## Agent config (`.claude/`)

| Path | What it is |
| --- | --- |
| `.claude/skills/verify-game/SKILL.md` | The check, see, smoke loop and how to read its output. |
| `.claude/skills/phaser-game/SKILL.md` | Phaser 4 in this repo; points to Phaser's bundled skills in `node_modules/phaser/skills/`. Assets in `references/assets.md`. |
| `.claude/skills/threejs-game/SKILL.md` | three.js r187 + Rapier in this repo; `references/` covers performance, assets, physics and camera, look. |
| `.claude/skills/game-feel/SKILL.md` | Controls, juice, HUD, accessibility, mobile, all kept deterministic. |
| `.claude/agents/game-reviewer.md` | Read-only reviewer for game changes. |
| `.claude/rules/game-logic.md` | Loaded when touching `src/logic/`. |
| `.claude/rules/game-engine.md` | Loaded when touching `src/engine/` or `src/main.ts`. |
| `.claude/rules/game-tests.md` | Loaded when touching `scenarios/` or `tests/`. |
| `.claude/hooks/format.ts` | PostToolUse hook: Biome-formats the edited file. Inactive until registered as a hook in a `settings.json` (see the hooks note in `AGENTS.md`). |
| `.claude/hooks/check-on-stop.ts` | Stop hook: runs `pnpm arcade check` when code changed. Needs registering too. |
| `.claude/launch.json` | Dev servers for the in-app browser preview. `arcade new` adds each game. |

## Shared packages (`packages/`)

Each exports from `src/index.ts` unless noted. Changing one affects every game: run `pnpm arcade check` and `pnpm arcade smoke` with no slug.

### `@arcade/core`: no DOM, usable from game logic

| Path | Exports |
| --- | --- |
| `packages/core/src/index.ts` | Re-exports the files below. |
| `packages/core/src/rng.ts` | `createRng(seed)` (mulberry32): `next`, `int`, `pick`, `state`. The only randomness logic may use. |
| `packages/core/src/timestep.ts` | `TICK_HZ` (60), `TICK_DT`, `FixedStep` (`frame(realDelta)`, `advance(n)`, `tick`, `alpha`). |
| `packages/core/src/events.ts` | `EventLog` ring buffer (`emit`, `drain(cursor)` with dropped count, `all`, `tick`), `EventSink`. |
| `packages/core/src/logger.ts` | `createLogger(ns)`, `configureLogging(sink, filter)`. Use instead of `console`. |
| `packages/core/src/save-types.ts` | `SaveSchema`, `Migration`, `Migrations` types shared by game `save.ts` files and `@arcade/save`. |

### `@arcade/save`

| Path | Exports |
| --- | --- |
| `packages/save/src/index.ts` | `createSaveStore({ gameId, version, schema, migrate })`: `load` (ok, empty, unreadable, newer-than-code), `save`, `remove`, `slots`, `exportJson`, `importJson`, `requestPersistence`, `status`. One IndexedDB per game, quarantine and pre-migration backups, Web Locks guard. Also `downloadText`. |

### `@arcade/input`

| Path | Exports |
| --- | --- |
| `packages/input/src/index.ts` | `createInput({ actions, vectors, touch })`: `isDown`, `justPressed`, `vector`, `update` (once per tick), `on`, `inject` (tests), `mount` (keyboard plus touch overlay), `destroy`. Taps shorter than a tick are latched. |

### `@arcade/shell`

| Path | Exports |
| --- | --- |
| `packages/shell/src/index.ts` | `bootGame({ manifest, input, start, onFirstGesture })`, the `GameContext` passed to a game and the `GameHandle` it returns, `window.__arcade` (the test hook), URL launch params (`?seed`, `?scene`, `?debug`, `?test` via `readLaunchParams`; `?touch`, `?log` read at boot), start gate, back link (top right), rotate prompt, `integerScale`, `renderPixelRatio`. |

### `@arcade/testing`

| Path | Exports |
| --- | --- |
| `packages/testing/src/index.ts` | Re-exports `scenario.ts` and `driver.ts`. Playwright pieces come from `@arcade/testing/playwright`. |
| `packages/testing/src/scenario.ts` | `scenarioKit<Action>()` (`scenario`, `hold`, `tap`, `wait`), `parseInput("right*30 jump")`, `totalTicks`, `Scenario` and result types. |
| `packages/testing/src/driver.ts` | `GameDriver`: `open`, `advance`, `play`, `loadState`, `summary`, `state`, `events`, `screenshot`, `runScenario`, `problems`. Shared by Playwright and `arcade see`. |
| `packages/testing/src/playwright.ts` | The `test` fixture (`game`, fails on console errors, failed requests, game errors, dropped events), `defineScenarioTests(dir)`, `gamePlaywrightConfig(url)` (desktop, phone, WebKit projects). |

### `@arcade/config`

| Path | Exports |
| --- | --- |
| `packages/config/src/index.ts` | Re-exports the manifest schema. |
| `packages/config/src/manifest.ts` | `gameManifestSchema`, `GameManifest`, `parseManifest`: the `game.json` format. |
| `packages/config/src/vite.ts` | `defineGameConfig(import.meta.url)`: base path `/games/<slug>/`, hashed assets, dev server, share tags. `readManifest`. Imported as `@arcade/config/vite`. |
| `packages/config/tsconfig.base.json` | Strict base, `erasableSyntaxOnly`. |
| `packages/config/tsconfig.game.json` | Game code: DOM plus `vite/client`. |
| `packages/config/tsconfig.logic.json` | Logic code: ES2023 only, no DOM, which is how logic is kept engine-free. |

## CLI (`tools/arcade/`, `pnpm arcade <command>`)

| Path | What it does |
| --- | --- |
| `tools/arcade/src/cli.ts` | Argument parsing and help for every command. Entry point. |
| `tools/arcade/src/games.ts` | `listGames`, `findGame`, `ROOT`, `UsageError`. Reads every `game.json`. |
| `tools/arcade/src/run.ts` | `run(cmd)` subprocess helper with captured output, `elapsed`. |
| `tools/arcade/src/check.ts` | `check`: turbo typecheck, lint, test for the slug plus changed packages; condenses output. |
| `tools/arcade/src/see.ts` | `see`: headless run to an exact tick, writes frames, summary, state, events, console to `.arcade/runs/`. |
| `tools/arcade/src/smoke.ts` | `smoke`: assemble, `wrangler dev`, Playwright per game against the production build. |
| `tools/arcade/src/assemble.ts` | `assemble`, `selectGames`: builds site plus games into `dist/`, writes `_headers`, checks Cloudflare limits. |
| `tools/arcade/src/new-game.ts` | `newGame`: copies a template, renames, registers it in `.claude/launch.json`, installs. |
| `tools/arcade/src/repo-map.test.ts` | Keeps this map in sync with the files on disk. |
| `tools/biome/no-nondeterminism.grit` | Biome plugin banning `Math.random`, `Date.now`, `new Date` in logic folders. |

## Landing page (`apps/site/`)

| Path | What it is |
| --- | --- |
| `apps/site/vite.config.ts` | Build plus a plugin that renders the game list from `games/*/game.json` (filtered by `ARCADE_INCLUDE`). |
| `apps/site/index.html` | Landing page template. |
| `apps/site/404.html` | Not-found page Cloudflare serves. |
| `apps/site/src/style.css` | Site styles, light and dark. |

## Anatomy of a game

Every game has the same shape. The 2D template is the reference; the 3D template differs only where noted.

| Path (2D template) | What it is |
| --- | --- |
| `templates/phaser-2d/game.json` | Manifest: id, slug, title, pitch, engine, inputs, orientation, status (`template`, `draft`, `published`). |
| `templates/phaser-2d/DESIGN.md` | Pitch, core loop, controls, scenes, launch params. Keep it current. |
| `templates/phaser-2d/package.json` | Pins the engine version exactly. |
| `templates/phaser-2d/index.html` | Page shell; title and share tags are injected at build. |
| `templates/phaser-2d/vite.config.ts` | One line: `defineGameConfig(import.meta.url)`. |
| `templates/phaser-2d/playwright.config.ts` | One line: `gamePlaywrightConfig(import.meta.url)`. |
| `templates/phaser-2d/tsconfig.json`, `templates/phaser-2d/tsconfig.logic.json` | Game and logic-only type configs. |
| `templates/phaser-2d/src/main.ts` | Boot: `bootGame` with the manifest, input and `startPhaser`. |
| `templates/phaser-2d/src/logic/world.ts` | `createWorld`, `stepWorld(world, input, dt)`, tile physics, `toSave`, `summarize` (what scenarios assert on), `toAscii`. |
| `templates/phaser-2d/src/logic/level.ts` | ASCII levels, `TILE`, `parseLevel`, `isSolid`, `LEVEL_1`. |
| `templates/phaser-2d/src/logic/events.ts` | `GameEvent` union: everything observable that logic emits. |
| `templates/phaser-2d/src/logic/save.ts` | `SAVE_VERSION`, `SaveSchema`, `migrations`, `NEW_GAME`. |
| `templates/phaser-2d/src/engine/game.ts` | `startPhaser`: `Runtime` (owns `FixedStep`, scene changes, `idle`), Boot, Title and Play scenes, debug overlay, the `GameHandle`. |
| `templates/phaser-2d/src/engine/input.ts` | Action names, key bindings, touch layout. |
| `templates/phaser-2d/src/engine/textures.ts` | `Tex` keys and placeholder textures drawn at boot. |
| `templates/phaser-2d/scenarios/kit.ts` | The game's typed `scenario`, `hold`, `tap`, `wait`. |
| `templates/phaser-2d/scenarios/collect-first-coin.ts` | Scenario: walk right and collect a coin. |
| `templates/phaser-2d/scenarios/complete-level.ts` | Scenario: finish the level. |
| `templates/phaser-2d/scenarios/restore-save.ts` | Scenario: start from a save fixture. |
| `templates/phaser-2d/tests/smoke.spec.ts` | Loads, WebGL renderer, save survives reload, touch controls (`@touch`). |
| `templates/phaser-2d/tests/scenarios.spec.ts` | Turns every scenario into a Playwright test. |
| `templates/phaser-2d/tests/save.test.ts`, `templates/phaser-2d/tests/fixtures/save-v1.json` | Every committed save version must still load. |

The 3D template (`templates/three-3d/`) has the same files with these differences:

| Path | What it is |
| --- | --- |
| `templates/three-3d/src/main.ts` | Boot with `startThree`. |
| `templates/three-3d/src/logic/world.ts` | Arena, orbs, player movement; `ARENA`, `ORB_COUNT`. No `toAscii`. |
| `templates/three-3d/src/logic/events.ts` | `GameEvent` union. |
| `templates/three-3d/src/logic/save.ts` | Save shape (seed, collected orbs). |
| `templates/three-3d/src/engine/game.ts` | `startThree`: renderer, scene, rAF loop (off in test mode), `FixedStep` tick, `GameHandle`. |
| `templates/three-3d/src/engine/physics.ts` | Lazy Rapier: `loadPhysics`, kinematic player, `CRATE_SPAWNS`. `idle()` is false until it loads. |
| `templates/three-3d/src/engine/camera-rig.ts` | `CameraRig`: follow camera smoothed per tick. |
| `templates/three-3d/src/engine/input.ts` | Actions, keys, touch layout. |
| `templates/three-3d/scenarios/kit.ts` | Typed scenario kit. |
| `templates/three-3d/scenarios/collect-first-orb.ts` | Scenario: walk to the first orb. |
| `templates/three-3d/scenarios/push-crate.ts` | Scenario: Rapier pushes a crate. |
| `templates/three-3d/scenarios/restore-save.ts` | Scenario: start from a save fixture. |

Games in `games/` follow the same layout. Their own `DESIGN.md` is the map for anything game-specific.
