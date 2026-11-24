# Plan: refactor audit follow-through

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.3/shared/scripts/plan_graph.py
Started: 2026-11-23 21:50. Timebox: none. Landing branch: deliver/refactor-audit.
Gate: `pnpm arcade check --all && pnpm arcade smoke` plus `pnpm --filter game-rush-racers test:difficulty` when logic or balance code changed (check 24s cached; smoke and difficulty several minutes). Filtered tests: `pnpm arcade test rush-racers <paths>` for the game, `pnpm --filter <pkg> exec vitest run <files>` for packages and tools. Typecheck: `pnpm arcade check rush-racers --skip-tests` (or `pnpm arcade check --all --skip-tests` for package changes).
Runner: plain commands; `rr suite -- rush-racers` offloads the full game suite when this machine is busy.
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline --reporter=silent`.
Suppressions: biome-ignore
Manifests:

## Spec

Act on the 2026-11-23 audit of the arcade monorepo: close guardrail holes that let broken changes through, remove copy-paste that has a stable shape, give every world one home in the engine, load only the art a race needs, carry Rush Racers' better patterns into the shared packages and templates, and make the docs match the code. Users are the agents who build games here; players see only faster boot.

In scope:
- CI on main never cancels a push's run; PR runs still cancel superseded ones.
- Biome bans on package internals apply in logic folders too; cross-game imports are caught by a test that resolves import paths, since a relative glob can't express them.
- A test proves each lint ban fires and a near miss passes.
- `arcade test <slug>` runs the game's fast project by default; an explicit file or `--project` opts out.
- `arcade smoke` kills `wrangler dev` on SIGINT/SIGTERM; `run()` resolves code 1 when the binary can't start; `attract` removes its temp dir on failure; `driver.problems()` reports a failed page evaluate as a problem.
- Turbo cache inputs for the CLI tests cover every path the repo map and guardrail tests read.
- Stop hook runs `arcade check --skip-tests`.
- `.vitest/` and `coverage/` ignored.
- Production builds ship no sourcemaps (user decision).
- `HARD_SAVE` and other inline saves built from `SAVE_VERSION`/`NEW_GAME`.
- Logic DRY: pilot kit for swim/drift, shared media test kit, nav/num helpers, Easy bar helpers, `difficulty/` renamed `balance/` with consistent file names and a matrix-completeness test, dead and needlessly exported symbols.
- Engine: Reef's art lives in `worlds/reef/` like the other worlds; hazard art moves from themes into world skins; skin conformance tests become one `describe.each`; copied helpers (`rows`, `mirrored`, `framesOf`, identity frame maps) go to one place; dead code removed; Phaser-free screen state in `engine/screens/`, set-piece views in `view/set-pieces/`, `debug-stage.ts` renamed `capture-stages.ts`.
- Boot builds the UI kit plus the art for the menu course and the session course (they differ with `?course=`); a world's art is loaded before any screen shows it (course pick, select, results), all worlds load on entering an online room so a guest never waits mid-race, and each world's and theme's art is a separate chunk loaded by dynamic import.
- Shared tooling: one `freePort`, one game-session opener for `see`/`attract`, one Chromium flag list, one manifest lister, `GameDriver.touch`, `describeSaveFixtures`, `defineGameConfig` that spreads overrides and takes a slow-test glob, `extraWebServers` in `gamePlaywrightConfig`, generic `hashState` in `@arcade/core`, build id excludes `src/net/transport/`.
- Templates: runtime split from the engine, world hash in `debugState` with a cross-browser smoke check, a capture-stage stub, scenario navigation presets.
- Docs: every incorrect statement from the audit fixed, finished plans moved to `plans/done/` with Status lines, a game file map checked by a test, missing recipes (item, enemy, set piece, online/net), DESIGN.md trimmed to current behaviour, one owner per fact.

Out of scope: texture atlas packing (per-world loading cuts boot uploads first; atlas changes every frame lookup and is worth measuring after), Git LFS for attract video (user decision: leave as is), API deploy automation (separate `api-deploy` branch exists), online test real-time pacing redesign, engine or tooling upgrades, gameplay or balance changes.
Assumptions: behaviour and `hashWorld` stay bit-identical through every refactor (the top-route hash pin and smoke hash are the guard); texture key strings stay the same so saves, tests and debug captures keep working; `difficulty-level.ts` keeps its name (it's game code, the folder is test-only).
Error model: tooling fails loudly with the command and cause (non-zero exit, message naming the file or binary); tests fail with a message naming the offending file and import; the world-art loader rejects with an Error naming the world id (the realistic case is a hashed chunk that 404s after a redeploy in a tab opened before it), which is reported through the shell's error capture and shown on screen as a reload prompt instead of a stuck menu; the next attempt retries the import; `idle()` is false while art loads so test drivers wait.

## Contracts (scaffold commit)

Phase 1 adds no shared modules. New files:

    tools/arcade/src/guardrails.test.ts     lint bans fire (biome on stdin probes) and no game or template import resolves into another game or template

Later phases add (stubbed in their own scaffold):

    games/rush-racers/src/logic/media/pilot-kit.ts    stuck detection, recovery and wobble shared by the swim and drift pilots
    games/rush-racers/src/logic/media/test-kit.ts     bare-racer stepping and lane worlds for media tests
    games/rush-racers/src/logic/balance/              renamed from difficulty/ (test-only bars and bots)
    games/rush-racers/src/engine/screens/             Phaser-free screen state (menu, character select, how to play)
    games/rush-racers/src/engine/view/set-pieces/     wells, rings, lightning, storm reach views
    games/rush-racers/src/engine/worlds/load.ts       builds a world's skin and theme textures on demand; the only caller of dynamic world imports
    packages/core/src/hash.ts                         hashState(value, { skipKeys }): FNV-1a structural hash
    packages/testing/src/session.ts                   openGameSession for see and attract
    packages/testing/src/save-fixtures.ts             describeSaveFixtures
    games/rush-racers/MAP.md                          where things live in the game, checked by a test

## Phases

### Phase 1: guardrails that catch what they claim to

Demo: `pnpm --filter @arcade/cli exec vitest run src/guardrails.test.ts src/test.test.ts` passes, and the logic-internals probe fails against the `biome.json` on main; `pnpm arcade test rush-racers src/logic` reports no `[difficulty]` files.
Test cases:
- engine file importing `@arcade/core/src/rng` is flagged.
- logic file importing `@arcade/core/src/rng` is flagged (the bug).
- logic file importing `phaser` is flagged; logic file calling `Math.random()` is flagged.
- logic file importing `@arcade/core` (entry) is not flagged (near miss).
- engine file importing `phaser` is not flagged (near miss).
- every import specifier in `games/*/src`, `games/*/scenarios`, `games/*/tests`, `templates/*/{src,scenarios,tests}` that is relative resolves inside its own game or template folder, or into `packages/`/`apps/` only through a package name; a planted bad import in a fixture string is reported with file and specifier.
- `arcade test` vitest args: no filters → `--project unit` added when the game's `test` script names `--project unit`; folder filter → project added; explicit `.test.ts`/`.spec.ts` file filter → no project added; `--project difficulty` (CLI option) passed through and no default added; a `@group` declared as `{ "project": "difficulty", "paths": [...] }` expands to its paths plus `--project difficulty` and no default; a plain-array group behaves as before; game with no `--project` in its test script → nothing added.
- `pnpm arcade test rush-racers @bars` runs the difficulty bars (not "No test ran").
- `run()` with a missing binary resolves `{ code: 1 }` with output naming the command.
- `driver.problems()` on an open page whose evaluate rejects reports a `game-error`-kind problem saying the errors could not be read; on a page the test closed itself (`page.isClosed()`), it reports nothing for the page and keeps the problems already collected (`tests/online-leave.spec.ts` closes the guest page on purpose).

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | biome.json, turbo.json, tools/arcade/src/guardrails.test.ts | tools/biome/no-nondeterminism.grit, tools/arcade/src/repo-map.test.ts | tools/arcade/src/guardrails.test.ts | opus | pending | | guardrails tests pass and fail when the logic override's patterns are removed |
| b | M | tools/arcade/src/cli.ts, games/rush-racers/package.json, tools/arcade/src/test.ts, tools/arcade/src/test.test.ts, tools/arcade/src/smoke.ts, tools/arcade/src/run.ts, tools/arcade/src/run.test.ts, tools/arcade/src/attract.ts, packages/testing/src/driver.ts | tools/arcade/src/games.ts | tools/arcade/src/test.test.ts, tools/arcade/src/run.test.ts | sonnet | pending | | test and run tests pass, typecheck clean |

Inline (me): `.github/workflows/ci.yml` concurrency, `.claude/hooks/check-on-stop.ts` `--skip-tests`, `.gitignore`, `packages/config/src/vite.ts` `sourcemap: false`, `games/rush-racers/scenarios/kit.ts` `HARD_SAVE` and the other inline saves in `scenarios/course-select.ts`, `tests/course.spec.ts`.

#### Lane a brief

- Goal: make the import bans in `biome.json` actually fire everywhere they claim to, replace the cross-game relative glob (which can't match a real import) with a test that resolves import paths, and prove every ban with a test.
- Interface: new `tools/arcade/src/guardrails.test.ts` (Vitest, Node). Lint probes run `pnpm exec biome lint --stdin-file-path=<virtual repo path>` from the repo root (`ROOT` from `./games.ts`) with the probe source on stdin and assert on exit code and the diagnostic text. If Biome turns out not to apply `overrides` to stdin paths, copy `biome.json` and `tools/biome/` into a temp dir inside the repo's ignored `.arcade/` folder, write probes at matching paths there, lint that dir, and remove it in `afterAll`; report which you used.
- Behavior:
  - In `biome.json`, the logic/net override's `noRestrictedImports` must carry the `@arcade/*/src` internals pattern in addition to its `paths` (Biome replaces the option object per override rather than merging it).
  - Delete the `../../games/*` / `../../../games/*` / `../../templates/*` pattern group; the import test replaces it.
  - Import-boundary test: collect `.ts` files under `games/*/{src,scenarios,tests}` and `templates/*/{src,scenarios,tests}` (skip `node_modules`), extract static and dynamic import specifiers with a regex over `from '...'`, `import('...')` and `import '...'`, resolve relative ones against the file's folder, and fail when the resolved path is outside the file's own game or template folder. Bare specifiers are allowed. Failure message lists each `file: specifier -> resolved`. Also include a pure unit case that runs the checker function on an in-memory fake file list, so the test can be seen to fail without planting a bad file.
  - Lint probe rows: the test cases listed in phase 1 above, one `it` per row, named for the behaviour.
  - `turbo.json` `@arcade/cli#test` inputs add `$TURBO_ROOT$/biome.json`, `$TURBO_ROOT$/tools/biome/**`, `$TURBO_ROOT$/games/*/src/**`, `$TURBO_ROOT$/games/*/scenarios/**`, `$TURBO_ROOT$/games/*/tests/**`, `$TURBO_ROOT$/templates/*/tests/**`, `$TURBO_ROOT$/.claude/**`, `$TURBO_ROOT$/docs/*.md`, `$TURBO_ROOT$/apps/*/test/**`, `$TURBO_ROOT$/apps/*/wrangler.jsonc`.
- Decisions already made: test file lives in tools/arcade so `arcade check` runs it; no new dependency; no new lint plugin.
- Out of scope: other biome rules, formatting changes, fixing any existing violation the new checks find (report them instead; I'll fix them inline).
- Done when: `pnpm --filter @arcade/cli exec vitest run src/guardrails.test.ts` passes; you watched the logic-internals probe fail against the current `biome.json` before fixing it; you confirmed whether the GritQL plugins run on `--stdin-file-path` input (the `Math.random` probe depends on it) and chose stdin or the temp-dir approach accordingly; `pnpm --filter @arcade/cli typecheck` clean; `pnpm exec biome lint biome.json tools/arcade/src` clean.

#### Lane b brief

- Goal: make the CLI's subprocess handling and `arcade test` scoping behave as AGENTS.md promises.
- Interface:
  - `tools/arcade/src/test.ts`: export `vitestArgs(filters: string[], testScript: string | undefined): string[]`, a pure function from expanded filters plus the game's `package.json` `scripts.test` string to the args after `vitest run`. `testGame` reads `scripts.test` and uses it. `expandGroups` accepts group values that are either a path array (as today) or `{ project: string; paths: string[] }`; the object form expands to its paths followed by `--project <project>`.
  - `tools/arcade/src/cli.ts`: add a `project` string option to `parseArgs`, passed to `testGame` as `--project <name>`; update the `test` help text.
  - `games/rush-racers/package.json`: `testGroups.bars` becomes `{ "project": "difficulty", "paths": ["src/logic/difficulty/"] }`.
  - `tools/arcade/src/run.ts`: `run()` also listens for `'error'` and resolves `{ code: 1, output: '<cmd>: <error message>' }` (plus any captured output).
  - `tools/arcade/src/smoke.ts`: register `process.once('SIGINT')` and `process.once('SIGTERM')` handlers after spawning wrangler that kill its process group (`process.kill(-pid, 'SIGTERM')`) and then exit with 130/143; remove the handlers in the existing `finally`.
  - `tools/arcade/src/attract.ts`: move the `rmSync(work, …)` into a `finally` covering everything after `mkdtempSync`.
  - `packages/testing/src/driver.ts` `problems()`: when the page is closed (`this.page.isClosed()`), skip the evaluate and return the problems already collected. When it is open and `page.evaluate` rejects, add `{ kind: 'game-error', message: 'could not read window.__arcade.errors: <reason>' }` instead of returning an empty list.
- Behavior (`vitestArgs`): the test cases listed in phase 1 above. A filter counts as an explicit file when it ends in `.test.ts` or `.spec.ts`. `--project <name>` (two args) and `--project=<name>` both count as explicit. The default project is the value after `--project` in the test script, if present. Filters keep their order; the default `--project <name>` is appended at the end.
- Decisions already made: no new dependencies; keep the one-line success output of `arcade test`.
- Out of scope: `freePort` dedupe, see/attract session sharing (phase 6), smoke output format.
- Done when: `pnpm --filter @arcade/cli exec vitest run src/test.test.ts src/run.test.ts` passes (write `run.test.ts` with the missing-binary case and one success case running `node -e`), `pnpm --filter @arcade/cli typecheck` and `pnpm --filter @arcade/testing typecheck` clean.

### Phase 2: logic copy-paste removed, balance folder named for what it is

Demo: `pnpm arcade test rush-racers @media @courses src/logic/balance/sanity` passes; `pnpm arcade test rush-racers src/logic/top-route.test.ts` keeps the pinned hash; `ls src/logic/balance` shows one naming scheme.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/media/pilot-kit.ts, games/rush-racers/src/logic/media/swim/pilot.ts, games/rush-racers/src/logic/media/drift/pilot.ts, games/rush-racers/src/logic/media/swim/nav.ts, games/rush-racers/src/logic/media/flight/nav.ts, games/rush-racers/src/logic/media/drift/nav.ts, games/rush-racers/src/logic/race/flowfield.ts, games/rush-racers/src/logic/num.ts, games/rush-racers/src/logic/num.test.ts, games/rush-racers/src/logic/media/flight/physics.ts, games/rush-racers/src/logic/media/run/physics.ts, games/rush-racers/src/logic/media/swim/physics.ts, games/rush-racers/src/logic/conformance/glide.ts, games/rush-racers/src/logic/characters.ts, games/rush-racers/src/logic/characters.test.ts, games/rush-racers/src/net/messages.ts, games/rush-racers/src/net/lobby.ts, games/rush-racers/src/logic/hazards/enemies/contact.ts, games/rush-racers/src/logic/ai/avoid.ts, games/rush-racers/src/logic/media/run/tuning.ts, games/rush-racers/src/logic/media/run/respawn.ts, games/rush-racers/src/logic/media/flight/way.ts, games/rush-racers/src/logic/surface.test.ts, games/rush-racers/src/logic/media/swim/surface.test.ts | | | opus | pending | | |
| b | M | games/rush-racers/src/logic/media/test-kit.ts, games/rush-racers/src/logic/media/flight/test-kit.ts, games/rush-racers/src/logic/media/drift/test-kit.ts, games/rush-racers/src/logic/media/run/physics.test.ts, games/rush-racers/src/logic/media/run/respawn.test.ts | | | sonnet | pending | | |
| c | M | games/rush-racers/src/logic/difficulty/, games/rush-racers/src/logic/balance/, games/rush-racers/vite.config.ts, games/rush-racers/package.json | | | sonnet | pending | | |

### Phase 3: Reef's art lives in its world folder

Demo: `ls src/engine/worlds/reef` matches the other worlds; `pnpm arcade test rush-racers @worlds src/engine/themes src/engine/art` passes; a reef race captured with `arcade see` matches a baseline taken on the phase base via `--compare`.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/reef/, games/rush-racers/src/engine/worlds/reef.ts, games/rush-racers/src/engine/worlds/object-skin.ts, games/rush-racers/src/engine/worlds/thornwood/, games/rush-racers/src/engine/worlds/farside/, games/rush-racers/src/engine/worlds/cloudreach/, games/rush-racers/src/engine/art/, games/rush-racers/src/engine/themes/ocean.test.ts | | | opus | pending | | |

Scaffold does the file moves (`git mv` of Reef's sprite and portrait files into `worlds/reef/`, imports rewritten); the lane gives Reef its own keys and `registerTextures`, a default glint alpha in `object-skin.ts`, and deletes the dead HUD marker art.

### Phase 4: hazard art in world skins, one skin conformance suite, engine folders

Demo: `pnpm arcade test rush-racers @engine` passes; `src/engine` root lists only wiring and runtime files; theme files name no world nouns.
Depends on: phase 3

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/themes/, games/rush-racers/src/engine/worlds/types.ts, games/rush-racers/src/engine/worlds/reef/objects.ts, games/rush-racers/src/engine/worlds/thornwood/objects.ts, games/rush-racers/src/engine/worlds/farside/objects.ts, games/rush-racers/src/engine/worlds/cloudreach/objects.ts, games/rush-racers/src/engine/worlds/reef/sprites/hazards.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/hazards.ts, games/rush-racers/src/engine/worlds/farside/sprites/hazards.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/hazards.ts, games/rush-racers/src/engine/scenes/race.ts | | | opus | pending | | |
| b | M | games/rush-racers/src/engine/worlds/skins.test.ts, games/rush-racers/src/engine/worlds/thornwood/cast.test.ts, games/rush-racers/src/engine/worlds/thornwood/objects.test.ts, games/rush-racers/src/engine/worlds/farside/cast.test.ts, games/rush-racers/src/engine/worlds/farside/objects.test.ts, games/rush-racers/src/engine/worlds/cloudreach/cast.test.ts, games/rush-racers/src/engine/worlds/cloudreach/objects.test.ts, games/rush-racers/src/engine/worlds/thornwood.test.ts | | | sonnet | pending | | |

Scaffold (me, before dispatch): helper dedupe (`transposeRows` and `mirrored` into `art/rows.ts`, `framesOf` into `art/sprites/sheet.ts`, `bySlot`/`byItem` for identity frame maps), `owner.ts` folded into `keys.ts`. After both lanes merge (me, before tag): folder moves with importers rewritten (`screens/` for menu, character select and how-to-play state; `view/set-pieces/`; `debug-stage.ts` → `capture-stages.ts`), `fx/surface-effects.test.ts` renamed, `well-view` unused parameter and `FriendsOption` removed, needless engine exports dropped.

### Phase 5: world and theme modules split into data and art

Demo: `pnpm arcade test rush-racers @engine` passes; no module under `worlds/` or `themes/` outside `*/art.ts` imports a sprite sheet (checked by a test); `pnpm arcade smoke rush-racers` passes with boot still building everything.
Depends on: phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/, games/rush-racers/src/engine/themes/ | | | opus | pending | | |

Each world and theme keeps its synchronous data (keys, frame names, ability and item words, glints, terrain, backdrop specs) in its wiring module, and moves everything that draws (sheet imports, `registerTextures`) into `worlds/<id>/art.ts` and `themes/<id>/art.ts`, each exporting one `registerArt(scene)`. Boot still calls all of them, so behaviour is unchanged.

### Phase 6: load only the art a screen needs

Demo: boot's texture count (new `textures` field in `debugSummary`) drops to the UI kit plus the menu course's world and theme; `vite build` emits one chunk per world and theme; `pnpm arcade smoke rush-racers` passes.
Depends on: phase 5
Test cases (written in phase 5): `ensureCourseArt` loads a world's and theme's art once, concurrent calls share one load, a failed import rejects naming the world and a later call retries; boot with `?course=bramble-run` and a save whose last course is Sunlit shows both worlds' art on title and select; picking a course of an unloaded world reaches select with that world's cast textures present; `idle()` is false until the art is in; entering an online room loads every world before the room can start a race; a failed load shows a "couldn't load, reload the page" message on screen and reports a game error.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/load.ts, games/rush-racers/src/engine/worlds/load.test.ts, games/rush-racers/src/engine/worlds/index.ts, games/rush-racers/src/engine/themes/index.ts, games/rush-racers/src/engine/scenes/, games/rush-racers/src/engine/runtime.ts, games/rush-racers/src/engine/runtime.test.ts, games/rush-racers/src/engine/online/flow.ts, games/rush-racers/src/engine/debug.ts, games/rush-racers/src/engine/game.ts, games/rush-racers/tests/boot-art.spec.ts | | | opus | pending | | |

### Phase 7: shared tooling and config

Demo: `pnpm arcade check --all` passes; `see` and `attract` share `openGameSession`; Rush Racers' `vite.config.ts` has no cast.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/testing/src/, tools/arcade/src/see.ts, tools/arcade/src/attract.ts, tools/arcade/src/smoke.ts, games/rush-racers/tests/smoke.spec.ts, games/rush-racers/tests/hints.spec.ts, games/rush-racers/tests/save.test.ts, games/rush-racers/playwright.config.ts | | | opus | pending | | |
| b | M | packages/config/src/, tools/arcade/src/games.ts, apps/site/vite.config.ts, games/rush-racers/vite.config.ts | | | sonnet | pending | | |
| c | S | packages/core/src/, games/rush-racers/src/logic/hash.ts | | | sonnet | pending | | |

### Phase 8: templates start where Rush Racers ended

Demo: `pnpm arcade check --all`, `pnpm arcade smoke phaser-2d` and `pnpm arcade smoke three-3d` pass; each template's smoke asserts one world hash across projects.
Depends on: phase 7

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | templates/phaser-2d/ | | | opus | pending | | |
| b | M | templates/three-3d/ | | | sonnet | pending | | |

### Phase 9: docs match the code

Demo: `pnpm --filter @arcade/cli exec vitest run src/repo-map.test.ts` and the game map test pass; every audit doc finding is fixed.
Depends on: phase 6, phase 8

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | AGENTS.md, README.md, docs/, .claude/skills/, .claude/rules/, .claude/agents/, plans/done/ | | | opus | pending | | |
| b | M | games/rush-racers/DESIGN.md, games/rush-racers/COURSES.md, games/rush-racers/UI.md, games/rush-racers/MAP.md, games/rush-racers/src/map.test.ts | | | opus | pending | | |

## Log

- 2026-11-23: user chose: finished plans move to `plans/done/`; attract video left in plain git; production sourcemaps dropped; template adoption included.
- 2026-11-23: plan critique applied: `--project` CLI option and project-carrying `@bars` group (cli parseArgs is strict); `problems()` skips closed pages (online-leave closes the guest); phase 3 split so lanes never share art/ or worlds/reef; folder moves done in scaffolds with importers; lazy loading split into a data/art phase and a loader phase that covers menu course, session course, course pick and online rooms, with a chunk-404 failure path and a texture counter in debugSummary.
- 2026-11-23: user pre-approved the merge: "When done, merge to main. Clean up". Merge locally, remove worktrees; no push.
