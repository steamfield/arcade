# Plan: Rush Racers 3D structure refactor

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Status: done, merged to main 2026-11-24.
Started: 2026-11-24. Timebox: none. Landing branch: deliver/rush-racers-3d.
Gate: `pnpm arcade check rush-racers-3d && pnpm arcade smoke rush-racers-3d` (60s). Filtered tests: `pnpm arcade test rush-racers-3d <paths>`. Typecheck: `pnpm arcade check rush-racers-3d --skip-tests`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline --reporter=silent`.

## Spec

Reorganize `games/rush-racers-3d` so its modules have one owner each, dependencies point one way, and a second course (same look or a new one) is a data file plus a theme rather than edits across the engine. Readers are the agents who add courses, items and features next. No gameplay changes: every behavior test and scenario passes unchanged, a golden race trace recorded before the refactor still matches after it, and only the smoke `worldHash` pin moves.

In scope:
- Movement (`racer.ts`, `logs.ts`, `bump.ts`) imports nothing from `items/`. Read-only status checks move to `logic/status.ts`; `stopRacer` (it only zeroes `vs`, `vd`, `bufferTicks`) moves to `racer.ts`; `bumpRacers` takes an `onContact(a, b)` callback it defines the type of, and `stepWorld` passes items' `burrContacts`, so `bump.ts` stops importing burr while contact still happens at the same point in the push loop.
- Item state on a racer is one sub-object, `racer.items`, typed in `logic/items/types.ts` and written only by `logic/items/`.
- Outside `logic/items/`, code imports items only through `logic/items/index.ts`, enforced by `logic/architecture.test.ts`.
- `src/engine/` gets feature folders (`track/`, `racers/`, `items/`, `ui/`).
- A course registry, a `?course=` launch param, a `theme` on each course with the forest look in `engine/themes/forest.ts`, course checks that run over every registered course, a guard that only the registry imports a course file, and an "Add a course" section in DESIGN.md.

Out of scope: a course select screen, a second course or theme, `registerCourse` or any runtime course registration, a world/cast abstraction (`WorldDef`), per-course movement tuning, new feature kinds, a per-item plugin registry, anything shared with `games/rush-racers`, `packages/`, tuning numbers, the course layout, the save shape, pie shot height (stays absolute `y`; `item-view.ts` already handles both shot shapes), `grid.ts` (two callers, 11 lines; moving it into `world.ts` would make `world.ts` and `ai.ts` import each other), a `launch-params.ts` (both launch parsers already sit in `capture-stages.ts`).

Assumptions:
- The world hash changes in phase 1 (`racer.items` nests the fields), so `hashState` sees a new shape. Both smoke browsers must agree on the new value. The golden trace, not the hash, proves behavior didn't change.
- `SAVE_VERSION` stays 2: the save holds only `character` and `bests`.
- `ai.ts` keeps reading `racer.items` fields as plain state. The import guard covers imports, not field reads; state is public data, behavior lives in `items/`.
- File moves happen in their own commits, before edits, so history stays readable.

Error model: `courseById(id)` returns `null` for an unknown id, matching `games/rush-racers`. `courseFor(search, courses, log)` logs one warning listing valid ids for an unknown `?course=` and returns `DEFAULT_COURSE`, as `characterFor` does. `assertCourse` throws a `CourseError` naming the course for a `theme` outside `THEME_IDS`, so `themeFor(course)` only sees validated courses; it still throws `Error('unknown theme <id> for course <course id>')` as a guard for a course built without `assertCourse`, and nothing catches it (the shell reports it as a boot error).

## Contracts (scaffold commit)

Layout after the refactor (new or moved files marked; unmarked files stay):

    src/
      main.ts                      boots the shell; wiring only
      logic/
        types.ts                   course, racer, world, input types; Course.theme; ThemeId, THEME_IDS; re-exports items/types.ts
        status.ts            NEW   read-only racer checks: isImmobilized, canBeHit, bootsSpeedFloor, onSplatMud, isPuffed
        architecture.test.ts NEW   import guards: movement never imports items/, outsiders use items/index.ts, only courses/index.ts imports a course file
        world.ts                   createWorld, stepWorld (racers, items, bumps, finishes), playerOf, summarize; passes items' burrContacts to bumpRacers
        racer.ts                   one racer's movement; owns stopRacer
        logs.ts, grid.ts, course.ts, standings.ts, characters.ts, events.ts, hash.ts, save.ts, tuning.ts
        bump.ts                    racer-on-racer pushes; calls an injected onContact(a, b) for each new bump
        ai.ts                      rival controls; imports items/index.ts and status.ts only
        courses/
          index.ts           NEW   COURSES, DEFAULT_COURSE, courseById
          thornwood-trail.ts       one course as data
          thornwood-trail.test.ts  Thornwood's own par band and clean-run check (kept, Thornwood-specific)
          conformance.test.ts NEW  checks every course in COURSES must pass
        items/
          index.ts                 the public API: stepItems, burrContacts, rollItem, hitRacer, heldSlot, item types
          types.ts           NEW   ItemKind, ITEM_KINDS, HeldItem, RacerItems, Shot, Splat
          crates.ts, inventory.ts, hits.ts, boots.ts, burr.ts, pie.ts, shield.ts   internal
      engine/
        game.ts                    wiring only
        runtime.ts, input.ts, camera-rig.ts
        capture-stages.ts          ?stage=, ?character= and ?course= parsing, stage positions
        themes/
          types.ts           NEW   Theme: sky colour, fog range, lights, ground/bark/leaf/wood palettes
          index.ts           NEW   THEMES, themeFor(course)
          forest.ts          NEW   today's look, its constants moved from game.ts, track/forest.ts, track/landmarks.ts, track/track-terrain.ts
        track/               MOVED track-geometry, track-terrain, track-view, landmarks, gust-leaves, forest (scenery planting; reads its palette from the theme)
        racers/              MOVED racer-geometry, racer-view, pedestal
        items/               MOVED item-geometry, item-pools, item-view, splat-view
        ui/                  MOVED hud, hud-style, inventory-hud, screens, screens-style

Contracts the scaffold commits per phase (stubs throw "not implemented"):
- Phase 1 (orchestrator, before dispatch): `tests/golden-race.test.ts` with `tests/golden/race.json`, recorded from the current code: four-racer Thornwood races with items for seeds 3, 11 and 12 (together they include sap traps, splats and hits), the player driven by `rivalInput`, run to the end. Per seed it pins event counts by type, a hash of the full event stream, and each racer's final `{ s, d, y, vs, state, finishTicks }` plus item state. `itemsOf` reads item state from flat fields or `racer.items`, so the lane never edits the test. Also `logic/items/types.ts` with `RacerItems { slots: (HeldItem | null)[]; selected: number; cooldown: number; stunTicks: number; trappedTicks: number; burrTicks: number; bootsTicks: number }`, and `logic/status.ts` signatures.
- Phase 3 (orchestrator, before dispatch): `ThemeId = 'forest'` and `THEME_IDS` in `types.ts`; `Course.theme: ThemeId`, added to Thornwood and to every inline `Course` literal in tests (`ai.test.ts`, `bump.test.ts`, `course.test.ts`, `race.test.ts`, `racer.test.ts`, `items/item-test-kit.ts`). Plus `logic/courses/index.ts` (`COURSES: readonly Course[]`, `DEFAULT_COURSE: Course`, `courseById(id: string): Course | null`), `engine/themes/types.ts`, and `engine/themes/index.ts` (`themeFor(course: Course): Theme`). `RuntimeOptions.course` stays one `Course` chosen at launch.

## Phases

### Phase 1: logic boundaries

Scaffold: 98508ff95f858ec73ffd217fb870efa7262ae9a8
Tag: rr3d-structure-phase-1
Demo: `pnpm arcade test rush-racers-3d tests/golden-race.test.ts src/logic/architecture.test.ts` passes, and `pnpm arcade see rush-racers-3d --scenario crate-and-fire` passes.
Test cases:
- The golden race trace matches exactly: same events in the same order, same final racer states.
- Every existing logic, runtime and scenario test passes with only mechanical edits (field paths under `racer.items`, `itemCooldown` renamed to `items.cooldown`).
- Architecture guard: `racer.ts`, `logs.ts` and `bump.ts` import nothing under `items/`; every other file outside `items/` imports items only through `items/index.ts`. Watch it fail on today's code (`racer.ts`, `bump.ts`, `ai.ts`, `world.ts` all import item internals) before the lane fixes them.
- Status checks give the same answers as the helpers they replace for stunned, trapped, invulnerable, boosted, puffed and splatted racers, one case each.
- A racer that finishes while boosted, puffed or on cooldown has every item timer at 0 by the end of its finishing tick (stun and sap block movement, so they can't be live on a finishing tick), tested through `stepWorld`; no golden seed finishes with a live timer. Ownership moves from `racer.ts` to `stepItems`; the observable result is unchanged.
- Burr contact still hits a racer bumped by a puffed racer exactly once per bump, right after that pair's two `racer.bumped` events. With three racers touching in one tick, a stun from the first pair still locks that racer for the next pair's push, as it does today. An inline test in `bump.test.ts` covers it; the golden seeds include no burr hit inside a three-racer bump (checked by mutation in the lane review).
- Smoke `RUN_HASH` re-pinned at landing (orchestrator), same value in every browser.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers-3d/src/logic/, games/rush-racers-3d/src/engine/item-view.ts, games/rush-racers-3d/src/engine/inventory-hud.ts, games/rush-racers-3d/src/engine/item-pools.ts | contracts | games/rush-racers-3d/tests/golden-race.test.ts | gpt-6.2-sol | merged | foreman/rr3d-s1a | phase 1 test cases pass; check --skip-tests passes |

#### Lane a brief

- Goal: one-way dependencies in `src/logic` and one owner for item state.
- Interface:
  - Implement `status.ts` from `isImmobilized`, `canBeHit` (now `items/hits.ts`), `bootsSpeedFloor` (`items/boots.ts`), `hasSplatMud` (`items/pie.ts`, renamed `onSplatMud`) and a burr puffed check.
  - Move `stopRacer` into `racer.ts`; `items/hits.ts` and `items/shield.ts` import it from there.
  - Move `ItemKind`, `ITEM_KINDS`, `HeldItem`, `Shot`, `Splat` into `items/types.ts`, re-exported from `types.ts`.
  - Move the seven item fields into `racer.items`.
  - `bumpRacers(world, startD, lockedAtStart, onContact: (a: Racer, b: Racer) => void)` calls `onContact` where it calls `burrContact` twice today (`bump.ts:77-78`). `stepWorld` passes `(a, b) => burrContacts(world, a, b)` from `items/index.ts`, which applies `burrContact` both ways.
  - `stepItems` zeroes item timers for racers finished this tick (replacing `racer.ts:93-97`).
  - Export from `items/index.ts` everything callers outside `items/` use.
  - Update the three engine files that read item fields.
- Behavior: none changes. `stepWorld` order stays racers, items, bumps (with contacts inside), finishes. Check the golden trace after each step, not only at the end.
- Decisions already made: `status.ts` holds reads only. `hitRacer` stays in items because it edits the inventory. `grid.ts` and pie `y` stay as they are.
- Out of scope: engine folder moves, courses, themes, tuning, pie height.
- Done when: `pnpm arcade test rush-racers-3d src/logic src/engine/runtime.test.ts tests/golden-race.test.ts`, `pnpm arcade check rush-racers-3d --skip-tests` and `pnpm arcade see rush-racers-3d --scenario crate-and-fire` pass.

### Phase 2: engine folders

Scaffold: b6a496110be017082a06c553ef4756866c0823f8
Tag: rr3d-structure-phase-2
Demo: `pnpm arcade see rush-racers-3d --query scene=race --at 0,300,600 --compare <baseline>` shows no difference, against a baseline captured with `--out` at the phase 1 tag.
Depends on: phase 1
Test cases:
- Every test and scenario passes; the diff is `git mv` plus import paths only.
- `see --compare` against the phase 1 baseline shows no difference at ticks 0, 300 and 600 on desktop and `--mobile`, and on the title and select screens.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | S | games/rush-racers-3d/src/engine/ | contracts | | gpt-6.2-sol | merged | foreman/rr3d-s2a | phase 2 test cases pass |

#### Lane a brief

- Goal: feature folders in `src/engine`.
- Interface: `git mv` files into `track/`, `racers/`, `items/` and `ui/` per the layout, then fix imports. `game.ts`, `runtime.ts`, `input.ts`, `camera-rig.ts` and `capture-stages.ts` stay at the top.
- Behavior: none changes.
- Out of scope: themes, `?course=`, logic, renames inside files.
- Done when: `pnpm arcade test rush-racers-3d src/engine`, `pnpm arcade check rush-racers-3d --skip-tests` and the `see --compare` runs above pass.

### Phase 3: courses and themes

Scaffold: 677569b5367d5ba46566c401e93dab5a2a9f2167
Tag: rr3d-structure-phase-3
Demo: `pnpm arcade see rush-racers-3d --query scene=race --query course=thornwood-trail --compare <phase 2 baseline>` matches; `--query course=nope` logs one warning naming `thornwood-trail` and races Thornwood.
Depends on: phase 2
Test cases:
- `courseById('thornwood-trail')` returns Thornwood; an unknown id returns `null`; `COURSES` ids are unique; `DEFAULT_COURSE` is in `COURSES`.
- `assertCourse` throws a `CourseError` naming the course for a `theme` outside `THEME_IDS`.
- `conformance.test.ts` runs `it.each(COURSES)`: every course passes `assertCourse`, and every rival finishes within 1.25x `parTicks` with at most two falls for seeds 1..5. That check moves here from `ai.test.ts:169`.
- Thornwood's own par band (75-100 s, par = clean run rounded up to 100 ticks, fixed lanes at ±3.5) stays in `thornwood-trail.test.ts`, as course-specific checks.
- Architecture guard: only `courses/index.ts` imports a course file. Watch it fail on today's `engine/game.ts` import of `THORNWOOD_TRAIL`.
- `themeFor(THORNWOOD_TRAIL)` returns the forest theme. `see --compare` against the phase 2 baseline shows no difference, on desktop and `--mobile`.
- `courseFor(search, courses, log)` with a fixture course list: a known id returns that course; an unknown id warns once, listing ids, and returns the first course given; no param returns the first course.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers-3d/src/logic/courses/, games/rush-racers-3d/src/logic/course.ts, games/rush-racers-3d/src/logic/course.test.ts, games/rush-racers-3d/src/logic/ai.test.ts, games/rush-racers-3d/src/logic/architecture.test.ts | contracts | | gpt-6.2-sol | merged | foreman/rr3d-s3a | registry, conformance and guard tests pass |
| b | M | games/rush-racers-3d/src/engine/themes/, games/rush-racers-3d/src/engine/track/, games/rush-racers-3d/src/engine/game.ts, games/rush-racers-3d/src/engine/capture-stages.ts, games/rush-racers-3d/src/engine/capture-stages.test.ts, games/rush-racers-3d/src/engine/runtime.test.ts, games/rush-racers-3d/src/engine/racers/pedestal.ts | contracts | | gpt-6.2-sol | merged | foreman/rr3d-s3b | forest theme renders identically; courseFor tests pass |

Lanes a and b run in parallel. The scaffold makes `COURSES` and `DEFAULT_COURSE` real data (only `courseById` is a stub) and points `game.ts` at `DEFAULT_COURSE`, so lane a's guard passes on its own branch and lane b's `courseFor` can take `COURSES`. DESIGN.md's "Add a course" section and the `?course=` launch param line belong to the orchestrator at landing.

#### Lane a brief

- Goal: a course registry and checks that every registered course must pass.
- Interface:
  - Implement `courseById` in `logic/courses/index.ts`.
  - In `course.ts`, `validateCourse` reports a problem for a `theme` outside `THEME_IDS`, naming the course and the theme.
  - Add `logic/courses/conformance.test.ts`, run with `it.each(COURSES)`: `assertCourse` passes, and every rival finishes within `Math.floor(parTicks * 1.25)` with at most two falls for seeds 1..5. Move that rivals check out of `ai.test.ts:169` (delete it there) and keep its assertions.
  - Add a guard to `logic/architecture.test.ts`: in non-test source files under `src/`, only `logic/courses/index.ts` imports a course file from `logic/courses/`. Watch it fail once by importing `THORNWOOD_TRAIL` from a temporary non-test file.
- Behavior: none changes for Thornwood. `thornwood-trail.test.ts` keeps its par band and clean-run checks.
- Decisions already made: `courseById` returns `null` for an unknown id. No `registerCourse`. Conformance checks stay generic: no fixed lanes, par bands or Thornwood numbers.
- Out of scope: engine, themes, `?course=`, a second course.
- Done when: `pnpm arcade test rush-racers-3d src/logic tests/golden-race.test.ts` and `pnpm arcade check rush-racers-3d --skip-tests` pass.

#### Lane b brief

- Goal: the forest look lives in one theme object, and `?course=` picks the course.
- Interface:
  - Fill `engine/themes/forest.ts` with `FOREST: Theme`, holding every colour and lighting constant now in `game.ts` (background, fog 28..115, sun colour, intensity and position, hemisphere light), `track/track-terrain.ts` (ground colours), `track/landmarks.ts` (wood colours), `track/forest.ts` (bark, needles, leaves, rock and shrub colours) and `track/gust-leaves.ts` (leaf colours).
  - Implement `themeFor` in `engine/themes/index.ts`.
  - `createTrackView(course, frames, seed, theme)` passes the theme's palettes down; those files keep no colour constants of their own. `game.ts` builds the sky, fog and lights from `themeFor(course)`.
  - Add `courseFor(search: string, courses: readonly Course[], log: Logger): Course` to `capture-stages.ts`, beside `characterFor`. Unit-test it in a new `engine/capture-stages.test.ts` with fixture course lists.
  - `game.ts` passes `courseFor(window.location.search, COURSES, log)` to `Runtime`.
- Behavior: the forest looks exactly as before. The three `see --compare` runs against the phase 2 baseline print "all frames identical". Seeded rng streams in `forest.ts` and `gust-leaves.ts` must draw in the same order.
- Decisions already made: an unknown `?course=` warns once, listing valid ids, and returns `courses[0]`; no param returns `courses[0]`. `Theme` fields are the ones in `engine/themes/types.ts`; extend it only with fields the moved constants need.
- Out of scope: a second theme, logic, a course select screen.
- Done when: `pnpm arcade test rush-racers-3d src/engine`, `pnpm arcade check rush-racers-3d --skip-tests` and the three `see --compare` runs pass.

## Log

- 2026-11-24: phase 3 landed. Lane 3/a added `courseById`, the unknown-theme check, `courses/conformance.test.ts` over `COURSES`, and a guard that only `courses/index.ts` imports course files. Lane 3/b moved every forest colour and light into `themes/forest.ts`, added `themeFor` and `?course=` (`courseFor`), and rendered identically against the phase 2 baselines on desktop, mobile and menus.
  - Lane reviews: 3/a's guard could pass vacuously and flagged non-course files in `courses/`; it now lists course files and asserts it finds the registry's import. The theme error stopped repeating the course id. Conformance now requires rivals. 3/b: `courseFor` takes an explicit `DEFAULT_COURSE` fallback (the Lane b brief's `courses[0]` lost to the Error model), `Theme.id` was dropped since the registry key is the id, and the pedestal colour moved into the theme (lane b's Owns widened to `racers/pedestal.ts`).
  - Deferred until a second theme exists: the planters. `track/forest.ts` and `track/gust-leaves.ts` still plant forest shapes, and `Theme.scenery` names forest parts, so a different kind of place needs a planter chosen by theme. DESIGN.md says so.
- 2026-11-24: phase 2 landed. Lane 2/a moved 19 files into `track/`, `racers/`, `items/` and `ui/` with only import lines changed (53/53), and every `see --compare` against the phase 1 baselines was identical. Its review was the orchestrator's: cross-folder imports point one way (`racers/` and `items/` → `track/track-geometry.ts`, `ui/` → `racers/` colours and runtime types; `track/` imports no other folder). DESIGN.md gained a code layout section; stale `track-geometry.ts` paths fixed.
- 2026-11-24: lane 1/a review (opus): behavior preserved and item state written only in `logic/items/`. Fixing: `types.ts` value re-export of `ITEM_KINDS` (would cycle with phase 3's `THEME_IDS`), `status.ts` added to the movement guard, a test that pinned which function resets timers removed, doc blocks. Plan corrected: the golden trace doesn't cover the same-tick stun lock or the finish-tick reset; the inline tests do, and the reviewer's mutations showed they fail when those break.
- 2026-11-24: plan critique (opus devils-advocate) applied:
  - `stopRacer` moves to `racer.ts`, and the finish-time item timer reset moves to `stepItems`, so movement has no item imports.
  - Dropped `gridD` into `world.ts`, which would make `world.ts` and `ai.ts` import each other.
  - Dropped the pie `height` change, which would risk float drift for no near-term gain. Added a golden race trace recorded before phase 1, because no test pins exact behavior once the hash is re-pinned.
  - The orchestrator owns the smoke re-pin.
  - The phase 3 scaffold adds `theme` to every inline `Course` literal, and lane a owns `ai.test.ts` for the rivals-within-par check.
  - Course checks split: generic ones over `COURSES`, Thornwood's par band kept in its own file.
  - `courseFor` takes the course list, so phase 3 lanes run in parallel. Added the guard that only the registry imports a course file.
  - Corrected claims: both launch parsers already live in `capture-stages.ts`, so `launch-params.ts` is dropped; `logs.ts` already had no item imports; `world.ts` imports `isImmobilized` from `items/hits.ts`.
  - `courseById` returns `null` to match `games/rush-racers`.
  - Found while applying the critique: burr contact runs inside the bump push loop, where a stun locks the racer for later pairs that tick. So it becomes an injected `onContact` callback, not a list applied after the loop.
  - Not adopted: `registerCourse`. Tests use `it.each(COURSES)` directly, and runtime registration has no caller yet.
  - Noted: the import guard doesn't catch `ai.ts` reading `racer.items` fields. That's intended, since state is public data.
- 2026-11-24: plan written from the architecture and extensibility reviews of the shipped game.
