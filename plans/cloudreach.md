# Plan: Cloudreach, the sky world

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-23. Timebox: none. Landing branch: deliver/cloudreach (worktree `/Users/riley/Projects/games/.claude/worktrees/cloudreach`), cut from deliver/rush-racers c7e4659. deliver/rush-racers lands on main first; merge its later commits into this branch as they appear.
Gate: `pnpm arcade check rush-racers && pnpm --filter game-rush-racers test:difficulty && pnpm arcade smoke rush-racers` (timed at scaffold). Filtered tests: `pnpm arcade test rush-racers <paths or @groups> [-t name]`. Typecheck: `pnpm arcade check rush-racers --skip-tests`.
Runner: plain commands (`rr suite -- rush-racers` only if this machine is busy).
Worktree setup: `pnpm install --frozen-lockfile --offline`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, todo: true
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Rush Racers gains a third world, Cloudreach: a race through a sunset sky flown Mario style. Gravity always pulls; a tap of Up flaps, holding Up glides, holding Down dives for speed you keep when you level out, and the dash is a forward burst that pops puff clouds. Thunderheads are walls, fog banks slow you, wind and updrafts carry you, bounce clouds spring you upward, boost rings speed you up, lightning strikes the storm cell on a warning, and falling out of the sky respawns you a second later. Eight flyers race on the existing ability slots, on the listed course Thunderhead Pass, which passes the same difficulty bars as Sunlit Shallows and Bramble Run.

In scope (user decisions, 2026-11-23):
- Flight controls "flap and swoop": gravity always on; a fresh Up press flaps (fixed lift); flaps unlimited with a short cooldown (about 0.2 s); Up held after a flap glides (slow fall); Down held dives and builds speed that carries into level flight; momentum (no stopping on a dime); the dash is a forward burst. No new button.
- Mixed clouds: thunderheads solid; puff clouds pop when a racer dashes into them; fog banks slow; spark clouds hurt like urchins.
- Falling out of the bottom respawns at the last safe spot about 1 s later with a short invulnerability; the lost time is the penalty.
- Full world like Thornwood: flight medium, eight new flyers with art, sky items, pickups and enemies, a sky theme, its own song, How to Play page, and one listed course that passes the bars on Easy, Normal and Hard.
- Set pieces: boost rings, bounce clouds, lightning strikes.
- Easy: lighter gravity and stronger flaps, the guide arrow points up or down at the route, and the steering assist never flaps for the player.

Out of scope: moving clouds, a flap meter, momentum-gated flaps, auto-hover, auto-scrolling, landing and walking on clouds as a mechanic, new items, changes under `packages/`, re-recording the landing page footage, per-world character picks in the save.

Assumptions (defaulted; the user can override):
- Names: world Cloudreach (`cloudreach`), medium `flight`, theme `sky`, song `cloudreach`, test course `sky-test` (unlisted), listed course Thunderhead Pass (`thunderhead-pass`), listed after Bramble Run.
- Cast, slot by slot: rudy Bumper (puffin in aviator goggles, shake it off), gil Zip (hummingbird, spring flap), streak Dart (swift, wind-up), onyx Nox (bat, ambush), nib Pip (flying squirrel with a satchel, deep pockets), baron Commodore Pouch (heavy pelican, bulldozes puff clouds), selene Luna (moth, sees in the storm cell, wisp-proof), rook Talon (hawk, frenzy).
- Sky names for shared things: clam = Balloon (a `?` balloon), pearl = Feather, urchin = Spark Cloud, jelly = Static Wisp, shark = Storm Crow, eel = Sky Eel, crab = Cloud Crab. Items: Jet Fins = Jet Pack, Bubble Shield = Cloud Shield, Puffer = Puffball, Ink Sac = Smoke Bomb, Glow Lantern = Star Lamp, Cannonball = Meteor, Homing Squid = Homing Gull, Riptide = Jet Stream, Undertow = Headwind, Mimic = Mirage. Cells: water = sky, rock = thunderhead, coral = puff cloud, kelp = fog bank, currents = wind gusts (`<` `>`), updraft (`^`), downdraft (`v`); phase 2 adds `bounce` (`B`) = bounce cloud and the ring marker (`@`) = boost ring.
- Gil's slot in flight: the flap's lift is multiplied by `jumpMulFor(racer)` (1.12 for gil), the hook run already reads; Gil's spring kick does nothing in flight (`springKick` false).
- Flight numbers (all in `FLIGHT_TUNING`, px and seconds), copying run's split between a hard cap and the cruise speed. `maxSpeed` 260 is the hard cap on horizontal speed, as the conformance suite reads it. `force` 300 is horizontal acceleration toward cruise, `drag` 140 px/s² is air friction: it bleeds speed above cruise (dash, dive carry) and slows a racer coasting with no stick, as run's `drag` is ground friction. `kick` 230 is the dash. In `extra`: cruise 120, gravity 420, maxFall 240, flapLift 150 (a flap sets `vy = min(vy, -flapLift * jumpMul)`), flapCooldownTicks 12, glideFall 50, diveAccel 520, diveMaxFall 340, diveCarry 0.55 (share of dive speed added to forward speed on letting go of Down, capped at `maxSpeed`), dashTicks 10 (the window in which a dash pops puff clouds), respawnTicks 60, respawnInvulnTicks 60, windSpeed 60, draftForce 600, fogCruiseMul 0.6. Phase 1 lane a may change values, never keys. Every `MoveModifiers` field has a visible effect: `forceMul` scales horizontal acceleration and cruise by `1 + (f - 1) * 0.5`, `kickMul` scales dash speed, `kickCooldownTicks` gates the dash, `dragMul` scales air friction.
- Easy's lighter gravity is a physics setting for the whole race, so every racer on Easy flies under it (rivals' pace on Easy stays the job of catch-up). It is stored as multipliers over `extra` in the medium (`FLIGHT_TUNING.byDifficulty.easy = { gravity: 0.75, flapLift: 1.15 }`) and applied last, after the course's own `tuning`.
- A flap reads a fresh `move.y < -0.5` and never emits `racer.kicked`, so it never spends a dash charge. Flight's `aimFrom` is full 2D like swim's (the Homing Gull, Mirage and Headwind read it), and the Easy steering assist blends only the horizontal axis in flight (`MediumEffects.assistAxes: 'horizontal'`), so it never changes `move.y` and can never flap or end a glide. `nextTile` is 8-way, so the guide arrow points up or down.
- Flying racers bump (`racerCollision: 'solid'`); trapped racers and loose power-ups sink slowly; `dashAxes: 'horizontal'`; balloons open on touch (`solidClams: false`); `pitBelow: true`; no ledges, no stomps. Kick rules: a dash dodges a Homing Gull, shakes a latch and counters a Headwind; no spring kick.
- A dash pops a puff cloud it touches during its `dashTicks` window, from any side, including one below a dashing racer that is falling onto it. A dive or dive carry alone never pops one. Baron's bulldozer still pops them on contact.
- The last safe spot is where the racer last was with rock (never coral, which can break for good) under both bottom corners somewhere below in their columns, and every column within 2 tiles either side also with rock below. A racer respawned there and given no input falls onto rock, never back into the gap.
- Rings (phase 2) are reusable: each racer is boosted by a given ring once per race (coin-trail lines), with `status.ringBoost` (45 ticks) raising `forceMul` x1.35, so cruise rises with it in flight.
- Lightning (phase 2) is a course hazard, not a world-named hazard: a column range with a period and offset; a strike stuns like a flash (cause `lightning`); invulnerable, fallen and finished racers are skipped. It runs only while racing and is a pure function of the race tick.
- New sfx (phase 2): flap, bounce, ring, lightning warn and strike; fall and respawn reuse run's. The sfx pin over Sunlit must not change.
- Thunderhead Pass is about the length of Bramble Run and 24-28 rows tall; par measured as COURSES.md says.

Error model: logic stays total over valid state and throws only for programmer errors and bad course data. Course data errors throw `LevelError` with row and col: anything `validateLevel` reports (a start that can't reach the finish without breaking puff clouds), and from phase 2 a bounce cell in a medium whose `effects.bounceSpeed` is null, a ring or lightning zone off the map, overlapping lightning zones, and a lightning period shorter than warn plus strike. A `byDifficulty` multiplier naming an extra the medium doesn't have throws `Error` naming the medium, difficulty and key (as `assertKnownExtras` does for course extras). A course naming an unknown world throws `Error` naming course and world. A world skin or theme missing art for anything the course uses fails `skins.test.ts`, `course-assets.test.ts` and boot, naming the world or course and the key.

## Contracts (scaffold commit)

Paths are under `games/rush-racers/src/`. The phase 1 scaffold also carries a crude working flight baseline (ported from `conformance/glide*.ts` and the `spike/flight` flap model) so sky-test races before the lanes land, as the run medium's scaffold did.

Generic seams (scaffold, with their tests):

    logic/media/types.ts         Medium gains ramsCoral(racer): boolean; MediumTuning gains optional byDifficulty: Partial<Record<Difficulty, Readonly<Record<string, number>>>> (multipliers over extra); MediumEffects gains assistAxes: 'both' | 'horizontal'
    logic/media/index.ts         MEDIA gains flight; effectiveTuning(world: Pick<World, 'course' | 'medium' | 'difficulty'>) applies medium base, then course.tuning, then the medium's byDifficulty multipliers for world.difficulty; cached per course and difficulty; unknown multiplier keys throw
    logic/world.ts               resolves difficulty before the first effectiveTuning call; breaks coral before the move when breaksCoralOnContact(racer) || medium.ramsCoral(racer)
    logic/guide.ts               assistedIntent blends only x when the medium's effects.assistAxes is 'horizontal'
    logic/events.ts              racer.flapped {id}
    logic/courses/types.ts       ShippedMediumId gains 'flight', ShippedCourseId gains 'sky-test'; Course.tuning cannot carry byDifficulty
    logic/courses/index.ts       COURSES gains SKY_TEST (unlisted)
    logic/worlds/types.ts        ShippedWorldId gains 'cloudreach'
    logic/worlds/index.ts        WORLDS gains CLOUDREACH
    logic/worlds/cloudreach.ts   Cloudreach's WorldDef (names from Assumptions); data only
    swim, run, glide, platform   answer ramsCoral false; assistAxes 'both' (swim, glide, platform) and 'horizontal' (run)

Flight medium (`logic/media/flight/`):

    data.ts      FlightMotion, FlightEnv and their accessors (lane a may add fields)
    way-data.ts  FlightNav, FlightPilot and their accessors (lane b may add fields)
    tuning.ts    FLIGHT_TUNING (keys fixed in the scaffold), FLIGHT_EFFECTS, FLIGHT_KICK_RULES
    physics.ts   createFlightMotion, applyFlightIntent, flightRamsCoral
    env.ts       sampleFlightEnvironment
    fall.ts      afterFlightMove: last safe spot, fall out and respawn through ../fall-out.ts
    nav.ts       buildFlightNav, flightCost, validateFlightLevel
    way.ts       flightAimFrom, flightNextTile, flightDistanceAt, flightCoralAhead
    pilot.ts     createFlightPilot, steerFlyer
    stick.ts     the pilot's stick (verticalStick, climbPress, horizontalStick) and flightPilotNumbers, read through flightExtra and dashReachPx (phase 1 boundary fix)
    index.ts     FLIGHT_MEDIUM; wiring only, complete in the scaffold

    logic/media/fall-out.ts      the shared fall, park and respawn timer: fallOut, holdParked, waitOut, isBelowLevel, respawnAt (run and flight both use it)
    logic/race/flowfield.ts      EntryCost takes a required fourth argument, the tile entered, so a medium can price tiles by position (flight's low-sky band); costs that ignore it declare fewer parameters
    logic/media/flight/physics.ts also exports flapReadyNextTick and dashReachPx, the facts the pilot reads
    logic/courses/sky-test.ts    the unlisted flight test course (scaffold: a placeholder open level)

Engine (scaffold):

    engine/worlds/cloudreach.ts      placeholder skin: Reef's art and words under id cloudreach; wiring only
    engine/worlds/index.ts           SKINS gains cloudreach
    engine/view/how-to-play/index.ts MEDIUM_PAGES gains flight, pointing at swim's move page until lane c

Later phases add their contracts in their own scaffold (phase 2: `bounce` cell and `B` glyph, `CELL_CHAR`, `Level.rings` and `@`, `LevelDef.lightning`, events, `status.ringBoost`, `HitCause 'lightning'`, `MediumEffects.bounceSpeed`, `Medium.enterCost` taking the tile like `EntryCost` (or documented as not the nav's cost), the `stepRace` calls and the race scene's view wiring; phase 3: `ThemeId 'sky'`, `SongId 'cloudreach'`, sky palette contract, `engine/worlds/cloudreach/keys.ts`).

## Phases

### Phase 1: fly it (MVP)

Scaffold: eea57e5
Tag: cloudreach/phase-1
Demo: `pnpm arcade dev rush-racers`, open `/games/rush-racers/?course=sky-test&debug=1`: flap, glide, dive and carry speed, dash through a puff cloud, ride an updraft, fall through a gap and respawn; three rivals fly the course and finish. Placeholder Reef art with Cloudreach words.
Test cases (the scaffold writes them; lanes treat them as read-only):
- Gravity: from rest with no input a racer falls, gaining `gravity * dt` per tick, and never passes `maxFall`.
- Flap: a fresh Up press (`move.y < -0.5` after a tick without) emits `racer.flapped {id}` and leaves `vy <= -flapLift`; it never emits `racer.kicked` and never spends a dash charge; holding Up does not flap again; a new press inside `flapCooldownTicks` does not flap and one after it does; tapping at the fastest rate from a hover climbs at least 3 tiles in 2 s; Gil flaps 1.12x harder, every other slot 1x.
- Glide: holding Up while falling keeps fall speed at or under `glideFall`; releasing returns to free fall.
- Dive: holding Down falls faster than free fall, up to `diveMaxFall`; letting go of Down after a 1 s dive leaves forward speed above cruise, still above cruise 1 s later, and back at cruise within 3 s (momentum).
- Cruise: holding right from rest reaches cruise within 0.6 s and holds it; releasing coasts (above half cruise 0.3 s later); `forceMul` 1.4 raises cruise by 20 %; `dragMul` changes how fast surplus speed decays; horizontal speed never passes `maxSpeed` even with forceMul 6 and the dash held (the conformance cap).
- Dash: with the cooldown at 0, the dash sets forward speed to `kick * kickMul` along facing, emits `racer.kicked`, leaves `vy` unchanged, and the surplus bleeds at `drag`; `kickCooldownTicks` gates the next one.
- Puff clouds: a racer whose dash starts this tick next to coral breaks it that same tick (`coral.broken`) and passes; one still inside the `dashTicks` window breaks it; one a tick past the window is blocked; a racer carrying dive speed without dashing is blocked; a dashing racer falling onto coral breaks it; `ramsCoral` is false in swim, run and glide, and Sunlit's top-route fingerprint and Bramble Run's tests are unchanged.
- Environment: wind cells push along their arrow, updrafts lift (a racer gliding in one rises), downdrafts push down, fog lowers cruise to `fogCruiseMul`.
- Fall out: a racer whose top passes below the last row emits `racer.fell` once, is parked for `respawnTicks` (no input, no gravity), then reappears at its last safe spot with `vy = 0`, `vx = 0`, `status.invulnerable = respawnInvulnTicks` and `racer.respawned {id, x, y}`; a respawned racer given no input for 120 ticks lands on rock and does not fall again; a spot recorded over rock whose neighbour column is a gap within 2 tiles is not saved; a spot over coral is never saved; rivals fall and return the same way. Run's respawn tests pass unchanged on the shared helper.
- Easy: with `difficulty` easy, `effectiveTuning` gives gravity x0.75 and flapLift x1.15 and a tapped climb gains more height than on Hard; Normal and Hard use the base numbers; swim's and run's tunings are identical on every level; two worlds on the same course with different difficulties get different tunings (no cache bleed); the nav built at `createWorld` on Easy uses Easy's tuning; a `byDifficulty` key the medium's `extra` lacks throws naming medium, difficulty and key.
- Assist: on Easy with a wall ahead and the guide pointing up, `assistedIntent` in flight leaves `move.y` exactly as the player held it and still slides `move.x`; in swim it blends both axes as today (`guide.test.ts` unchanged).
- Medium: `FLIGHT_MEDIUM` is in `MEDIA`; `aimFrom` points up at a climb and down at a drop; `nextTile` steps 8-way; `validateLevel` reports a start that can't reach the finish without breaking coral; conformance `CASES_BY_MEDIUM.flight` lists directions right, left and down, and geometries overhang, 1-tile gap, a climb through a shaft by flapping, a drop, and a gap over open sky; flight passes every conformance case.
- Pilot: a rival's `wobble` changes its path (two rivals differing only in wobble take different paths on seed 1); `reactionTicks` changes how late it turns; a rival never holds Up for consecutive flaps without a release (presses are real presses); every rival finishes sky-test from every start on seeds 1-5 within 1.6x par.
- Course `sky-test` (world `cloudreach`, unlisted, theme `ocean` and song `race` until phase 3): about 120 tiles by 24, with a thunderhead weave that forces a climb then a dive, a puff cloud plugging a shortcut beside a longer open route, a fog bank, an updraft column, a floor gap over open sky, feathers, balloons, a spark cloud and a static wisp; `conformance/course.test.ts` passes for it. Par is set by the orchestrator at phase landing from a measured expert run on the merged physics plus 30 %.
- Engine: `?course=sky-test` boots with no console errors; How to Play's move page for a flight course shows flight (tap Up to flap, hold Up to glide, hold Down to dive, the dash pops puff clouds) on the one move page slot; `racer.flapped` gives the racer a short wing-stroke squash (racer moments); the cloudreach skin carries Cloudreach's ability names and item, pickup, enemy and hazard words; `assertSkinAssets` passes for it; Sunlit's and Bramble Run's captures and the sfx pin are unchanged.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/media/flight/physics.ts, games/rush-racers/src/logic/media/flight/env.ts, games/rush-racers/src/logic/media/flight/fall.ts, games/rush-racers/src/logic/media/flight/tuning.ts, games/rush-racers/src/logic/media/flight/data.ts, games/rush-racers/src/logic/media/fall-out.ts, games/rush-racers/src/logic/media/run/respawn.ts | contracts, games/rush-racers/src/logic/media/run/physics.ts | games/rush-racers/src/logic/media/flight/physics.test.ts, games/rush-racers/src/logic/media/flight/puff.test.ts, games/rush-racers/src/logic/media/flight/fall.test.ts, games/rush-racers/src/logic/media/fall-out.test.ts, games/rush-racers/src/logic/media/run/respawn.test.ts, games/rush-racers/src/logic/conformance/medium.test.ts | opus | merged | deliver/cloudreach-1a | flight physics, puff, fall and conformance pass |
| b | L | games/rush-racers/src/logic/media/flight/nav.ts, games/rush-racers/src/logic/media/flight/way.ts, games/rush-racers/src/logic/media/flight/pilot.ts, games/rush-racers/src/logic/media/flight/way-data.ts, games/rush-racers/src/logic/courses/sky-test.ts | contracts, games/rush-racers/src/logic/media/run/pilot.ts | games/rush-racers/src/logic/media/flight/way.test.ts, games/rush-racers/src/logic/media/flight/pilot.test.ts, games/rush-racers/src/logic/conformance/course.test.ts | opus | merged | deliver/cloudreach-1b | flight way, pilot and sky-test conformance pass |
| c | M | games/rush-racers/src/engine/worlds/cloudreach.ts, games/rush-racers/src/engine/view/how-to-play/flight-page.ts, games/rush-racers/src/engine/view/how-to-play/index.ts, games/rush-racers/src/engine/view/racer-moments.ts | contracts | games/rush-racers/src/engine/worlds/skins.test.ts, games/rush-racers/src/engine/view/how-to-play/index.test.ts, games/rush-racers/src/engine/view/racer-moments.test.ts | opus | merged | deliver/cloudreach-1c | skin words, flight page, flap squash |

#### Lane a brief

- Goal: flight's physics, surroundings, puff popping and falls to the phase 1 test cases "Gravity" through "Fall out" and the flight conformance cases, replacing the scaffold's crude baseline, plus the shared fall-out helper with run moved onto it.
- Interface: keep the exported names in `physics.ts` (`createFlightMotion`, `applyFlightIntent`, `flightRamsCoral`), `env.ts` (`sampleFlightEnvironment`) and `fall.ts` (`afterFlightMove`); they are `Medium` members wired in `index.ts`. You may add fields to `FlightMotion` and `FlightEnv` in `data.ts` and change values in `FLIGHT_TUNING`, never its keys (lane b's pilot reads them). `fall-out.ts` exports `fallOut(racer, events, respawnTicks)`, `holdParked(racer)` and `respawnAt(racer, spot, invulnTicks, events)` (refine the signatures if needed, but both media must use them); move `run/respawn.ts`'s timer, park and respawn onto it and keep run's footing rule in `run/respawn.ts`. `jumpMulFor(racer)` from `abilities.ts` scales the flap.
- Behavior: the numbers and rules in Assumptions ("Flight numbers", "A flap reads", "A dash pops", "The last safe spot"). A flap needs a fresh press (track Up held in `FlightMotion`, as run's `upWasHeld`), and a press inside the cooldown is dropped, not buffered. Glide applies only while Up is held and the racer is falling. Dive carry is added once, on the tick Down is let go, from the downward speed at that moment. `flightRamsCoral(racer)` is true while `FlightMotion`'s dash window (set inside `applyFlightIntent` on the dash tick) is above 0. Currents are wind: `<` `>` push toward `windSpeed`, `^` `v` add `draftForce` up or down; kelp is fog (cruise x `fogCruiseMul`). Read every number from the `tuning` argument (the effective tuning), never from `FLIGHT_TUNING` directly, so Easy's multipliers apply. Fall out as run does: on the tick the racer's top passes below the last row, `fallOut`; while `status.fallen` > 0, `holdParked`; at 0, `respawnAt` the last safe spot.
- Decisions already made: the scaffold's dive-carry test fails on the starting numbers (with `drag` 140 the surplus is gone in under 1 s), so retune `drag`, `diveCarry` or both; keep `force / drag` and the conformance cases in mind. Unlimited flaps with a short cooldown; no flap meter; Down is the dive; the dash button dashes in every world; the Easy multipliers live in `FLIGHT_TUNING.byDifficulty`.
- Out of scope: the nav, way, pilot and course (lane b), the engine (lane c), rings, bounce clouds and lightning (phase 2).
- Done when: `pnpm arcade test rush-racers src/logic/media/flight/physics.test.ts src/logic/media/flight/puff.test.ts src/logic/media/flight/fall.test.ts src/logic/media/fall-out.test.ts src/logic/media/run src/logic/conformance/medium.test.ts @platform @seams @behavior src/logic/top-route.test.ts` passes and the `--skip-tests` check passes.

#### Lane b brief

- Goal: flight's navigation, way queries and rival pilot, and the real `sky-test` level, so every rival flies sky-test from every start and the Easy guide points up and down.
- Interface: keep the exported names in `nav.ts` (`buildFlightNav`, `flightCost`, `validateFlightLevel`), `way.ts` (`flightAimFrom`, `flightNextTile`, `flightDistanceAt`, `flightCoralAhead`) and `pilot.ts` (`createFlightPilot`, `steerFlyer`). You may add fields to `FlightNav` and `FlightPilot` in `way-data.ts`. Read `FlightMotion` (lane a's `data.ts`) read-only, and every physics number from the effective tuning by key (`extra.flapLift`, `extra.gravity`, `extra.flapCooldownTicks`, `extra.cruise`, `extra.glideFall`), since lane a may change values: test against the scaffold's baseline physics now and expect the orchestrator to rerun your tests on lane a's physics at landing.
- Behavior: the "Medium", "Pilot" and "Course `sky-test`" test cases. Nav is flow fields toward the finish over 8 neighbours: a steer field with coral closed and a ram field with coral passable at a cost (as swim's `ram`), rock closed, fog and currents against the way costlier, and tiles in the bottom rows over open sky priced up so rivals stay off the bottom. `aimFrom` is full 2D along the steer field. The pilot follows the way with the run pilot's press discipline (`run/pilot.ts`, `upHeld` and `canPress`): it flaps with real presses separated by releases to hold or gain altitude toward the next tile a few tiles ahead, glides when slightly above it, dives when far above it, dashes on aligned straights when `kickSkill` allows (via the `kick` draw) and uses the ram field when a dash is ready and a puff cloud blocks the shorter way; it reads the profile's `wobble` (as a jitter on the target altitude and horizontal aim, not a rotation of the stick, so it never flaps by accident), `reactionTicks` (how often it replans) and `kickSkill`; on `forceRecover` it flaps up and backs off for a beat. The sky-test level is laid out as the test case says; set `parTicks` to a rough guess (the orchestrator measures it at landing).
- Decisions already made: the Easy assist never touches `move.y` in flight (scaffold seam), so the pilot alone decides flaps for rivals; no meter; rivals routing around slower racers and reading rings, bounce clouds and lightning is phase 4.
- Out of scope: physics and falls (lane a), the engine (lane c), the skill margin between expert and novice (phase 4).
- Done when: `pnpm arcade test rush-racers src/logic/media/flight/way.test.ts src/logic/media/flight/pilot.test.ts src/logic/conformance/course.test.ts @courses @media` passes on the scaffold baseline and the `--skip-tests` check passes.

#### Lane c brief

- Goal: a flight course reads in Cloudreach's words, How to Play teaches flying, and a flap shows on the racer.
- Interface: `engine/worlds/cloudreach.ts` keeps Reef's art (`REEF_CAST` textures and `REEF_OBJECTS` textures) with Cloudreach's ability names and blurbs and `objects.text` in Cloudreach's words (follow `engine/worlds/thornwood.ts`'s placeholder history and Assumptions' names: SPRING FLAP for gil, captions with HOMING GULL, JET STREAM, HEADWIND, MIRAGE, CROW DIVES, EEL LUNGES, CLOUD CRAB, BALLOON POP, FEATHERS, SLOWED BY FOG, CLOUD SHIELD). `how-to-play/flight-page.ts` is one move page (How to Play has a fixed count of seven pages, `engine/how-to-play.ts:10`): tap Up to flap, hold Up to glide, hold Down to dive, the dash pops puff clouds, drawn as a short demo like run's page; `MEDIUM_PAGES.flight` points at it. `view/racer-moments.ts` gives a racer a short vertical wing-stroke squash on `racer.flapped`, the way it handles other moments, respecting reduced motion as the others do.
- Behavior: the "Engine" test case. On Reef and Thornwood courses nothing reads or draws differently.
- Decisions already made: Cloudreach art is phase 3; this phase uses Reef art under Cloudreach words.
- Out of scope: logic, the course, new sfx (phase 2), new art.
- Done when: `pnpm arcade test rush-racers src/engine @worlds` and `@behavior` pass, the `--skip-tests` check passes, Reef's `see --scenario how-to-play` capture is unchanged, and once lanes a and b land, a `see --query course=sky-test --input "right*30 up _*4 up _*4 up right*60"` capture shows a racer flying with no console errors.

### Phase 2: sky set pieces

Demo: on `?course=sky-test`, a bounce cloud springs a flyer up, a ring line speeds it up, and the storm cell warns then strikes, stunning anyone inside; each has its sound and a placeholder look.
Depends on: phase 1

Scaffold contents: the `bounce` cell with glyph `B` in `level/parse.ts`, `CELL_CHAR` and `toAscii`; `isSolid`/`blocksBody` treat bounce as solid on every side; every medium's cost function (swim steer, smash and ram, run's costs and terrain, glide, flight) and `progressCost` treat bounce as rock; `MediumEffects.bounceSpeed: number | null` (null for swim, run, glide and platform; flight's in `FLIGHT_EFFECTS`, starting at 300), and `createWorld` throws `LevelError` at the first bounce tile when it is null (like the ledge check); the ring marker `@` into `Level.rings: Vec[]` (open sky under it) and `World.ringsPassed: Record<RacerId, number[]>`; `LevelDef.lightning?: { cols: [number, number]; periodTicks: number; offsetTicks: number }[]` parsed into `Level.lightning` with `LevelError`s for a zone off the map, overlapping zones and a period under `LIGHTNING.warnTicks + LIGHTNING.strikeTicks` (45 and 12, in `hazards/tuning.ts`); `status.ringBoost`; `RING.boostTicks` 45 and `PASSIVE.ringBoostForceMul` 1.35; `HitCause 'lightning'` (Luna does not ignore it); events `racer.bounced {id}`, `ring.passed {id, ring}`, `lightning.warned {zone}`, `lightning.struck {zone}`; stubs `race/bounce.ts` `bounceOffClouds(world, racer, contacts)`, `pickups/rings.ts` `passRings(world, racers)`, `hazards/lightning.ts` `lightningPhase(zone, raceTick)` and `strikeLightning(world, racers)`; the calls in `world.ts` (bounce right after the medium's `afterMove`; rings beside pearls; lightning beside jellies and enemies, before contacts); the race scene constructing `ring-view` and `lightning-view` stubs; `assertCourseAssets` failing when a course uses a base cell its theme has no tile for; and sky-test gaining a bounce cloud, a ring line and a storm cell with one lightning zone. Parse and `createWorld` checks get their tests in the scaffold.

Test cases:
- Bounce: `B` parses to `bounce` and `toAscii` prints it; a flight racer coming down onto a bounce cloud (floor contact with a bounce tile under either bottom corner) leaves that tick with `vy = -bounceSpeed` and emits `racer.bounced {id}`; it bounces again each time it comes back down; meeting one from the side or below just blocks; a racer parked after a fall never bounces; a swim or run course with a `B` throws `LevelError` at its row and col; a rival's nav treats bounce as closed.
- Rings: `@` parses into `Level.rings`; a racer overlapping a ring's tile gets `status.ringBoost = RING.boostTicks` and emits `ring.passed {id, ring}`; passing the same ring again does nothing; the next ring in a line refreshes the boost to full; another racer passing the same ring is boosted too; a fallen or finished racer is not; while `ringBoost` > 0, `withPassives` multiplies `forceMul` by `ringBoostForceMul`, so a flyer holding right goes faster than without it; the boost counts down with the other statuses.
- Lightning: `lightningPhase` is 'calm', then 'warning' for the last `warnTicks + strikeTicks` to `strikeTicks` ticks of each period, then 'strike' for the last `strikeTicks`, shifted by `offsetTicks`, the same for the same race tick; `lightning.warned {zone}` is emitted on a zone's first warning tick and `lightning.struck {zone}` on its first strike tick, once per cycle; during a strike every unfinished racer whose box overlaps the zone's columns at any height is hit with cause `lightning` (a stun, as a flash) unless invulnerable, fallen or shielded the way other hits are; a racer outside the columns is untouched; nothing happens before the start or after the race ends; two runs from the same seed strike the same racers on the same ticks.
- Engine: rings draw on sky-test and sparkle when the player passes one; a zone shows a warning (darkening cloud band and column shimmer) during 'warning' and a bolt during 'strike', with the screen flash skipped under reduced motion; the ocean theme draws a placeholder bounce tile (sky-test uses ocean until phase 3); sfx for flap, bounce, ring, lightning warn and strike play from their events; the sfx pin over Sunlit and the Sunlit and Bramble Run captures are unchanged; `?course=sky-test` boots with no console errors.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/pickups/rings.ts, games/rush-racers/src/logic/race/bounce.ts, games/rush-racers/src/logic/powerups/passives.ts | contracts, games/rush-racers/src/logic/pickups/pearls.ts | games/rush-racers/src/logic/pickups/rings.test.ts, games/rush-racers/src/logic/race/bounce.test.ts | opus | pending | | rings and bounce tests pass |
| b | M | games/rush-racers/src/logic/hazards/lightning.ts | contracts, games/rush-racers/src/logic/hazards/contacts.ts | games/rush-racers/src/logic/hazards/lightning.test.ts | opus | pending | | lightning tests pass |
| c | M | games/rush-racers/src/engine/view/ring-view.ts, games/rush-racers/src/engine/view/lightning-view.ts, games/rush-racers/src/engine/audio/adapter.ts, games/rush-racers/src/engine/audio/sky-sfx.ts, games/rush-racers/src/engine/fx/event-effects.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/themes/ocean/sprites/terrain.ts | contracts | games/rush-racers/src/engine/audio/sfx-pin.test.ts, games/rush-racers/src/engine/audio/adapter.test.ts, games/rush-racers/src/engine/themes/course-assets.test.ts | opus | pending | | views and sfx, Sunlit pin unchanged |

#### Lane a brief

- Goal: bounce clouds spring flyers upward and boost rings speed them up, to the phase 2 test cases "Bounce" and "Rings".
- Interface: `race/bounce.ts` `bounceOffClouds(world, racer, contacts)` (called by `world.ts` right after the medium's `afterMove`), reading `mediumOf(world).effects.bounceSpeed` and doing nothing when it is null; `pickups/rings.ts` `passRings(world, racers)` (called beside the pearls), recording passes in `world.ringsPassed`; `powerups/passives.ts` `withPassives` folds `status.ringBoost` into `forceMul` with `PASSIVE.ringBoostForceMul`.
- Behavior: the test cases. Bounce reads the tiles under the body's bottom corners after the move; a ring is passed when the racer's hitbox overlaps the ring's tile (as pearls are touched).
- Decisions already made: rings are never used up and boost each racer once per ring per race; the boost is a `forceMul` multiplier, so in flight it raises cruise; bounce speed is the medium's number.
- Out of scope: lightning (lane b), the engine and sfx (lane c), rivals seeking rings or bounces (phase 4).
- Done when: `pnpm arcade test rush-racers src/logic/pickups src/logic/race src/logic/powerups @flight @seams @behavior src/logic/top-route.test.ts` passes and the `--skip-tests` check passes.

#### Lane b brief

- Goal: lightning strikes in a course's storm zones on a warning, to the phase 2 "Lightning" test cases.
- Interface: `hazards/lightning.ts` `lightningPhase(zone, raceTick): 'calm' | 'warning' | 'strike'` (pure), and `strikeLightning(world, racers)` (called from `stepRace` beside jellies and enemies) which emits the zone events and hits racers through `applyHit` in `hazards/hits.ts` with cause `lightning`. Read `race.raceTick` the way other racing-only systems do.
- Behavior: the test cases. A zone's box is its columns over the level's full height. Events fire once per cycle on the phase's first tick. Hits go through `applyHit` so invulnerability, shields and the fallen rule apply as for every hit.
- Decisions already made: lightning is a course hazard (no world name); a strike stuns like a flash; no rng.
- Out of scope: rings and bounce (lane a), the engine (lane c), rivals dodging strikes (phase 4).
- Done when: `pnpm arcade test rush-racers src/logic/hazards @flight @seams @behavior src/logic/top-route.test.ts` passes and the `--skip-tests` check passes.

#### Lane c brief

- Goal: rings, lightning and bounce clouds are visible and audible on sky-test, with Reef and Thornwood unchanged.
- Interface: `view/ring-view.ts` and `view/lightning-view.ts` (the race scene constructs them in the scaffold; keep their constructor and `sync` signatures) draw from logic state and drained events with their own code-drawn textures (global art, like the dash pip), since the sky theme comes in phase 3; `audio/sky-sfx.ts` defines flap, bounce, ring, lightning warn and strike sounds in the game's sfx notation and `audio/adapter.ts` plays them from `racer.flapped`, `racer.bounced`, `ring.passed` (the player's only), `lightning.warned` and `lightning.struck`; `fx/event-effects.ts` adds a small puff on bounce and sparkle on a ring pass; the ocean theme gets a placeholder bounce tile (a pale springy cloud block) so `assertCourseAssets` passes for sky-test.
- Behavior: the "Engine" test case. Lightning's warning reads at a glance from off screen (the column shimmer reaches the camera edge); its screen flash and shake respect reduced motion as other effects do; the warn sound plays only for zones near the camera.
- Decisions already made: placeholder looks until phase 3's sky theme, which may restyle them; sfx stay quiet relative to the race song.
- Out of scope: logic (lanes a and b), the sky theme and Cloudreach art (phase 3).
- Done when: `pnpm arcade test rush-racers src/engine @behavior @worlds` passes (the sfx pin over Sunlit unchanged), the `--skip-tests` check passes, and a `see --query course=sky-test` capture that flies into the bounce cloud, the ring line and the storm cell shows each with no console errors (look at the frames).

### Phase 3: Cloudreach art, sky theme and song

Demo: `?course=sky-test` in the sky theme with the eight flyers, sky items, balloons, feathers, enemies, rings, bounce clouds, lightning and the Cloudreach song.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/cloudreach/cast.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/racers.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/portraits.ts | contracts | games/rush-racers/src/engine/worlds/cloudreach/cast.test.ts, games/rush-racers/src/engine/art/sprites/sprites.test.ts | opus | pending | | cast art covers every slot, contrast holds |
| b | M | games/rush-racers/src/engine/worlds/cloudreach/objects.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/items.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/pickups.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/enemies.ts, games/rush-racers/src/engine/worlds/cloudreach/sprites/attack.ts | contracts | games/rush-racers/src/engine/worlds/cloudreach/objects.test.ts | opus | pending | | object art covers every key |
| c | M | games/rush-racers/src/engine/themes/sky.ts, games/rush-racers/src/engine/themes/sky/, games/rush-racers/src/engine/audio/songs/cloudreach.ts | contracts, games/rush-racers/src/engine/themes/forest.ts | games/rush-racers/src/engine/themes/sky.test.ts | opus | pending | | theme and song resolve, contrast holds |

### Phase 4: rivals that fly well

Demo: rivals on `sky-test` pop puff clouds with a dash when it pays, follow ring lines, use bounce clouds, wait out or race past lightning warnings, and pass slower flyers instead of stacking behind them; the expert clearly beats the novice.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/media/flight/nav.ts, games/rush-racers/src/logic/media/flight/way.ts, games/rush-racers/src/logic/media/flight/pilot.ts, games/rush-racers/src/logic/media/flight/way-data.ts | contracts, games/rush-racers/src/logic/media/flight/physics.ts | games/rush-racers/src/logic/media/flight/pilot.test.ts, games/rush-racers/src/logic/difficulty/sky-skill.test.ts | opus | pending | | pilot tests and skill margin pass |

### Phase 5: Thunderhead Pass

Demo: course select lists Sunlit Shallows, Bramble Run and Thunderhead Pass; race Thunderhead Pass on each level; the bars pass.
Depends on: phase 3, phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/logic/difficulty/ | contracts, games/rush-racers/COURSES.md | games/rush-racers/src/logic/conformance/course.test.ts | opus | pending | | Thunderhead Pass bars pass |
| b | M | games/rush-racers/scenarios/, games/rush-racers/tests/, games/rush-racers/DESIGN.md, games/rush-racers/COURSES.md, games/rush-racers/UI.md | contracts | games/rush-racers/tests/smoke.spec.ts | opus | pending | | scenarios and smoke pass |

## Log

- 2026-11-23: user decisions from two grill rounds (controls flap and swoop, mixed clouds, fall-out respawn, full world, unlimited flaps with a short cooldown, rings + bounce clouds + lightning, Easy lighter gravity and guide). Land orchestrator's advice taken: lift run's fall/park/respawn timer into a shared helper; check expert beats novice (Thornwood's weak dash failed 27 of 65 bars); rivals must pass slower racers; profile wobble must reach the pilot; scenarios needing exact run-ups race on HARD_SAVE; namespace texture keys per world; clamOpen = ready, clamClosed = used.
- 2026-11-23 plan critique (devils-advocate, opus), all applied: (1) `maxSpeed` is the conformance suite's hard cap, so flight copies run's split (cap 260, cruise in `extra`, `drag` as air friction) and gets a `CASES_BY_MEDIUM` entry (right, left, down; holding Up flaps once, so no upward case); (2) lanes a and b shared `data.ts` and `index.ts`, so nav and pilot shapes moved to `way-data.ts`, `index.ts` is complete in the scaffold, `FLIGHT_TUNING` keys are fixed there, par is measured at landing and the skill margin moved to phase 4; (3) `effectiveTuning` takes the difficulty and caches per course and difficulty, `createWorld` resolves difficulty first, multipliers apply after course tuning and are checked; (4) the last safe spot needs rock (not coral) under both corners with 2 tiles of clearance, with tests for an idle respawn and broken coral; (5) `ramsCoral` reads a dash window set inside `applyIntent`, tested on the first tick, the window's end, a dive carry and falling onto coral; (6) a horizontal `aimFrom` breaks the Homing Gull, Mirage and Headwind and the assist could still end a glide or fake a press, so `aimFrom` stays 2D and a new `MediumEffects.assistAxes` keeps the assist off `move.y` in flight; (7) the pilot reads wobble as altitude and aim jitter, reactionTicks and kickSkill, with tests that each changes a rival's path, and the 320-race margin goes to the difficulty project in phase 4; (8) `racer.flapped`, the shipped-id registries, `SKINS` and `MEDIUM_PAGES` are in the scaffold, lane c owns `racer-moments.ts`, How to Play gets one flight move page, and phase 2's scaffold owns `world.ts`, `parse.ts`, `CELL_CHAR` and the race scene wiring while its lane c owns the audio adapter and event effects. Not asked of the user: whether Easy's gravity applies to rivals; defaulted to the whole race (Assumptions), since it is physics and rivals' Easy pace is catch-up's job.
- 2026-11-23 phase 1 landing: lanes a, b, c merged with lane review fixes; main (the land world) merged in, run's pit-edge run-up kept through the shared fall-out timer; sky-test par 1106 (expert mean 851 over 400 Hard races + 30 %); gate green in 184 s (check 19 s, difficulty 142 bars, smoke 72). Boundary review, all four applied in `phase 1: boundary fixes`: physics exports flapReadyNextTick and dashReachPx; one tuning reader (stick.ts); waitOut and isBelowLevel in fall-out.ts; EntryCost's tile required. Deferred to phase 2's scaffold: Medium.enterCost and the tile. Deferred to the final review: four copies of the How to Play dash lurch.
