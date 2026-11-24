# Plan: Rush Racers 3D

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Started: 2026-11-24. Timebox: none. Landing branch: deliver/rush-racers-3d.
Gate: `pnpm arcade check rush-racers-3d && pnpm arcade smoke rush-racers-3d` (timed at scaffold). Filtered tests: `pnpm arcade test rush-racers-3d <paths>`. Typecheck: `pnpm arcade check rush-racers-3d --skip-tests`.
Runner: plain commands (`rr suite -- rush-racers-3d` may shard the Vitest part when the machine is busy).
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline --reporter=silent`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore
Manifests: package.json, pnpm-lock.yaml

Lanes run as Codex runs through foreman (the user asked for Codex to do the coding), not as builder subagents. Each lane is `foreman start rr3d-<phase><lane> --new-worktree --from <scaffold sha> --setup "<worktree setup>" --write --model gpt-6.2-sol`, so its branch is `foreman/rr3d-<phase><lane>`. Codex leaves work uncommitted; the orchestrator reviews it, commits it on the lane branch, runs `check-lane` against the scaffold sha and merges. Deviation from lane-dag: each lane writes its own tests from the binding test-case list in its brief (one Codex run instead of a separate test-author run first); the orchestrator checks every listed case has a test at landing, and the lane review checks the tests aren't weakened.

## Spec

A 3D, chase-camera, point-to-point foot race through a forest, built as a new game in `games/rush-racers-3d`. It keeps Rush Racers' feel and Thornwood's cast and names: run with momentum, jump logs and pits, a two-charge dash meter, three AI rivals and items from `?` crates. Players are kids and casual players on desktop and phones.

In scope:
- One course, Thornwood Trail, about 75 to 100 s at par, point to point with a start and a finish line.
- Run medium only: forward/brake, steer, jump (variable height, coyote and buffer), dash, pits with fall and respawn, mud, wind gusts, logs, hills.
- Phase 2: three AI rivals drawn by seed from the other seven of Thornwood's eight-character cast, racer bumps, places, results, title and character select.
- Phase 3: `?` crates, a three-slot inventory with select next/previous, four items (Rocket Boots, Sap Shield, Burr Ball, Mud Pie), rivals firing items.
- Saved: picked character and best time per course.
- New game, own code. Nothing imports from `games/rush-racers`; names, numbers and small helpers are copied where they fit.

Out of scope: online play, other worlds and media, difficulty levels (one fixed level), character abilities (the cast is cosmetic plus a per-character rival profile), branching routes, music and sound, glTF art (everything is built from three.js primitives), landing-page footage, publishing (status stays `draft`).

Assumptions (user can override):
- Rapier is removed. All movement is deterministic logic in track space, so the template's physics loader, crates and the `physics.ready` gate go away.
- Track space: a racer's position is `s` (meters along the course centreline), `d` (meters sideways, + is right of the direction of travel) and `y` (meters up). Logic never sees world x/z; the engine maps track space to the world through `track-geometry.ts`. Lateral speed doesn't scale with curvature in phase 1.
- Movement is forward speed `vs` plus sideways speed `vd` (no heading angle), so logic needs no trig. The engine draws the racer facing `atan2(vd, vs)`.
- Save v2 (`character`, `bests` by course id in race ticks) replaces the template's v1 (seed, collected orbs) through `migrations[1]`, which starts fresh; `save-v1.json` stays and `save-v2.json` is added. Bests live in the `Runtime`, not the `World`.
- Character ids are this game's own (`grit`, `skip`, ...), named after Thornwood's cast; they are not the 2D game's slot ids, since no save is shared.
- Screens confirm with the `fire` action (Z, Enter, touch ★), never jump. Results accept a fresh fire press only `RESULTS_CONFIRM_DELAY_TICKS` (30) after `race.ended`. The Runtime reads it through `readInput()` (`FrameInput.confirmPressed`) inside the fixed step, so restarts are deterministic.
- A staged session (`?stage=`) never writes a save and never records a best, including races started by confirm after the first.
- Respawn: `safeS`/`safeD` is updated every tick a racer is grounded on ground or mud (not a log top) with no pit within `RUN.respawnBackoff` ahead at its `d`. A fall puts it back there at rest. A fall ends any dash.
- The orchestrator, not a lane, owns `scenarios/`, `tests/smoke.spec.ts`, `tests/save.test.ts` and fixtures, `DESIGN.md`, `game.json`, `biome.json` and `docs/repo-map.md`. It re-pins the smoke hash and retunes scenario timings at landing.
- The `no-inexact-math` Biome plugin now covers `games/rush-racers-3d/src/logic/**`, so the no-trig rule is enforced by lint.
- No `**`, `Math.pow`, `Math.sin/cos/atan2/exp/log` in `src/logic/` (inexact across JS engines and the smoke hash is pinned across browsers). Only `+ - * /`, `Math.sqrt`, `Math.floor/ceil/round/min/max/abs/sign`. The engine may use any `Math`.
- Controls: forward W/Up, brake S/Down, steer A/D/Left/Right, jump Space, dash Shift/X, fire Z/Enter (phase 3), previous item Q, next item E/Tab, confirm Enter/Space/Z. Touch: d-pad, A = jump, B = dash, then a fire button and `⇄` in phase 3.

Error model: logic throws `CourseError` (message names the course id and the bad feature index) from `validateCourse` and from `createWorld` for an invalid course; nothing in a race step throws. A WebGL context loss reports `ctx.reportError('webgl', ...)`. Save load failures follow the template: a notice, and the unreadable save is never overwritten. A failed save write is a `save.failed` event and a logged warning, never a thrown error. Unknown `?stage=` or `?character=` values log a warning listing valid ones and are ignored.

## Contracts (scaffold commit)

Layout:

    games/rush-racers-3d/
      src/main.ts                         boot wiring only (template)
      src/logic/types.ts                  Course, PathSegment, Feature, Racer, World, TickInput, RacerId, CharacterId
      src/logic/events.ts                 GameEvent union
      src/logic/tuning.ts                 RUN, DASH, RACE constants (meters, seconds, ticks)
      src/logic/course.ts                 course queries: courseLength, groundY, assertCourse (implemented in scaffold), surfaceAt, pitAt, logAt, validateCourse, CourseError
      src/logic/courses/thornwood-trail.ts  THORNWOOD_TRAIL: the course as data
      src/logic/racer.ts                  stepRacer: one racer, one tick, from its TickInput (run, steer, jump, dash, features, fall, respawn, finish line)
      src/logic/world.ts                  createWorld, playerOf, summarize (implemented in scaffold), stepWorld (countdown, racing, finish, race limit), withBest
      src/logic/hash.ts                   hashWorld (skips events and course)
      src/logic/save.ts                   SaveSchema v1: character, bests
      src/engine/runtime.ts               three-free Runtime: fixed step, scene flow (race, results, retry), bests, save queue (start, summary, worldHash implemented in scaffold)
      src/engine/capture-stages.ts        ?stage= (implemented in scaffold): mid-course, near-finish, before-pit, before-log
      src/engine/input.ts                 actions and touch layout (implemented in scaffold)
      src/engine/track-geometry.ts        PathSegment[] -> world frames: buildTrackFrames(course).frameAt(s) {x, y, z, tx, tz, rx, rz}; toWorld(s, d, y); pure math
      src/engine/track-view.ts            track ribbon, verges, trees, logs, mud, pits, gusts, start and finish arches
      src/engine/racer-view.ts            racer meshes from primitives, synced from logic
      src/engine/camera-rig.ts            chase camera behind the local racer, smoothed per tick
      src/engine/hud.ts                   DOM HUD: countdown, race timer, dash pips, results panel
      src/engine/game.ts                  startThree: renderer, rAF loop (off in test mode), GameHandle; wiring only

Key types (exact text lives in `src/logic/types.ts`):

    type PathSegment = { kind: 'straight'; length: number } | { kind: 'turn'; angleDeg: number; radius: number };  // + angle turns right
    type Span = { s0: number; s1: number; d0: number; d1: number };      // s0 < s1, d0 < d1, meters
    type Feature =
      | ({ kind: 'pit' } & Span)                                          // no ground inside
      | ({ kind: 'mud' } & Span)                                          // run speed x RUN.mudSpeedMul
      | ({ kind: 'gust'; push: number } & Span)                           // m/s sideways, + pushes right
      | { kind: 'log'; s: number; d0: number; d1: number; height: number }  // solid box, RUN.logDepth deep in s, starting at s
      | { kind: 'crate'; s: number; d: number };                          // phase 3
    interface Course { id: string; name: string; path: PathSegment[]; halfWidth: number; hills: { s: number; y: number }[];
                       startS: number; finishS: number; parTicks: number; features: Feature[] }
    interface TickInput { forward: boolean; brake: boolean; steer: number; jumpPressed: boolean; jumpHeld: boolean;
                          dashPressed: boolean; firePressed: boolean; nextPressed: boolean; prevPressed: boolean }
    type RacerId = 'player' | 'r1' | 'r2' | 'r3';
    type CharacterId = 'grit' | 'skip' | 'blaze' | 'shade' | 'cheeks' | 'duke' | 'dusk' | 'fang';
    interface Racer { id; character; s; d; y; vs; vd; vy; grounded; coyoteTicks; bufferTicks; dashCharges; dashRecharge;
                      dashTicks; state: 'racing' | 'fallen' | 'finished'; outTicks; invulnTicks; safeS; safeD; finishTicks: number | null }
    interface World { seed; course: Course; phase: 'countdown' | 'racing' | 'finished'; tick; raceTicks; racers: Racer[]; events }

`createWorld(events, { course, seed, character, rivals })` (rivals is false until phase 2) builds the racers on the start line in countdown. `stepWorld(world, inputs: Partial<Record<RacerId, TickInput>>, dt)`. `summarize(world)` gives `{ tick, phase, time, player: { s, d, y, speed, state }, finishTicks }` with floats rounded to 0.1.

## Phases

### Phase 1: solo race on Thornwood Trail (MVP)

Demo: `pnpm arcade dev rush-racers-3d`, open `/games/rush-racers-3d/`: a 3-2-1 countdown, run the trail from the chase camera, jump logs and pits, dash, cross the finish, see your time and best, press confirm to race again. `pnpm arcade see rush-racers-3d --scenario finish-line` shows it headless.
Scaffold: 4d8a16958803f2fd880f56e440336cc96a6d2d54
Tag: rr3d-phase-1
Test cases (lane a writes these; every line needs a test):
- Countdown: a new world is in `countdown` for RACE.countdownTicks (180); input moves nothing; `race.countdown` fires with 3, 2, 1 at ticks 0, 60, 120 and `race.started` at 180, then `phase` is `racing`.
- Holding forward accelerates to RUN.runSpeed and never above it without a dash; releasing slows to 0 at RUN.friction; brake slows faster than release; `vs` never goes negative.
- Steer moves `d` toward the held side up to RUN.steerSpeed; `d` stops at `±(halfWidth - RUN.radius)` and `vd` is zeroed there.
- Jump: a fresh press while grounded jumps (`racer.jumped`); held rises higher than a tap (cut gravity on release); no second jump in the air; a press within RUN.coyoteTicks after leaving a ledge still jumps; a press within RUN.bufferTicks before landing jumps on landing.
- Ground follows hills: a grounded racer's `y` equals `groundY(course, s)` at every tick on a sloped stretch.
- Dash: spends a charge (`racer.dashed`), sets `vs` to at least DASH.speed, glides back to run speed at DASH.drag; with 0 charges a press does nothing; a charge returns DASH.rechargeTicks after the meter dropped (`racer.dashRecharged`), one at a time.
- Pit: running into a pit with no jump: the racer drops below ground, `racer.fell` once it is RUN.fallDepth under the rim, is out for RUN.respawnTicks ignoring input, then `racer.respawned` at rest and grounded at its `safeS`/`safeD`, with RUN.invulnTicks of invulnerability. Jumping across clears it with no fall.
- Safe spot: `safeS`/`safeD` never lands on a log top, in a pit or within RUN.respawnBackoff before a pit at the racer's `d`; a racer that falls in the second of two close pits comes back before the second, on the ground between them when there is room; a racer dashing into a pit loses the dash; a racer still fallen when the race limit hits has `finishTicks` null.
- Mud caps running speed at RUN.runSpeed x RUN.mudSpeedMul; leaving mud lets it climb back.
- Gust adds its push to `d` motion while inside its span and not after.
- Log: running into a log below its top stops the racer at its face (`vs` = 0, `racer.bumped`); jumping over it passes; landing on top stands on it at `groundY + height`; running off the far side drops back to ground.
- Finish: crossing `finishS` emits `racer.finished` (from `stepWorld`, which knows the standings) with `ticks` = race ticks, sets `finishTicks`, `state` `finished`; in phase 1 the world goes to `finished` (`race.ended`); later input changes nothing.
- Race limit: at RACE.limitTicks (4 min) the race ends with `race.ended`, and an unfinished player has `finishTicks` null.
- Course data: `validateCourse(THORNWOOD_TRAIL)` returns no problems; `validateCourse` reports a feature outside `[startS, finishS]`, a span with s0 >= s1 or d0 >= d1, a span outside the track width, a pit within 20 m of the start, hills not sorted by s, a turn whose radius is not more than `halfWidth + 1`, and a log overlapping a pit. `createWorld` throws `CourseError` (message names the course id) for an invalid course.
- Course fairness: a scripted run (hold forward, jump 0.25 s before each pit and log, steer out of mud, no dash) finishes Thornwood Trail with no fall and no bump; `parTicks` is that run's finish ticks rounded up to the next 100; the same run with a dash on each charge finishes faster.
- Determinism: the same input script gives the same `hashWorld` twice; `hashWorld` ignores `events` and `course`.
- Runtime: finishing a race sets `scene` to `results`, writes `bests['thornwood-trail']` and emits `best.new`; a slower finish keeps the old best and emits no `best.new`; fire on results within RESULTS_CONFIRM_DELAY_TICKS of `race.ended` does nothing, after it starts a fresh world in countdown with the same character (`race.restarted`); fire during the race never restarts; a staged session never writes a save, also after a confirm; an unreadable save is never overwritten after a finish; a failed or thrown write emits `save.failed` and the race goes on; `?character=` overrides the save's character.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers-3d/src/logic/, games/rush-racers-3d/src/engine/runtime.ts, games/rush-racers-3d/src/engine/runtime.test.ts | contracts, templates/three-3d/src/engine/runtime.ts | | gpt-6.2-sol | merged | foreman/rr3d-1a | every phase 1 test case has a passing test; typecheck and lint pass |
| b | M | games/rush-racers-3d/src/engine/track-geometry.ts, games/rush-racers-3d/src/engine/track-geometry.test.ts, games/rush-racers-3d/src/engine/track-view.ts, games/rush-racers-3d/src/engine/track-terrain.ts, games/rush-racers-3d/src/engine/forest.ts, games/rush-racers-3d/src/engine/landmarks.ts, games/rush-racers-3d/src/engine/gust-leaves.ts, games/rush-racers-3d/src/engine/racer-view.ts, games/rush-racers-3d/src/engine/camera-rig.ts, games/rush-racers-3d/src/engine/hud.ts, games/rush-racers-3d/src/engine/game.ts | contracts, .claude/skills/threejs-game/SKILL.md | | gpt-6.2-sol | merged | foreman/rr3d-1b | track-geometry tests pass; `see` frames at the start line and every capture stage look right on desktop and `--mobile` |

#### Lane a brief

- Goal: all of phase 1's rules as deterministic logic in track space, plus the three-free `Runtime` that runs them, saves the best time and restarts a race.
- Interface: implement the stubs in `src/logic/course.ts`, `src/logic/racer.ts`, `src/logic/world.ts` against `src/logic/types.ts`, `events.ts` and `tuning.ts`. `createWorld`, `playerOf`, `summarize`, `courseLength`, `groundY` and `assertCourse` are implemented; keep their signatures. Finish `src/engine/runtime.ts`: `start` and `newRace` are implemented; fill `tickOnce` (read `FrameInput`, step the world in scene `race`, switch to `results` on `race.ended`, record the best and queue a save, confirm handling on results), `saving`, `settled`, and a private save queue in the template's style (`templates/three-3d/src/engine/runtime.ts`: chained writes, `save.written`, `save.failed`, never rejects). Keep the exported types and `RuntimeOptions` as they are. You may tune numbers in `tuning.ts` and feature positions in `courses/thornwood-trail.ts` to meet the fairness case, keeping the course's sections and their order; stage positions derive from the course, so they follow.
- Behavior: the test-case list above, one test per line at least, in `src/logic/*.test.ts` and `src/engine/runtime.test.ts`. Build small inline courses in tests (a 200 m straight with one feature) rather than reading Thornwood Trail, except in the course data and fairness tests. Racers step in `world.racers` order. A fallen racer ignores input. Finished racers stop at `finishS` and ignore input.
- Decisions already made: track-space model with `vs`/`vd`, no trig in logic (see Assumptions), save v1 shape in `save.ts`, `Partial<Record<RacerId, TickInput>>` inputs where a missing entry means no input in phase 1.
- Out of scope: rivals, AI, items, crates (leave `crate` features inert), menus, anything under `src/engine/` other than `runtime.ts` and its test, any new dependency.
- Done when: `pnpm arcade test rush-racers-3d src/logic src/engine/runtime.test.ts` and `pnpm arcade check rush-racers-3d --skip-tests` pass.

#### Lane b brief

- Goal: draw the race. A forest trail the player runs down from a chase camera, readable on a phone, with a DOM HUD for the countdown, timer, dash pips and results.
- Interface: implement `buildTrackFrames` in `src/engine/track-geometry.ts` as its stub documents (`TrackFrame` is `{ x, y, z, tx, tz, rx, rz }`). `game.ts` is a compiling scaffold: keep its `Runtime.start` call and `readInput` mapping, add the views, camera and HUD. The views read `runtime.world`, `runtime.scene`, `runtime.bests` and drained `runtime.events`; they never change them. `src/engine/camera-rig.ts` is the template's and yours to rewrite.
- Behavior: path starts at the origin heading -z; a `turn` with positive `angleDeg` turns right along an arc of `radius`; frames are continuous across segments (test: positions and tangents match at every joint within 1e-6, total length equals `courseLength`, a 90° right turn of radius 20 ends at the expected point). Track ribbon follows hills; pits are holes in the ribbon with a dark drop; logs are horizontal cylinders across their `d` range; mud is a dark brown patch; gusts show drifting leaves (wall-clock animation is fine); trees and rocks instanced along both verges, seeded with `createRng`, never on the track; start and finish arches. Racer: a simple animal figure built from primitives in its character colour, leaning into `vd`, facing `atan2(vd, vs)`, bobbing while running, faded while invulnerable, hidden while `fallen`. Camera sits behind and above the local racer along the track tangent, smoothed per tick as the template's `CameraRig` does, and snaps on respawn. HUD: big centred 3-2-1-GO, race time `m:ss.t` top left, two dash pips bottom left clear of the touch d-pad, results panel with time, best, NEW BEST, and "Press Enter to race again". HUD updates DOM only when a value changes. `debugSummary` adds `scene`; `debugState` keeps `worldHash`.
- Decisions already made: no Rapier, no glTF, no WebGPU; one directional light with a tight shadow or blob shadows; under 100 draw calls on the start-line view (report `renderer.info.render.calls` in `debugSummary` as `drawCalls`).
- Out of scope: menus, rivals' looks beyond the player's mesh being reusable for any `CharacterId`, items, sound, post-processing.
- Done when: `pnpm arcade test rush-racers-3d src/engine/track-geometry.test.ts` and `pnpm arcade check rush-racers-3d --skip-tests` pass, and `pnpm arcade see rush-racers-3d --at 0` plus `--query stage=<each stage> --at 0` (desktop and `--mobile`) frames show the trail, the racer and the HUD clearly. Until lane a lands, `stepWorld` throws, so only tick-0 frames work; that's expected.

### Phase 2: rivals, places and menus

Demo: title, pick one of eight characters, race three rivals, see your place live and every place on results.
Depends on: phase 1
Scaffold: 00692eb696ce04387d365c87262abee447c531bf

Scaffold (orchestrator, before dispatch): `FrameInput` gains `menu: { left, right, up, down, back }` fresh presses (dash is back); `RuntimeOptions` gains `startScene: 'title' | 'race'` (`?scene=race` or any stage gives `race`); `Scene` gains `title` and `select`; (`RacerContext.speedMul` already exists from the phase 1 boundary fixes and scales top run speed); `World` gains `rngState: number` (rival draws and AI noise, hashed) and `endTick: number | null`; `GameEvent` gains `racer.finished.place`, `racer.bumped.by` (RacerId or null for a log) and `race.ended.reason` (`'player-finished' | 'rivals-finished' | 'limit'`); new stubs `src/logic/characters.ts` (`CAST`, `RIVAL_PROFILES`, `drawRivals`), `src/logic/ai.ts` (`rivalInput`), `src/logic/standings.ts` (`places`, `placeOf`), `src/logic/bump.ts` (`bumpRacers`), `src/engine/screens.ts` (`createScreens`); tuning `RIVAL` (catch-up bounds, look-ahead, dash clearance) and `RACE.rivalsDoneGraceTicks` (600). Smoke opens with `scene=race` (stage scenarios start in `race` already). As built: `standings.ts` is implemented in the scaffold (the solo race needs `place`) and lane 2a tests it; `Runtime.cursor` holds the select card index; `createScreens(container)` returns `{ sync({ scene, cursor, character }) }` and is wired in `game.ts`; `newRace` still passes `rivals: false` and lane 2a turns it on. The orchestrator writes the `title-to-race` and `rivals-race` scenarios at landing, once the behavior exists.

Test cases (lane a writes these; every line needs a test):
- Grid: `createWorld` with `rivals` gives four racers in slot order player, r1, r2, r3 at d = -1.25, 1.25, -3.75, 3.75; the three rival characters are distinct, never the player's, drawn from the seed (same seed same draw; seeds 1..20 produce more than one draw).
- Rival driving: rivals ignore any `inputs` entry for their slot. On inline courses a rival jumps a full-width log and a full-width pit without a bump or fall, steers into the dry lane past a half-width pit and past half-width mud, and stays within the track edges.
- Rival dash: a rival dashes only with a charge and with no pit or log in the next RIVAL.dashClearance meters.
- Rival race: with the player idle, every rival finishes Thornwood Trail within 1.25x `parTicks` for seeds 1..5, with at most two falls each.
- Catch-up: a rival RIVAL.catchUpRange or more behind the player gets `speedMul` 1 + RIVAL.catchUp, one that far ahead 1 - RIVAL.catchUp, linear between, measured against the unfinished player; the player's is always 1.
- Bumps: two racers overlapping in s and d with `|Δy| < 1` are pushed apart in d on that tick and swap part of their `vd` (`racer.bumped` with `by`); neither passes through the other; a racer more than 1 m above another doesn't bump; fallen and finished racers never bump; two rivals respawning on the same spot separate within a few ticks.
- Standings: finished racers by `finishTicks`, then unfinished by `s`, ties by slot order; `racer.finished.place` is that place at the finish and never changes.
- Race end: the player finishing ends the race (`reason: 'player-finished'`) with every place set; three rivals finishing first ends it RACE.rivalsDoneGraceTicks later (`'rivals-finished'`) with the player's `finishTicks` null unless they finish in the grace; the limit still ends it (`'limit'`).
- Determinism: a four-racer race with a fixed player script gives the same `hashWorld` twice, and a different seed gives a different one.
- Runtime scenes: boots to `title` unless `startScene` is `race`; fire on title goes to `select` with the cursor on the save's character; menu arrows move the cursor in a 4x2 grid and clamp at the edges; fire on select saves the character and starts a race; back on select returns to title; results accept fire (race again, same character) and back (to select) after the delay; a best is recorded only on a player finish; `summary()` adds `place` (the player's) and `cursor` on select.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers-3d/src/logic/characters.ts, games/rush-racers-3d/src/logic/ai.ts, games/rush-racers-3d/src/logic/standings.ts, games/rush-racers-3d/src/logic/bump.ts, games/rush-racers-3d/src/logic/world.ts, games/rush-racers-3d/src/logic/racer.ts, games/rush-racers-3d/src/logic/tuning.ts, games/rush-racers-3d/src/logic/courses/, games/rush-racers-3d/src/engine/runtime.ts, games/rush-racers-3d/src/engine/runtime.test.ts, games/rush-racers-3d/src/engine/capture-stages.ts, games/rush-racers-3d/src/logic/characters.test.ts, games/rush-racers-3d/src/logic/ai.test.ts, games/rush-racers-3d/src/logic/standings.test.ts, games/rush-racers-3d/src/logic/bump.test.ts, games/rush-racers-3d/src/logic/world.test.ts | contracts | | gpt-6.2-sol | pending | | every phase 2 test case has a passing test; typecheck and lint pass |
| b | M | games/rush-racers-3d/src/engine/screens.ts, games/rush-racers-3d/src/engine/racer-view.ts, games/rush-racers-3d/src/engine/hud.ts, games/rush-racers-3d/src/engine/game.ts | contracts | | gpt-6.2-sol | pending | | title, select, race with rivals and results look right in `see` on desktop and `--mobile` |

#### Lane 2a brief

- Goal: three AI rivals that race Thornwood Trail competently and fairly, racer bumps, live places, the race's end rules, and the runtime's title and select scenes.
- Interface: implement the phase 2 stubs (`drawRivals`, `rivalInput`, `places`, `placeOf`, `bumpRacers`), extend `createWorld` for `rivals: true`, `stepWorld` for rivals (AI input, catch-up `speedMul`, bumps after every racer has moved, end rules), catch-up via `ctx.speedMul` (`stepRacer` already caps run and mud speed by it), and the Runtime's `title`/`select` scenes. Keep every scaffold export.
- Behavior: the phase 2 test-case list. AI noise (steer wobble, jump timing jitter per profile) comes only from `world.rngState` via `createRng`. Rivals see only what a player could: course features and other racers' track positions.
- Decisions already made: one difficulty; cosmetic cast plus rival profiles, no abilities; catch-up against the player only.
- Out of scope: items, crates, anything under `src/engine/` except `runtime.ts` and its test.
- Done when: `pnpm arcade test rush-racers-3d src/logic src/engine/runtime.test.ts` and `pnpm arcade check rush-racers-3d --skip-tests` pass.

#### Lane 2b brief

- Goal: the title and select screens, eight distinct racers on the trail, live place in the HUD and places on results.
- Interface: `createScreens(container)` in `src/engine/screens.ts` renders `runtime.scene` `title` and `select` as DOM over the 3D scene (the trail as a slow fly-by behind the title); `racer-view.ts` builds each `CharacterId` as its own silhouette from primitives (Grit badger with a miner's lamp, Skip lanky hare, Blaze red fox, Shade black panther cub, Cheeks chipmunk in goggles, Duke huge tortoise with a mossy crown, Dusk little owl in a scarf, Fang grey wolf); the HUD adds the player's place (`2nd`) and a progress strip with all four racers; results list all four places with names and times.
- Behavior: select is a 4x2 grid of cards (name, look, colour swatch) with the highlighted character turning on a pedestal; controls hints on every screen; everything readable at phone width and clear of the touch controls and back link; DOM updates only on change.
- Out of scope: logic, runtime, items, sound.
- Done when: `pnpm arcade check rush-racers-3d --skip-tests` passes and `see` frames of title, select, mid-race with rivals in view and results look right on desktop and `--mobile`.

### Phase 3: crates and items

Demo: open `?` crates, hold up to three items, cycle and fire them; rivals fire back.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers-3d/src/logic/items/, games/rush-racers-3d/src/logic/racer.ts, games/rush-racers-3d/src/logic/ai.ts, games/rush-racers-3d/src/logic/world.ts | contracts | | gpt-6.2-sol | pending | | |
| b | M | games/rush-racers-3d/src/engine/item-view.ts, games/rush-racers-3d/src/engine/hud.ts, games/rush-racers-3d/src/engine/track-view.ts | contracts | | gpt-6.2-sol | pending | | |

(Test cases and briefs written during phase 2.)

## Log

- 2026-11-24: phase 1 boundary review (opus): applied all four. `RacerContext.speedMul` with top speed derived from it (world built the context from the whole `World`); `racer.finished` moved to `stepWorld` so phase 2 can add `place` in one spot; `applyStage` moves every racer and lane 2a now owns `capture-stages.ts`; the runtime's scene branch is an exhaustive switch so `title`/`select` fail typecheck until handled.
- 2026-11-24: plan critique (devils-advocate, opus): applied orchestrator ownership of scenarios/smoke/fixtures/docs, confirm through readInput on fire with a delay, bests in the Runtime, stage positions derived from the course, one respawn rule with its edge cases, one frameAt shape and a turn-radius check, phase 3 lane a owning world.ts (types.ts and events.ts go in the phase 3 scaffold). Rejected: renaming character ids to the 2D game's slot ids, since this game shares no save or code with it. Accepted as a known gap: lane b sees only tick-0 frames until lane a lands; the orchestrator checks the moving views at the phase gate.
- 2026-11-24: grill settled a new 3D racer (not a 2.5D reskin), Thornwood's run medium, race + rivals + items, slug `rush-racers-3d`.
