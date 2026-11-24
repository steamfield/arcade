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
| Change what every game does at boot (starting, the test-mode gate, errors, `window.__arcade`) | `packages/shell/src/index.ts` |
| Change the test harness or scenario format | `packages/testing/src/` |
| Change a `pnpm arcade` command | `tools/arcade/src/<command>.ts`, wired up in `tools/arcade/src/cli.ts` |
| Change the Vite or TypeScript setup for every game | `packages/config/src/vite.ts`, `packages/config/tsconfig.*.json` |
| Change the `game.json` schema | `packages/config/src/manifest.ts` |
| Change the landing page | `apps/site/` |
| Record a game's landing-page footage and cover | `pnpm arcade attract <slug>`, settings in its package.json `arcade.attract` |
| Change a lint rule | `biome.json`, plus `tools/biome/no-nondeterminism.grit` for logic-only bans and `tools/biome/no-inexact-math.grit` for rush-racers' and rush-racers-3d's bit-exact math |
| Add a world to Rush Racers | Logic: `games/rush-racers/src/logic/worlds/<id>.ts`. Art: `games/rush-racers/src/engine/worlds/<id>.ts` plus `<id>/{keys,cast,objects,art}.ts`, `<id>/palettes.ts` when views read its colours, and `<id>/sprites/`; register in `games/rush-racers/src/engine/worlds/index.ts` (`SKINS`, `WORLD_ART`). `games/rush-racers/src/engine/worlds/load.ts` loads its art on demand. Steps: "Add a world" in `games/rush-racers/COURSES.md` |
| Add a theme (a course's look) to Rush Racers | `games/rush-racers/src/engine/themes/<id>.ts` plus `<id>/{keys,palettes,art}.ts` and `<id>/sprites/`; register in `games/rush-racers/src/engine/themes/index.ts` (`THEMES`, `THEME_ART`) and add the id to `ThemeId` in `games/rush-racers/src/logic/courses/types.ts`. Loaded on demand by `games/rush-racers/src/engine/worlds/load.ts` |
| Change online rooms or races | Room service: `apps/api/src/` (`protocol.ts` is the wire contract). Rush Racers: `games/rush-racers/src/net/` (client, lobby, lockstep, transports), `src/engine/online/` (flow, screens), `tests/online*.spec.ts` |
| Change CI or deploys | `.github/workflows/ci.yml`, `tools/arcade/src/affected.ts`, `wrangler.jsonc`, `tools/arcade/src/assemble.ts`, `cf:build` in `package.json` |

`<game>` is `games/<slug>` or `templates/<name>`.

## Root

| Path | What it is |
| --- | --- |
| `AGENTS.md` | Agent guide: commands, rules, versions, test rules, definition of done. `CLAUDE.md` imports it. |
| `README.md` | Human-facing quick start. |
| `package.json` | Root scripts: `fix`, `test:update`, `build`, `cf:build` (Cloudflare's build command), `deploy`. `pnpm arcade` resolves to the CLI's bin. |
| `pnpm-workspace.yaml` | Workspace globs and the `catalog:` of tooling versions. Engines are pinned per game, not here. |
| `turbo.json` | `typecheck`, `test`, `build` task graph and cache inputs. |
| `biome.json` | Lint and format, with per-folder overrides (test files, game `src/`, logic folders). |
| `tsconfig.json` | Editor-level config. Each package has its own. |
| `wrangler.jsonc` | Cloudflare Workers static assets config. Serves `dist/` at the `arcade.steamfield.io` custom domain. |
| `.github/workflows/ci.yml` | CI: a `plan` job runs `arcade affected --base`, then one `arcade check --base` job, one `arcade smoke` job per affected game, and each affected game's sharded slow suite. Deploys run in Cloudflare Workers Builds, not here. |
| `.nvmrc` | Node 24. |

Generated and ignored, never worth searching: `node_modules/`, `dist/` (assembled site), `.arcade/runs/` (`arcade see` output, `latest` symlink), `test-results/`, `.turbo/`, `.wrangler/`.

## Docs

| Path | What it is |
| --- | --- |
| `docs/repo-map.md` | This file. |
| `docs/architecture.md` | Stack, key decisions and why, shared packages, hosting, risks. |
| `docs/agent-experience.md` | The `arcade` CLI, test harness and guardrails as built: inner loop, determinism, `see`, lint and type rules, tests, hooks, and a short "Not built yet" list. |
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
| `.claude/hooks/check-on-stop.ts` | Stop hook: runs `pnpm arcade check --skip-tests` when code changed. Needs registering too. |
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
| `packages/core/src/hash.ts` | `hashState(value, { skipKeys })`: tagged 32-bit FNV-1a over any plain state, the same bytes on every engine. Games hash their world with it for lockstep and cross-browser checks. |
| `packages/core/src/save-types.ts` | `SaveSchema`, `Migration`, `Migrations` types shared by game `save.ts` files and `@arcade/save`. |

### `@arcade/save`

| Path | Exports |
| --- | --- |
| `packages/save/src/index.ts` | `createSaveStore({ gameId, version, schema, migrate })`: `load` (ok, empty, unreadable, newer-than-code), `save`, `remove`, `slots`, `exportJson`, `importJson`, `requestPersistence`, `status`. One IndexedDB per game, quarantine and pre-migration backups, Web Locks guard. Also `downloadText`. |

### `@arcade/input`

| Path | Exports |
| --- | --- |
| `packages/input/src/index.ts` | `createInput({ actions, vectors, touch })`: `isDown`, `justPressed`, `vector`, `update` (once per tick), `on`, `inject` (tests), `mount` (keyboard plus touch overlay), `destroy`, and text entry (`setTextEntry`, `takeText`, `injectText`): while on, typed keys and pastes become text instead of actions. Taps shorter than a tick are latched. |

### `@arcade/shell`

| Path | Exports |
| --- | --- |
| `packages/shell/src/index.ts` | `bootGame({ manifest, input, start, onFirstGesture })`, the `GameContext` passed to a game and the `GameHandle` it returns, `window.__arcade` (the test hook), URL launch params (`?seed`, `?scene`, `?debug`, `?test` via `readLaunchParams`; `?touch`, `?log` read at boot), back link (top right), rotate prompt, `integerScale`, `renderPixelRatio`. Starts the game on load; the start gate shows only in test mode, and `onFirstGesture` runs on the first tap or key press. |
| `packages/shell/src/report-error.ts`, `packages/shell/src/report-error.test.ts` | `createErrorReporter`: records each game error in `window.__arcade.errors` and logs it; only a fatal report (the default) shows the red banner, so `reportError(source, error, { fatal: false })` is for errors the game recovers from. |

### `@arcade/testing`

| Path | Exports |
| --- | --- |
| `packages/testing/src/index.ts` | Re-exports `scenario.ts`, `driver.ts`, `ports.ts`, `chromium-args.ts`, `game-session.ts` and `save-fixtures.ts`. Playwright pieces come from `@arcade/testing/playwright`. |
| `packages/testing/src/scenario.ts` | `scenarioKit<Action>()` (`scenario`, `hold`, `tap`, `wait`), `parseInput("right*30 jump")`, `totalTicks`, `Scenario` and result types; `start` takes `save`, `scene`, `seed` and `query`. |
| `packages/testing/src/driver.ts` | `GameDriver`: `open`, `waitIdle`, `advance`, `play`, `touch` (hold an on-screen button by action name), `loadState`, `summary`, `state`, `events`, `screenshot`, `renderer`, `runScenario`, `problems`. Shared by Playwright and `arcade see`. |
| `packages/testing/src/playwright.ts` | The `test` fixture (`game`, fails on console errors, failed requests, game errors, dropped events), `defineScenarioTests(dir)`, `gamePlaywrightConfig(url, { extraWebServers })` (desktop, phone, WebKit projects; extra servers such as an API Worker get free ports through an environment variable). |
| `packages/testing/src/ports.ts` | `freePort()`: an unused local port for test and tool servers. |
| `packages/testing/src/chromium-args.ts` | `CHROMIUM_ARGS`: the Chromium flags shared by Playwright projects, `see` and `attract`. |
| `packages/testing/src/game-session.ts` | `openGameSession`: Vite test server, Chromium and an open `GameDriver` page for `see` and `attract`; `close()` stops all of it. |
| `packages/testing/src/save-fixtures.ts` | `checkSaveFixtures`: every committed `save-v<N>.json` is present and loads at the current version. Games' `save.test.ts` call it. |

### `@arcade/config`

| Path | Exports |
| --- | --- |
| `packages/config/src/index.ts` | Re-exports the manifest schema. |
| `packages/config/src/game-html-plugin.ts` | Vite plugin that injects the title, description and Open Graph tags from `game.json`. |
| `packages/config/src/test-config.ts` | `buildTestConfig`: Vitest defaults for a game, and the `slowTests` option that splits tests into `unit` and a slow project. |
| `packages/config/src/manifest-file.ts` | `readManifest(dir)`, `readManifestsIn(parent)`: read `game.json` from disk for Node tools. Imported as `@arcade/config/manifest-file`. |
| `packages/config/src/manifest.ts` | `gameManifestSchema`, `GameManifest`, `parseManifest`: the `game.json` format. |
| `packages/config/src/vite.ts` | `defineGameConfig(import.meta.url, overrides?, { slowTests }?)`: base path `/games/<slug>/`, hashed assets, dev server, share tags; every override key reaches the result. `readManifest`. Imported as `@arcade/config/vite`. |
| `packages/config/tsconfig.base.json` | Strict base, `erasableSyntaxOnly`. |
| `packages/config/tsconfig.game.json` | Game code: DOM plus `vite/client`. |
| `packages/config/tsconfig.logic.json` | Logic code: ES2023 only, no DOM, which is how logic is kept engine-free. |

## CLI (`tools/arcade/`, `pnpm arcade <command>`)

| Path | What it does |
| --- | --- |
| `tools/arcade/src/cli.ts` | Argument parsing and help for every command. Entry point. |
| `tools/arcade/src/games.ts` | `listGames`, `findGame`, `ROOT`, `UsageError`. Reads every `game.json`. |
| `tools/arcade/src/run.ts` | `run(cmd)` subprocess helper with captured output, `elapsed`. |
| `tools/arcade/src/check.ts` | `check`: turbo typecheck, lint, test (or `--skip-tests`) for the slug plus changed packages, or what changed since `--base`; condenses output. |
| `tools/arcade/src/affected.ts` | `affected`, `affectedSince`, `planFromChanges`: which packages, games and slow-suite shards a change since a base commit needs tested. CI's job matrices come from it. |
| `tools/arcade/src/affected.test.ts` | Which games a change selects, the global files that select all, slow-suite shards. |
| `tools/arcade/src/ci.test.ts` | CI's Playwright container tag matches the catalog's `@playwright/test`. |
| `tools/arcade/src/see.ts` | `see`: headless run to an exact tick, writes frames, summary, state, events, console to `.arcade/runs/` (or `--out`); `--viewport`, `--query` launch params, `--compare` pixel diff against an earlier run. |
| `tools/arcade/src/test.ts` | `test`: one game's Vitest run, narrowed to paths, `@group`s from the game's package.json (a path list or `{ project, paths }`), or `-t`; runs the fast project its `test` script names unless given test files or `--project`; one line when green. |
| `tools/arcade/src/test.test.ts` | `@group` expansion and the Vitest arguments `arcade test` builds. |
| `tools/arcade/src/guardrails.test.ts` | Each Biome import and nondeterminism ban fires (with a near miss that passes), and no game or template imports a relative path outside its own folder. |
| `tools/arcade/src/smoke.ts` | `smoke`: assemble, `wrangler dev` (site Worker plus the API Worker behind `/api/*`), Playwright per game against the production build. |
| `tools/arcade/src/assemble.ts` | `assemble`, `selectGames`, `includeForBranch`: builds site plus games into `dist/`, writes `_headers`, checks Cloudflare limits. |
| `tools/arcade/src/assemble.test.ts` | Which games a Cloudflare build ships per branch. |
| `tools/arcade/src/attract.ts` | `attract`: plays a scenario headlessly and records a game's landing-page loop (`public/attract.mp4`) and cover (`public/cover.png`) with ffmpeg. Settings in the game's package.json `arcade.attract`. |
| `tools/arcade/src/attract.test.ts` | Which ticks `attract` records. |
| `tools/arcade/src/new-game.ts` | `newGame`: copies a template, renames, registers it in `.claude/launch.json`, installs. |
| `tools/arcade/src/repo-map.test.ts` | Keeps this map in sync with the files on disk. |
| `tools/arcade/src/see-images.ts` | Image work for `arcade see`: the contact sheet of captured frames and pixel diffs against a baseline run. |
| `tools/biome/no-nondeterminism.grit` | Biome plugin banning `Math.random`, `Date.now`, `new Date` in logic folders. |
| `tools/biome/no-inexact-math.grit` | Biome plugin banning `**`, `**=` and `Math.pow` in rush-racers logic and allowing only the exactly specified `Math` members it lists, so lockstep races match bit for bit. |

## Room service (`apps/api/`)

The relay for online races, a separate Worker (`arcade-api`) the site forwards `/api/*` to. Design: `plans/reef-rush-multiplayer.md` section 5.5 and `plans/done/rush-racers-online.md`. Tests are in `apps/api/test/` and run the Worker in-process (`pnpm --filter @arcade/api test`).

| File | What it is |
| --- | --- |
| `apps/api/wrangler.jsonc` | The Worker: the `Room` Durable Object binding and its SQLite migration; no public route. Deployed by hand with `pnpm deploy:api`. |
| `apps/api/package.json` | `@arcade/api`: `dev` (wrangler on port 8788), `types`, `typecheck`, `test`, `deploy`; exports `./protocol` to games. |
| `apps/api/tsconfig.json` | Types the Workers (`src/`) with the runtime types `wrangler types` generates; no DOM, no Node. |
| `apps/api/tsconfig.test.json` | Types the tests with Node types, never the Workers runtime's. |
| `apps/api/vitest.config.ts` | Runs `test/**/*.test.ts` in Node. |
| `apps/api/src/protocol.ts` | The room wire protocol (versions, limits, close codes, room codes and `isRoomCode`, schemas), also imported by games as `@arcade/api/protocol`. |
| `apps/api/src/index.ts` | The Worker's fetch: origin check, `POST /api/rooms`, WebSocket upgrade routing to a `Room`. |
| `apps/api/src/origin.ts` | `allowedOrigin`: which pages may use the service. |
| `apps/api/src/codes.ts` | `randomRoomCode`. |
| `apps/api/src/routes.ts` | The Worker's routes: `createRoom` (claims a code), `joinRoom` (hands the upgrade to the `Room`), 404 JSON. |
| `apps/api/src/quota.ts` | Classifies account quota errors from Durable Objects. |
| `apps/api/src/room.ts` | The `Room` Durable Object: claim, join, relay, race phase, kick, limits, idle alarm. |
| `apps/api/src/peers.ts` | The room's peers read from socket attachments: host, phase, join order, and `joinRefusal`. |
| `apps/api/src/traffic.ts` | The room's only in-memory state: per-peer heard times and message rates; `kickSilenceMs`. |
| `apps/api/src/incoming.ts` | Reading a peer's message: its byte size and whether it is relayable JSON. |
| `apps/api/src/sockets.ts` | WebSocket helpers: upgrade response, refusing a socket, replying to a close, sending without throwing. |
| `apps/api/src/forward.ts` | The site Worker's script: forwards `/api/*` to the API Worker through the service binding; a 503 JSON error when the binding throws. |
| `apps/api/test/room-kit.ts` | Test kit: starts the real Worker in-process through wrangler, creates rooms over HTTP, opens real WebSockets; waits on events with deadlines. |
| `apps/api/test/rooms.test.ts` | Creating and joining rooms: codes, the origin rule, every refusal. |
| `apps/api/test/failing-room.mjs` | Worker fixture that runs the real routes against a Room binding that throws. |
| `apps/api/test/quota.test.ts` | Account quota, object overload and unrelated error messages. |
| `apps/api/test/relay.test.ts` | What the room passes between peers, and how start, end and departures move its phase and host. |
| `apps/api/test/kick.test.ts` | When the room honours a `kick`: only between racers, only after the silence window. |
| `apps/api/test/limits.test.ts` | The size and rate limits. |
| `apps/api/test/forward.test.ts` | The site's `/api/*` script: passing responses through, and the 503 when the binding throws. |

## Landing page (`apps/site/`)

| Path | What it is |
| --- | --- |
| `apps/site/vite.config.ts` | Build plus a plugin that renders the select screen (featured game, cartridge shelf, game data as JSON) from `games/*/game.json` (filtered by `ARCADE_INCLUDE`); in dev it also serves each game's `public/` media. |
| `apps/site/index.html` | Landing page template: the cabinet (marquee, CRT screen, control deck). |
| `apps/site/404.html` | Not-found page Cloudflare serves, a game-over screen. |
| `apps/site/src/style.css` | Site styles: physical cabinet around a pixel-crisp CRT screen, dark only, self-hosted pixel fonts (`@fontsource`). |
| `apps/site/src/pixel.ts` | Build-time pixel art: the 5x7 font (`GLYPHS`), the marquee lettering (`pixelLogo`) and input icons (`pixelIcon`) as SVG. |
| `apps/site/src/sfx.ts` | Square-wave UI sounds via WebAudio, off until the player turns them on. |
| `apps/site/src/favicon.svg` | Favicon: the invader mark on ink. Written by `apps/site/src/brand.ts`. |
| `apps/site/src/brand.ts` | Brand pack generator (`pnpm --filter @arcade/site brand`, needs `rsvg-convert`): the invader mark, wordmark, lockup and 1200x630 link-preview image as SVG and PNG into `apps/site/public/brand/`, plus the favicon and `apple-touch-icon.png`. Output is committed. |
| `apps/site/public/brand/` | The brand pack (see its `README.md`). `og-image.png` is the page's `og:image`. |
| `apps/site/src/select.ts` | Select screen behaviour: selection and gameplay loop, keyboard, gamepad, deck buttons, sound, saved-progress detection, idle cycling, launch transition. |

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
| `templates/phaser-2d/src/logic/hash.ts`, `templates/phaser-2d/src/logic/hash.test.ts` | `hashWorld`: the world hash without the level and event log. |
| `templates/phaser-2d/src/engine/game.ts` | `startPhaser`: Boot, Title and Play scenes, the logic clock fed from Phaser's STEP event, the `GameHandle`. |
| `templates/phaser-2d/src/engine/runtime.ts` | Phaser-free `Runtime`: scene flow, title menu, in-order save write queue, per-tick logic step; `idle()` is false while a scene loads or a save is written. |
| `templates/phaser-2d/src/engine/runtime.test.ts` | Vitest test of the runtime: start, play to a coin, save order, restore, capture stage gate, loading guard, failed writes. |
| `templates/phaser-2d/src/engine/debug.ts` | `debugSummary()` and `debugState()`, both with `worldHash`. |
| `templates/phaser-2d/src/engine/capture-stages.ts` | `?stage=` capture stages (`near-goal`), only with `?debug=1` or in test mode; a staged run is never saved. |
| `templates/phaser-2d/src/engine/input.ts` | Action names, key bindings, touch layout. |
| `templates/phaser-2d/src/engine/textures.ts` | `Tex` keys and placeholder textures drawn at boot. |
| `templates/phaser-2d/scenarios/kit.ts` | The game's typed `scenario`, `hold`, `tap`, `wait`, and presets (`TITLE_TO_PLAY`, `TWO_COINS_SAVE`). |
| `templates/phaser-2d/scenarios/collect-first-coin.ts` | Scenario: walk right and collect a coin. |
| `templates/phaser-2d/scenarios/complete-level.ts` | Scenario: finish the level. |
| `templates/phaser-2d/scenarios/restore-save.ts` | Scenario: start from a save fixture. |
| `templates/phaser-2d/scenarios/near-goal-stage.ts` | Scenario: the `near-goal` capture stage, and that it writes no save. |
| `templates/phaser-2d/tests/smoke.spec.ts` | Loads, WebGL renderer, save survives reload, touch controls (`@touch`), and a pinned `worldHash` every browser project agrees on. |
| `templates/phaser-2d/tests/scenarios.spec.ts` | Turns every scenario into a Playwright test. |
| `templates/phaser-2d/tests/save.test.ts`, `templates/phaser-2d/tests/fixtures/save-v1.json` | Every committed save version must still load. |

The 3D template (`templates/three-3d/`) has the same files with these differences:

| Path | What it is |
| --- | --- |
| `templates/three-3d/src/main.ts` | Boot with `startThree`. |
| `templates/three-3d/src/logic/world.ts` | Arena, orbs, player movement; `ARENA`, `ORB_COUNT`. No `toAscii`. |
| `templates/three-3d/src/logic/events.ts` | `GameEvent` union. |
| `templates/three-3d/src/logic/hash.ts`, `templates/three-3d/src/logic/hash.test.ts` | `hashWorld`: the world hash without the event log. |
| `templates/three-3d/src/logic/save.ts` | Save shape (seed, collected orbs). |
| `templates/three-3d/src/engine/game.ts` | `startThree`: renderer, rAF loop (off in test mode), lazy physics, `GameHandle` (`idle()` waits for physics and save writes, `worldHash` in debug state). |
| `templates/three-3d/src/engine/runtime.ts` | Three- and Rapier-free `Runtime`: `FixedStep` tick, orb autosave queue (`saving`, `settled()`, one `failWrite` that emits `save.failed`), `loadSave`. |
| `templates/three-3d/src/engine/runtime.test.ts` | Vitest test of the runtime: collect, autosave, restore, staged runs never save, failed and thrown writes. |
| `templates/three-3d/src/engine/world-view.ts` | `createWorldView`: meshes for arena, player, orbs and crates, synced from logic state. |
| `templates/three-3d/src/engine/capture-stages.ts` | `?stage=` capture stages (`nearly-cleared`), only with `?debug=1` or in test mode; a staged run is never saved. |
| `templates/three-3d/src/engine/physics.ts` | Lazy Rapier: `loadPhysics`, kinematic player, `CRATE_SPAWNS`. `idle()` is false until it loads. |
| `templates/three-3d/src/engine/camera-rig.ts` | `CameraRig`: follow camera smoothed per tick. |
| `templates/three-3d/src/engine/input.ts` | Actions, keys, touch layout. |
| `templates/three-3d/scenarios/kit.ts` | Typed scenario kit and presets shared by scenarios. |
| `templates/three-3d/scenarios/nearly-cleared.ts` | Scenario: the `nearly-cleared` capture stage, and that it writes no save. |
| `templates/three-3d/scenarios/collect-first-orb.ts` | Scenario: walk to the first orb. |
| `templates/three-3d/scenarios/push-crate.ts` | Scenario: Rapier pushes a crate. |
| `templates/three-3d/scenarios/restore-save.ts` | Scenario: start from a save fixture. |

Games in `games/` follow the same layout. Their own `DESIGN.md` is the map for anything game-specific; Rush Racers also has a `MAP.md` of its folders.
