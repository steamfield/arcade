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

Scaffold: 06d6153ed0f3
Tag: refactor-audit/phase-1
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
| a | M | biome.json, turbo.json, tools/arcade/src/guardrails.test.ts | tools/biome/no-nondeterminism.grit, tools/arcade/src/repo-map.test.ts | tools/arcade/src/guardrails.test.ts | opus | merged | deliver/refactor-audit-1a | guardrails tests pass and fail when the logic override's patterns are removed |
| b | M | tools/arcade/src/cli.ts, games/rush-racers/package.json, tools/arcade/src/test.ts, tools/arcade/src/test.test.ts, tools/arcade/src/smoke.ts, tools/arcade/src/run.ts, tools/arcade/src/run.test.ts, tools/arcade/src/attract.ts, packages/testing/src/driver.ts, packages/testing/src/driver.test.ts | tools/arcade/src/games.ts | tools/arcade/src/test.test.ts, tools/arcade/src/run.test.ts | sonnet | merged | deliver/refactor-audit-1b | test and run tests pass, typecheck clean |

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

Scaffold: de34f7deeef4 (no contracts: lanes refactor behind unchanged interfaces)
Tag: refactor-audit/phase-2

Demo: `pnpm arcade test rush-racers @media @courses src/logic/balance/sanity` passes; `pnpm arcade test rush-racers src/logic/top-route.test.ts` keeps the pinned hash; `ls src/logic/balance` shows one naming scheme.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/media/pilot-kit.ts, games/rush-racers/src/logic/media/swim/pilot.ts, games/rush-racers/src/logic/media/drift/pilot.ts, games/rush-racers/src/logic/media/swim/nav.ts, games/rush-racers/src/logic/media/flight/nav.ts, games/rush-racers/src/logic/media/drift/nav.ts, games/rush-racers/src/logic/race/flowfield.ts, games/rush-racers/src/logic/num.ts, games/rush-racers/src/logic/num.test.ts, games/rush-racers/src/logic/media/flight/physics.ts, games/rush-racers/src/logic/media/run/physics.ts, games/rush-racers/src/logic/media/swim/physics.ts, games/rush-racers/src/logic/conformance/glide.ts, games/rush-racers/src/logic/characters.ts, games/rush-racers/src/logic/characters.test.ts, games/rush-racers/src/net/messages.ts, games/rush-racers/src/net/lobby.ts, games/rush-racers/src/logic/hazards/enemies/contact.ts, games/rush-racers/src/logic/ai/avoid.ts, games/rush-racers/src/logic/media/run/tuning.ts, games/rush-racers/src/logic/media/run/respawn.ts, games/rush-racers/src/logic/media/flight/way.ts, games/rush-racers/src/logic/surface.test.ts, games/rush-racers/src/logic/media/swim/surface.test.ts | | | opus | merged | deliver/refactor-audit-2a | |
| b | M | games/rush-racers/src/logic/media/test-kit.ts, games/rush-racers/src/logic/media/flight/test-kit.ts, games/rush-racers/src/logic/media/drift/test-kit.ts, games/rush-racers/src/logic/media/run/physics.test.ts, games/rush-racers/src/logic/media/run/respawn.test.ts | | | sonnet | merged | deliver/refactor-audit-2b | |
| c | M | games/rush-racers/src/logic/difficulty/, games/rush-racers/src/logic/balance/, games/rush-racers/vite.config.ts, games/rush-racers/package.json | | | sonnet | merged | deliver/refactor-audit-2c | |

Test cases: behaviour is unchanged, so the guard is the existing suite: `src/logic/top-route.test.ts` (pinned hash), `@media`, `@courses`, `src/logic/two-peers.test.ts`, the media conformance tests, plus the new matrix test in lane c and `num.test.ts` rows for each helper moved into `num.ts`.

#### Lane 2a brief

- Goal: remove the copy-paste between the swim and drift pilots and the small helpers repeated across media and nav, and drop dead or needless exports in the logic and net files listed, without changing any race.
- Interface:
  - New `src/logic/media/pilot-kit.ts`: the helpers byte-identical in `media/swim/pilot.ts` and `media/drift/pilot.ts` (`canRecover`, `recoveryMove`, `stepWobble`, `sidewaysFrom`, `hasDashToSpend`) and the shared constants (`DASH_RESERVE`, `LOOKAHEAD_TILES`, `RECOVER_TICKS`, `RESERVE_WAIVED_BEHIND`, `STUCK_SPEED`, `STUCK_TICKS`, `WOBBLE_STEP`, `DARK_STEERING`), typed on a structural memory `{ stuckTicks; recoverTicks; recoverSide; wobble }` (use the real field names). Run's and flight's pilots stay as they are.
  - `race/flowfield.ts`: one `alongCost(...)` replacing swim's `currentCost` and flight/drift's `windCost` (same shape, different constants passed in), and one `unreachableStarts(...)` replacing the three "every start reaches the finish" checks in `swim/nav.ts`, `flight/nav.ts`, `drift/nav.ts` (message passed in so each keeps its wording).
  - `num.ts`: `approach` (flight/run physics), `clamp` (run physics), `unit` (swim physics, conformance/glide) moved here, each with a `num.test.ts` row.
  - Dead exports: delete `GameMessage` and make `GameMessageSchema` module-private if only used there (`net/messages.ts`); drop `export` from symbols used only in their own file in the files you own (e.g. `latencyTicks` in `net/lobby.ts`, `isBonking`/`isStomping` in `hazards/enemies/contact.ts`, the two in `ai/avoid.ts`, `RUN_STOMP_BOUNCE`, `RESPAWN_RUN_UP_TILES`, `flightCost`, `flightPuffAhead`). Verify each with a repo-wide grep (games/rush-racers/src, scenarios, tests) before un-exporting.
  - `pickRivals` in `characters.ts` is used only by `characters.test.ts` as a reference for `assignCharacters`: delete it and rewrite that test to assert on `assignCharacters` behaviour directly (three distinct rivals, never the player's pick, same seed gives the same draw, different seeds can differ).
  - Move `src/logic/surface.test.ts` to `src/logic/media/swim/surface.test.ts` with imports fixed.
- Decisions already made: every refactor must keep `hashWorld` identical; floating-point expressions must stay operation-for-operation the same (no reassociation), since lockstep races compare bits.
- Out of scope: run and flight pilot internals, `wrongKind`/kind accessors (documented pattern), `types.ts` split, anything under `difficulty/` or the media test kits.
- Done when: `pnpm arcade test rush-racers src/logic/top-route.test.ts src/logic/two-peers.test.ts @media @courses src/logic/num.test.ts src/logic/characters.test.ts src/logic/media/swim/surface.test.ts` passes and `pnpm arcade check rush-racers --skip-tests` is clean.

#### Lane 2b brief

- Goal: one shared media test kit instead of the copies in flight's and drift's `test-kit.ts` and the inline helpers in run's physics and respawn tests.
- Interface: new `src/logic/media/test-kit.ts` exporting `ticksIn(seconds)`, `ticksOfRacer(...)`, `bareRacer(motion)`, `laneWorld(medium, rows, opts)` and a generic `stepBare(apply, env, ...)` (names may follow the existing ones where they already exist; keep signatures close to today's so call sites change little). `media/flight/test-kit.ts` and `media/drift/test-kit.ts` keep only what is medium-specific (`STILL_AIR`, `VACUUM`, their sample types) and re-use the shared kit; `media/run/physics.test.ts` and `media/run/respawn.test.ts` import from it instead of defining `ticksIn`, `bareRunner` and the `rivalLane` literal inline. Drop exports only used inside a kit (`FlightSample`, `DriftSample` if unused elsewhere).
- Decisions already made: test kits are test-only code; `test-kit.ts` is not a `.test.ts` file, so it is hashed into the build id like the existing kits (fine).
- Out of scope: changing what any test asserts.
- Done when: `pnpm arcade test rush-racers src/logic/media` passes and `pnpm arcade check rush-racers --skip-tests` is clean.

#### Lane 2c brief

- Goal: name the slow-bars folder for what it is, give its files one naming scheme, collapse the Easy bar copies, and add a cheap check that the bar matrix is complete.
- Interface:
  - `git mv src/logic/difficulty src/logic/balance`. Fix every import of it (grep games/rush-racers for `difficulty/`; `difficulty-level.ts` keeps its name and is not part of this).
  - Rename Sunlit Shallows' files to the scheme the other courses use: `<char>.test.ts` → `sunlit-shallows-<char>.test.ts`, `<char>-novice.test.ts` → `sunlit-shallows-<char>-novice.test.ts`, `normal-<char>.test.ts` → `sunlit-shallows-<char>-normal.test.ts`, `easy-level.test.ts`/`easy-toddler.test.ts` → `sunlit-shallows-easy-*.test.ts`.
  - Add `describeEasyToddler(courseId)` and `describeEasyLevel(courseId)` next to `describeNormal` in `normal-bars.ts` (or a new `easy-bars.ts` if `normal-bars.ts` would pass about 250 lines), and turn the four copies of each Easy file into stubs like the per-character ones. Keep each copy's per-course wording (e.g. "swimming"/"running") via a parameter or derive it from the course's medium.
  - New `src/logic/balance/sanity/files.test.ts` (runs in the unit project): for every course in `LISTED_COURSES` and every id in `CHARACTER_IDS`, the files `<course>-<char>.test.ts`, `-novice` and `-normal` exist, plus `<course>-easy-level.test.ts` and `<course>-easy-toddler.test.ts`; the failure lists every missing name.
  - `vite.config.ts`: `DIFFICULTY_BARS` glob and its comment point at `src/logic/balance/*.test.ts`.
  - `package.json`: `arcade.testGroups` paths that name `src/logic/difficulty` move to `src/logic/balance` (the `bars` group is the object form `{ "project": "difficulty", "paths": [...] }` after phase 1; keep that shape). The Vitest project stays named `difficulty` and the script `test:difficulty` keeps its name.
- Decisions already made: one file per character per bar stays (Vitest parallelises per file and CI shards them); no file generator.
- Out of scope: changing any bar's thresholds, seeds or bots; docs (phase 9 updates DESIGN.md and COURSES.md).
- Done when: `pnpm arcade test rush-racers src/logic/balance/sanity` passes; `pnpm --filter game-rush-racers exec vitest list --project difficulty --filesOnly | wc -l` shows the same file count as before the rename (record both numbers in your report); `pnpm arcade check rush-racers --skip-tests` clean. Do not run the difficulty project itself (slow); I run it at landing.

### Phase 3: Reef's art lives in its world folder

Scaffold: de34f7deeef4 (no contracts: lanes refactor behind unchanged interfaces)
Tag: refactor-audit/phase-3

Demo: `ls src/engine/worlds/reef` matches the other worlds; `pnpm arcade test rush-racers @worlds src/engine/themes src/engine/art` passes; a reef race captured with `arcade see` matches a baseline taken on the phase base via `--compare`.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/engine/worlds/reef/, games/rush-racers/src/engine/worlds/reef.ts, games/rush-racers/src/engine/worlds/object-skin.ts, games/rush-racers/src/engine/worlds/thornwood/, games/rush-racers/src/engine/worlds/farside/, games/rush-racers/src/engine/worlds/cloudreach/, games/rush-racers/src/engine/art/, games/rush-racers/src/engine/themes/ocean.test.ts | | | opus | merged | deliver/refactor-audit-3a | |

Test cases: texture key strings unchanged (`themes/ocean.test.ts` pins them); `skins.test.ts` and `assertSkinTextures` pass for Reef with art registered by `REEF_SKIN.registerTextures`; `art/` builds no Reef cast, item, pickup or enemy texture; no world folder imports another world's folder (Thornwood, Cloudreach and Farside stop importing `reef/objects.ts`); a reef race capture matches the baseline.

#### Lane 3a brief

- Goal: give Reef the same shape as the other three worlds, so "where does a world's art go" has one answer: `worlds/<id>/{keys.ts, sprites/*, cast.ts, objects.ts}`. Keep `art/` for what every world shares: the pixel engine (`pixel.ts`, `rows.ts`, `sheet.ts`), fonts, the UI kit, HUD, guide art and shared frame names.
- Interface:
  - Move Reef's pixel data out of `art/`: racers (`art/sprites/racers.ts`), enemies (`art/sprites/enemies.ts`), items/attack (`art/sprites/attack.ts`, `art/sprites/powerups.ts`), pickups (`art/sprites/pickups.ts`), portraits and heads (`art/ui/portraits.ts`), and Reef palettes (`art/palettes.ts`) into `worlds/reef/sprites/` and `worlds/reef/keys.ts`. Where another world imports a helper from one of these files today (e.g. `worldIcon` from `art/sprites/attack.ts`, sheet helpers), keep that helper in `art/` (it is shared) and move only Reef's data.
  - Reef's texture keys move from `art/keys.ts` `Tex` (and `art/ui/keys.ts` where they are cast portraits/heads/icons) into `worlds/reef/keys.ts` with the same strings. `art/keys.ts` keeps global keys and the shared `Frame` names.
  - `REEF_SKIN.registerTextures` builds Reef's textures (like `THORNWOOD_SKIN`); `art/index.ts` `buildTextures` no longer builds them. Boot order stays: global art, UI kit, themes, skins.
  - `worlds/object-skin.ts` exports the default glint alphas; Thornwood, Cloudreach and Farside `objects.ts` use them instead of reading `REEF_OBJECTS`. Fold each world's two-line `owner.ts` into its `keys.ts`.
  - Delete the dead HUD marker art: the `hud-marker` sheet (`art/sprites/hud.ts`), `RacerPalette` and `HudPalette.marker*` (`art/palettes.ts`), `Frame.marker*` (`art/keys.ts`), and their test references (`art/sprites/sprites.test.ts`, `themes/ocean.test.ts`). Grep first to confirm nothing draws them.
  - Update the header comment in `worlds/reef.ts` and `themes/types.ts` lines 1-5 (racers, pickups and power-ups are per-world skin art now). `themes/types.ts` belongs to phase 4; if you need that header changed, report it instead.
- Decisions already made: texture key strings never change; no behaviour or visual change.
- Out of scope: hazard (urchin/jelly) art in themes (phase 4), helper dedupe across worlds (phase 4 scaffold), lazy loading.
- Done when: `pnpm arcade test rush-racers @worlds src/engine/themes src/engine/art src/engine/view/hud.test.ts` passes; `pnpm arcade check rush-racers --skip-tests` clean; `pnpm arcade see rush-racers --scenario race-to-finish --at 200,600 --out .arcade/runs/3a-after` compared with `--compare` against a baseline you capture first on the scaffold commit (`--out .arcade/runs/3a-before`) shows no pixel difference; look at the frames yourself.

### Phase 4: hazard art in world skins, one skin conformance suite, engine folders

Demo: `pnpm arcade test rush-racers @engine` passes; `src/engine` root lists only wiring and runtime files; theme files name no world nouns.
Depends on: phase 3

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/themes/, games/rush-racers/src/engine/worlds/types.ts, games/rush-racers/src/engine/worlds/reef/objects.ts, games/rush-racers/src/engine/worlds/thornwood/objects.ts, games/rush-racers/src/engine/worlds/farside/objects.ts, games/rush-racers/src/engine/worlds/cloudreach/objects.ts, games/rush-racers/src/engine/worlds/reef/sprites/hazards.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/hazards.ts, games/rush-racers/src/engine/worlds/farside/sprites/hazards.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/hazards.ts, games/rush-racers/src/engine/scenes/race.ts, games/rush-racers/src/engine/view/hazard-view.ts, games/rush-racers/src/engine/view/level-view.ts, games/rush-racers/src/engine/view/hazard-view.test.ts, games/rush-racers/src/engine/view/level-view.test.ts, games/rush-racers/COURSES.md, games/rush-racers/DESIGN.md, games/rush-racers/UI.md, games/rush-racers/src/engine/art/keys.ts, games/rush-racers/src/engine/worlds/index.ts, games/rush-racers/src/engine/worlds/object-skin.ts, games/rush-racers/src/engine/worlds/reef.ts | | | opus | merged | deliver/refactor-audit-4a | |
| b | M | games/rush-racers/src/engine/worlds/skins.test.ts, games/rush-racers/src/engine/worlds/thornwood/cast.test.ts, games/rush-racers/src/engine/worlds/thornwood/objects.test.ts, games/rush-racers/src/engine/worlds/farside/cast.test.ts, games/rush-racers/src/engine/worlds/farside/objects.test.ts, games/rush-racers/src/engine/worlds/cloudreach/cast.test.ts, games/rush-racers/src/engine/worlds/cloudreach/objects.test.ts, games/rush-racers/src/engine/worlds/thornwood.test.ts, games/rush-racers/src/engine/worlds/reef/cast.test.ts, games/rush-racers/src/engine/worlds/reef/objects.test.ts, games/rush-racers/src/engine/worlds/reef/skin.test.ts, games/rush-racers/src/engine/worlds/skin-conformance.ts, games/rush-racers/src/engine/worlds/cast-conformance.ts, games/rush-racers/src/engine/worlds/object-conformance.ts, games/rush-racers/src/engine/worlds/drawn-skin.ts, games/rush-racers/src/engine/worlds/recording-scene.ts | | | sonnet | merged | deliver/refactor-audit-4b | |

Scaffold: eb621d6527d9 (shared `mirroredRows`, `transposeRows` in `art/rows.ts`; `castFrames` in `art/sprites/sheet.ts`; `bySlot`/`byItem` in `art/keys.ts`; owner names folded into keys by lane 3a)
Tag: refactor-audit/phase-4

#### Lane 4a brief

- Goal: a theme is the look of a course (terrain, backdrop, ambient, particles, dark tint, trail) and names no world's creatures; the urchin and jelly hazard art moves into each world's object skin, next to the hazard glints already there.
- Interface:
  - `ObjectSkin` (`worlds/types.ts`) gains `hazards: { urchin: HazardSkin; jelly: HazardSkin }` (move `HazardSkin` to `worlds/types.ts`; `themes/types.ts` loses `hazards` and the type). Each world's `objects.ts` fills it, and its `registerTextures` builds the sheets and animations from a new `worlds/<id>/sprites/hazards.ts` holding the pixel data now in `themes/<theme>/sprites/hazards.ts` (ocean to reef, forest to thornwood, sky to cloudreach, space to farside). Texture and animation key strings stay exactly as they are today, so nothing on screen changes; only who owns them moves (the owner label becomes the world's).
  - `view/hazard-view.ts`, `view/level-view.ts` and `scenes/race.ts` read hazards from `skin.objects.hazards` instead of `theme.hazards`. Delete `themes/*/sprites/hazards.ts` and their entries in each theme's `sprites/index.ts` and `keys.ts`.
  - Remove the `Theme.extraLayers` extension point if no theme uses it (grep first), and rewrite `themes/types.ts` lines 1-5 to say what a theme is now.
- Decisions already made: key strings never change; boot order (global art, UI kit, themes, skins) stays; no visual change. A course still pairs a theme with a world as today.
- Out of scope: the skin conformance suite (lane 4b); splitting data from art (phase 5).
- Done when: `pnpm arcade test rush-racers @worlds @engine src/engine/themes src/engine/view` passes; `pnpm arcade check rush-racers --skip-tests` clean; `pnpm arcade see rush-racers --scenario race-to-finish --at 200,400 --out .arcade/runs/4a-after --compare <baseline captured first on the scaffold commit with --out .arcade/runs/4a-before>` shows identical frames, and one capture on a Thornwood course (`--query course=bramble-run --scene play` or an existing forest scenario) looks right; `git grep -niE "urchin|jelly" -- games/rush-racers/src/engine/themes` lists no art.

#### Lane 4b brief

- Goal: one skin conformance suite run for every world instead of the near-identical `cast.test.ts`/`objects.test.ts` pairs per world.
- Interface: `worlds/skin-conformance.ts` exports `describeSkinConformance(skin)` (or a `describe.each(SKINS)` in `worlds/skins.test.ts`, whichever reads better): the structural checks the per-world files repeat today (every slot has a racer texture with run frames, a portrait and head frame per slot, an icon per item, the object keys exist and are built, frame sizes match, keys are unique across worlds, glints in range). Each world keeps a small test file only for what is truly its own (Reef's unprefixed keys, Farside's well art, and so on). Delete the per-world checks the suite now covers. `worlds/thornwood.test.ts` folds in if it is the same kind of check.
- Decisions already made: every check that exists today still runs for every world that has it today (a check that only one world had today may become universal if it holds for all; say which).
- Out of scope: changing what a check asserts; hazard art (4a moves it into skins concurrently: don't assert on `objects.hazards` yet, I add that row at landing).
- Done when: `pnpm arcade test rush-racers @worlds` passes, the per-world test files are gone or hold only world-specific rows, and your report gives test-line counts before and after and lists any check you dropped with the reason; break one check in a world's art (e.g. drop a portrait frame) to watch the suite fail for that world, then restore. `pnpm arcade check rush-racers --skip-tests` clean.

Scaffold (me, before dispatch): helper dedupe (`transposeRows` and `mirrored` into `art/rows.ts`, `framesOf` into `art/sprites/sheet.ts`, `bySlot`/`byItem` for identity frame maps), `owner.ts` folded into `keys.ts`. After both lanes merge (me, before tag): folder moves with importers rewritten (`screens/` for menu, character select and how-to-play state; `view/set-pieces/`; `debug-stage.ts` → `capture-stages.ts`), `fx/surface-effects.test.ts` renamed, `well-view` unused parameter and `FriendsOption` removed, needless engine exports dropped.

### Phase 5: world and theme modules split into data and art

Demo: `pnpm arcade test rush-racers @engine` passes; no module under `worlds/` or `themes/` outside `*/art.ts` imports a sprite sheet (checked by a test); `pnpm arcade smoke rush-racers` passes with boot still building everything.
Depends on: phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/, games/rush-racers/src/engine/themes/, games/rush-racers/COURSES.md, games/rush-racers/DESIGN.md, games/rush-racers/src/engine/art/index.test.ts, games/rush-racers/src/engine/art/sprites/sprites.test.ts, games/rush-racers/src/engine/view/hazard-view.test.ts | | | opus | running | deliver/refactor-audit-5a | |

Each world and theme keeps its synchronous data (keys, frame names, ability and item words, glints, terrain, backdrop specs) in its wiring module, and moves everything that draws (sheet imports, `registerTextures`) into `worlds/<id>/art.ts` and `themes/<id>/art.ts`, each exporting one `registerArt(scene)`. Boot still calls all of them, so behaviour is unchanged.

Scaffold: 8946cfa9ac0a (no contract commit: the brief names the interface; lane branches from phase 4's tag)

#### Lane 5a brief

- Goal: a world's or theme's data module can be imported without pulling in a single pixel row, so phase 6 can load art with `import()` per world and theme.
- Interface:
  - New `worlds/<id>/art.ts` (reef, thornwood, cloudreach, farside) and `themes/<id>/art.ts` (ocean, forest, sky, space), each exporting `registerArt(scene: Phaser.Scene): void` holding what that module's `registerTextures` does today (cast, object and hazard sheets, loops). Each world's `cast.ts`/`objects.ts` and each theme's wiring module keeps only data and stops importing `sprites/`.
  - `WorldSkin.registerTextures`, `ObjectSkin`/cast registration methods and `Theme.registerTextures` go away. `worlds/index.ts` and `themes/index.ts` keep their boot functions (same names, same order: global art, UI kit, themes, skins) and call the `registerArt` of each module through one exported map, `WORLD_ART: Record<WorldId, (scene) => void>` and `THEME_ART: Record<ThemeId, ...>`, each imported statically for now. Phase 6 swaps the static imports for `import()`.
  - Data the views need that lives under `sprites/` today (palettes read by glints or contrast bands, frame name lists) moves next to the keys (`<id>/palettes.ts` or `keys.ts`), so the rule below holds.
  - New `worlds/art-boundary.test.ts`: reads every non-test `.ts` file under `worlds/` and `themes/` and fails, naming the file and import, when a file other than `*/art.ts` or a file inside a `sprites/` folder imports from a `sprites/` path. Watch it fail by adding one such import, then restore.
  - Tests and helpers that call `registerTextures` (the conformance suites, `drawn-skin.ts`, recording scenes) call `WORLD_ART[id]`/`THEME_ART[id]` instead. `git grep registerTextures -- games/rush-racers` must be empty when you're done, including outside `worlds/` and `themes/`; if a caller outside your Owns needs a one-line change, make it and list it.
- Decisions already made: key strings, boot order and every frame unchanged; no lazy loading yet.
- Out of scope: `worlds/load.ts`, dynamic imports, `debugSummary` texture counts (phase 6).
- Done when: `pnpm arcade test rush-racers @worlds @engine src/engine/themes src/engine/view` passes; `pnpm arcade check rush-racers --skip-tests` clean; `pnpm arcade see rush-racers --scenario race-to-finish --at 200,400 --out .arcade/runs/5a-after --compare <baseline captured first on your base commit>` is identical; check-lane is ok.

### Phase 6: load only the art a screen needs

Demo: boot's texture count (new `textures` field in `debugSummary`) drops to the UI kit plus the menu course's world and theme; `vite build` emits one chunk per world and theme; `pnpm arcade smoke rush-racers` passes.
Depends on: phase 5
Test cases (written in phase 5): `ensureCourseArt` loads a world's and theme's art once, concurrent calls share one load, a failed import rejects naming the world and a later call retries; boot with `?course=bramble-run` and a save whose last course is Sunlit shows both worlds' art on title and select; picking a course of an unloaded world reaches select with that world's cast textures present; `idle()` is false until the art is in; entering an online room loads every world before the room can start a race; a failed load shows a "couldn't load, reload the page" message on screen and reports a game error.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/load.ts, games/rush-racers/src/engine/worlds/load.test.ts, games/rush-racers/src/engine/worlds/index.ts, games/rush-racers/src/engine/themes/index.ts, games/rush-racers/src/engine/scenes/, games/rush-racers/src/engine/runtime.ts, games/rush-racers/src/engine/runtime.test.ts, games/rush-racers/src/engine/online/flow.ts, games/rush-racers/src/engine/debug.ts, games/rush-racers/src/engine/game.ts, games/rush-racers/tests/boot-art.spec.ts | | | opus | pending | | |

#### Lane 6a brief

- Goal: boot builds only the UI kit, the global art and the art of the course(s) the first screen draws; any other world's and theme's art loads with `import()` the first time a screen needs it. A player never sees a missing-texture square, and a failed chunk says so on screen.
- Interface:
  - New `worlds/load.ts`: `ensureCourseArt(scene, course): Promise<void>` loads `course`'s world art and theme art (from phase 5's `WORLD_ART`/`THEME_ART`, now `Record<id, () => Promise<{ registerArt }>>` with one `import('./<id>/art.ts')` each), registers it once per id, and runs `assertSkinTextures(scene.textures, skin, scene.anims)` for that world. Concurrent calls for the same id share one promise; a failed import rejects with an `Error` naming the world or theme (cause attached) and clears its entry so a later call retries. `ensureAllArt(scene)` loads every world and theme. Export a `loadedArt()` (ids loaded) for debug.
  - Boot (`scenes/boot.ts`) awaits `ensureCourseArt` for the course(s) the title and select screens draw (`rt.course` and the menu course the title draws behind it, which can differ: `?course=bramble-run` with a save whose last course is Sunlit needs both), then goes on as today. `Runtime.loading` (already part of `idle()`) is true from the request until the art is registered, so tests and the driver wait on it.
  - Picking a course of a world not yet loaded (course select, results' Character, `?course=` race scenes) awaits `ensureCourseArt` before the select or race screen draws it; the cursor and input don't move meanwhile.
  - Entering an online room calls `ensureAllArt` before the room can start a race (a guest may race any course the host picks); the room's start stays disabled while it loads.
  - A failed load: `ctx.reportError('art', error)` and an on-screen message "Couldn't load the course art. Reload the page to try again." on the current screen; no crash, no silent fallback.
  - `debugSummary()` gains `textures: number` (count of Phaser texture keys, excluding Phaser's own `__DEFAULT`/`__MISSING`/`__WHITE`) and `art: string[]` (loaded world and theme ids).
  - `vite build` emits one chunk per world and per theme; boot's entry chunk no longer contains their sprite rows.
- Test cases (all must be written and seen failing once): the six listed under Phase 6 above, as Vitest rows in `worlds/load.test.ts` and `runtime.test.ts` where a fake loader can stand in for `import()` (concurrency, retry, error naming, idle while loading, room loads all), and `tests/boot-art.spec.ts` (Playwright, through `window.__arcade`) for the browser paths: boot texture count and `art` on title with the default save; boot with `?course=bramble-run` and a Sunlit save shows both worlds in `art`; picking a course of an unloaded world reaches select with that world's cast textures present and no console error; a failed chunk (route the chunk URL to 404 with `page.route`) shows the message and reports a game error (the fixture's game-error check must be told to expect it for that one test, in the way the testing package allows; if it can't, say so rather than suppressing it).
- Decisions already made: key strings and frames unchanged; boot order within what loads is unchanged (global, UI kit, themes, skins); determinism untouched (art loading never gates a logic tick in test mode except through `idle()`).
- Out of scope: preloading on hover, a loading spinner beyond the `idle()` gate, splitting audio.
- Done when: `pnpm arcade test rush-racers @worlds @engine src/engine/worlds/load.test.ts src/engine/runtime.test.ts` passes; `pnpm --filter game-rush-racers exec playwright test tests/boot-art.spec.ts` passes on all projects; `pnpm arcade check rush-racers --skip-tests` clean; `pnpm arcade see rush-racers --scenario race-to-finish --at 200,400 --compare <baseline captured on your base>` identical; one `see --scene title --query course=bramble-run` capture looks right; the build output lists the per-world and per-theme chunks (paste the lines in your report); check-lane ok.

### Phase 7: shared tooling and config

Scaffold: 4318c749405a (manifest-file contract in ca8685e34c14; lanes start after phase 2 landed)
Tag: refactor-audit/phase-7

Demo: `pnpm arcade check --all` passes; `see` and `attract` share `openGameSession`; Rush Racers' `vite.config.ts` has no cast.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/testing/src/, tools/arcade/src/see.ts, tools/arcade/src/attract.ts, tools/arcade/src/smoke.ts, games/rush-racers/tests/smoke.spec.ts, games/rush-racers/tests/hints.spec.ts, games/rush-racers/tests/save.test.ts, games/rush-racers/playwright.config.ts | | | opus | merged | deliver/refactor-audit-7a | |
| b | M | packages/config/src/, tools/arcade/src/games.ts, apps/site/vite.config.ts, games/rush-racers/vite.config.ts | | | sonnet | merged | deliver/refactor-audit-7b | |
| c | S | packages/core/src/, games/rush-racers/src/logic/hash.ts | | | sonnet | merged | deliver/refactor-audit-7c | |

Scaffold contract: `@arcade/config/manifest-file` exports `readManifest(gameDir)` and `readManifestsIn(parentDir)` (Node only, so browser code importing the schema never pulls in `node:fs`). Lanes 7a and 7b switch their copies of "read game.json" to it.

Files added under `packages/`, `tools/` or `apps/` need a `docs/repo-map.md` row, which no lane owns: put the row text in your report and I add it at landing.

#### Lane 7a brief

- Goal: one copy of each browser-session and port helper, shared by `see`, `attract`, `smoke` and the game Playwright configs, and the touch-hold and save-fixture test code turned into shared helpers.
- Interface:
  - `packages/testing/src/ports.ts`: `freePort()`, exported from the package. `tools/arcade/src/smoke.ts`, `packages/testing/src/playwright.ts` and `games/rush-racers/playwright.config.ts` use it instead of their own copies.
  - `CHROMIUM_ARGS` (the swiftshader and GPU-blocklist flags) exported once and used by `playwright.ts`, `see.ts` and `attract.ts`.
  - `openGameSession(...)` in `packages/testing/src/` (name the file for what it does): starts the game's Vite server in test mode, launches Chromium with `CHROMIUM_ARGS`, opens the page with the viewport, mobile and query options `see` takes, and returns the page, driver and a `close()` that stops browser and server even when a step fails. `see.ts` and `attract.ts` use it; split `attract()` so recording and ffmpeg encoding are their own functions (deferred from lane 1b).
  - `gamePlaywrightConfig(configUrl, { extraWebServers })`: extra servers a game needs (Rush Racers' API Worker), each given a free port through the environment the way the game server's port already is. `games/rush-racers/playwright.config.ts` passes its API server through it and loses its own port and server code. `playwright.ts` reads the manifest with `readManifest` from `@arcade/config/manifest-file`.
  - `GameDriver.touch(action, ticks)` (or the name that fits the driver's existing verbs): press an on-screen touch button by action name for a number of ticks, through the pointer events the copies in `games/rush-racers/tests/smoke.spec.ts` dispatch today. Those copies and any in `hints.spec.ts` use it. Templates adopt it in phase 8.
  - A save-fixture helper in `packages/testing/src/` that runs the checks `games/rush-racers/tests/save.test.ts` makes against every committed `tests/fixtures/save-v<N>.json` (each migrates to the current version and parses), so a game's `save.test.ts` becomes a few lines. Rush Racers' file uses it; templates adopt it in phase 8.
- Decisions already made: behaviour of `see`, `attract` and `smoke` output stays the same; no new dependencies.
- Out of scope: templates (phase 8), `packages/config` (lane 7b).
- Done when: `pnpm --filter @arcade/testing exec vitest run`, `pnpm --filter @arcade/cli exec vitest run src/run.test.ts src/test.test.ts`, `pnpm arcade see rush-racers --scenario race-to-finish` and `pnpm arcade see phaser-2d --scenario complete-level --mobile` work, `pnpm arcade test rush-racers tests/save.test.ts` passes, and `pnpm exec playwright test tests/smoke.spec.ts tests/hints.spec.ts --project desktop` run from `games/rush-racers` with the dev server passes (`pnpm --filter game-rush-racers exec playwright test tests/smoke.spec.ts tests/hints.spec.ts --project=desktop`); `pnpm arcade check rush-racers --skip-tests` clean. Don't run `arcade smoke`; it runs at landing.

#### Lane 7b brief

- Goal: `defineGameConfig` passes every override through and gives any game the fast/slow test split, so Rush Racers' `vite.config.ts` needs no cast and no post-processing, and the three "list game.json files" copies become one.
- Interface:
  - `defineGameConfig(configUrl, overrides, options?)`: every key of `overrides` reaches the result (unknown keys such as `define` included; known nested keys like `build`, `server`, `test` still merge as today). `options.slowTests?: { project: string; include: string[]; testTimeout?: number }` makes the Vitest config two projects, `unit` (everything else, the default) and `<project>` (the slow files); without it the config is as today. Rush Racers passes `{ project: 'difficulty', include: ['src/logic/balance/*.test.ts'] }` and keeps its unit `testTimeout`.
  - `games/rush-racers/vite.config.ts`: no `as Parameters<...>` cast, no spread after the call; `define` goes in `overrides`. Its `simulationBuildId` hashes `src/logic`, `packages/core/src` and only the `src/net` files that decide what peers simulate or send (read each file; transport and lobby UI code stay out). List in your report which `src/net` files you kept and why.
  - `tools/arcade/src/games.ts` and `apps/site/vite.config.ts` read manifests with `readManifestsIn` from `@arcade/config/manifest-file`; `packages/config/src/vite.ts` uses `readManifest` from there and keeps exporting `readManifest` for existing callers. Add `packages/config/src/manifest-file.test.ts` (folder with and without `game.json`, a schema failure naming the path) and a `test` script and Vitest dev dependency for the package if it has none (match the other packages).
- Decisions already made: the Vitest project names `unit` and `difficulty` and the script `test:difficulty` don't change; CI reads them.
- Out of scope: `packages/testing` (lane 7a).
- Done when: `pnpm --filter @arcade/config exec vitest run`, `pnpm --filter @arcade/cli exec vitest run src/games.test.ts src/repo-map.test.ts` (whichever exist), `pnpm --filter @arcade/site build`, `pnpm --filter game-rush-racers exec vitest list --project difficulty --filesOnly | wc -l` equal to before, `pnpm arcade test rush-racers src/logic/num.test.ts` and `pnpm arcade check --all --skip-tests` clean.

#### Lane 7c brief

- Goal: the generic state hasher Rush Racers uses for lockstep lives in `@arcade/core`, so the templates (phase 8) can check one world hash across browsers.
- Interface: `packages/core/src/hash.ts` exporting `hashState(value, options?: { skipKeys?: ReadonlySet<string> })`: the tagged 32-bit FNV-1a walk from `games/rush-racers/src/logic/hash.ts`, with `skipKeys` applied to the top-level object only as today. Export it from `packages/core/src/index.ts`. `games/rush-racers/src/logic/hash.ts` keeps `UNHASHED_WORLD_KEYS` and its `hashWorld` doc and calls `hashState`. Add rows to `packages/core/src/core.test.ts` (or a new `hash.test.ts` there): tags keep `[1]`, `{0: 1}` and `"1"` apart, key order doesn't change the hash, `-0`/`NaN` handled as today, sets hash by content, skipped keys ignored only at top level.
- Decisions already made: `hashWorld` output must not change for any world (`src/logic/top-route.test.ts` pins one); `packages/core` stays DOM-free and dependency-free.
- Done when: `pnpm --filter @arcade/core exec vitest run`, `pnpm arcade test rush-racers src/logic/top-route.test.ts src/logic/two-peers.test.ts src/logic/hash.test.ts` (whichever exist) pass; `pnpm arcade check rush-racers --skip-tests` clean.

### Phase 8: templates start where Rush Racers ended

Scaffold: 5a099a518778 (no contracts: the shared helpers landed in phase 7)
Tag: refactor-audit/phase-8

Demo: `pnpm arcade check --all`, `pnpm arcade smoke phaser-2d` and `pnpm arcade smoke three-3d` pass; each template's smoke asserts one world hash across projects.
Depends on: phase 7

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | templates/phaser-2d/ | | | opus | merged | deliver/refactor-audit-8a | |
| b | M | templates/three-3d/ | | | sonnet | merged | deliver/refactor-audit-8b | |

Both template lanes adopt the same patterns, in their engine's idiom. Read Rush Racers for each one before writing it; keep the template small (a template that needs a page of explanation has gone too far).

#### Lane 8a brief

- Goal: a new 2D game started from `templates/phaser-2d` begins with what Rush Racers worked out, so its first agent doesn't rediscover it.
- Interface:
  - Runtime split: move scene flow, the save write queue and the per-tick logic stepping out of `src/engine/game.ts` into a Phaser-free `src/engine/runtime.ts` (model: `games/rush-racers/src/engine/runtime.ts`, much smaller), with `src/engine/runtime.test.ts` driving it in Vitest without a browser (start, play to a coin, save written, restore). `game.ts` keeps the Phaser scene wiring and renders runtime state.
  - World hash: `debugState()` (and `debugSummary()` if it fits) gains `worldHash` from `hashState` in `@arcade/core`; `tests/smoke.spec.ts` gains a test that plays a fixed input to a fixed tick and asserts one hash across every Playwright project (desktop Chromium, phone, WebKit), the way `games/rush-racers/tests/smoke.spec.ts` does around line 95 and 170.
  - Capture stages: `?stage=<name>` applied right after the world is built, with one example stage and an unsaved-result guard, as `games/rush-racers/src/engine/debug-stage.ts` does; document the param in `DESIGN.md`'s launch params.
  - Scenario presets: `scenarios/kit.ts` exports named navigation sequences (title to play, and a save fixture built from the current `SAVE_VERSION`) that the existing scenarios use, like Rush Racers' `TITLE_TO_RACE` and `HARD_SAVE`.
  - Shared helpers: `tests/save.test.ts` uses `checkSaveFixtures` and `tests/smoke.spec.ts` uses `GameDriver.touch` from `@arcade/testing`; `vite.config.ts` stays a plain `defineGameConfig` call.
- Decisions already made: Phaser stays 4.2.1; no new dependencies; existing scenarios keep passing; `arcade new` copies the template as is, so everything must work in a renamed copy.
- Done when: `pnpm arcade test phaser-2d`, `pnpm arcade check phaser-2d --skip-tests`, `pnpm arcade see phaser-2d --scenario complete-level` and `pnpm --filter game-phaser-2d exec playwright test` (all projects; it is small) pass, and `pnpm arcade new scratch-2d --template phaser-2d --title Scratch` followed by `pnpm arcade check scratch-2d --skip-tests` and `pnpm arcade test scratch-2d` passes, then delete `games/scratch-2d` (check `git status` that nothing of it is left).

#### Lane 8b brief

- Goal: the same for `templates/three-3d`, in three.js and Rapier's idiom.
- Interface: as lane 8a's list (runtime split with a Vitest runtime test, `worldHash` in `debugState` with a cross-project smoke test, a `?stage=` capture stage, scenario presets in `scenarios/kit.ts`, `checkSaveFixtures` and `GameDriver.touch`), adapted: Rapier is engine-side physics, so the hash covers logic state only, and the smoke hash test must not depend on Rapier timing (if the template's logic state depends on Rapier, hash only what logic owns and say so in the test's doc comment).
- Decisions already made: three.js r187 WebGLRenderer, Rapier 0.21 lazy-loaded; no new dependencies.
- Done when: `pnpm arcade test three-3d`, `pnpm arcade check three-3d --skip-tests`, `pnpm arcade see three-3d --scenario push-crate` and `pnpm --filter game-three-3d exec playwright test` pass, and an `arcade new scratch-3d --template three-3d` copy checks and tests clean before you delete it.

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
- 1/b accepted choices: `games/rush-racers/package.json` edit allowed despite check-lane's manifest rule (only the `bars` test group changes, no dependencies); smoke re-raises the signal after stopping wrangler (check-lane flags `process.exit(` text); any explicit test-file filter disables the default project even when folders are mixed in; `-t` values are not path filters.
- 1/a accepted choices: lint probes lint a temp copy of biome.json and tools/biome under `.arcade/guardrail-probe-*` with `--vcs-enabled=false` (stdin mode shows no rule diagnostics); the import regex also sees `from '...'` inside comments, accepted; owner folder is the first two path segments.
- 1/b lane review: fixed in lane: attract error text printed [object Object]; Vite server leaked when Chromium fails to launch; run() error line merged into last output line; driver.problems() branches got tests (driver.test.ts added to Owns). Deferred: attract() split into recordFrames/encode, to phase 7 which reworks see/attract sessions.
- 1/a lane review: fixed in lane: repo scan could pass on an empty file list; template-literal dynamic imports were not scanned.
- 2026-11-23: user: "When this is production ready, merge to main, clean up, push to deploy". Push main after the final gate passes.
- 2026-11-23: user approved push after merge: "When this is production ready, merge to main, clean up, push to deploy".
- 2026-11-23: phase tags namespaced `refactor-audit/phase-N`; the bare `phase-1` tag belongs to an older plan and was restored to 8628f05.
- 2c review triage: accepted the toddler measurement note, `fileURLToPath` in files.test.ts, unused `Wording.burst`; rejected moving easy helpers into normal-bars.ts (the brief allowed `easy-bars.ts`); stale `difficulty/` comments and four outside imports fixed at landing.
- phase 2 landed: check --all green, difficulty 109 files / 273 tests passed (197 s).
- landing fix: race camera eased per frame, so `see --compare` differed 30% between identical runs; it now eases per logic tick (HUD tweens still use real time, allowed for visuals).
- 7b accepted: package.json/lockfile edit (vitest devDependency for config tests); build id keeps codec, messages, race-world, race, session, hash-ledger, lobby.
- 3a accepted: widened owns for review fixes (boot.ts, enemy-look/hud tests, theme tests, skins.test, types.ts, cloudreach.ts, DESIGN.md, UI.md). Phase 3 demo: race-to-finish frames at 200/400/600 identical to the pre-3a capture.
- 7a accepted: see-images.ts split, see.ts at 381 lines (summary formatting and run-folder handling left), @arcade/save and fake-indexeddb devDependencies of @arcade/testing, see validates --viewport before creating the run folder.
- phase 7 landed: check --all green, smoke all games green (phaser-2d 11, rush-racers 100, three-3d 8).
