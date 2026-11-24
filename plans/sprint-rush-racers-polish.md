# Plan: Rush Racers polish, each world its own game

Skill: sprint. Profile: sprint. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Started: 1795492994 (epoch s). Timebox: 3 h. Landing branch: sprint/rush-racers-polish.
Gate: `pnpm arcade check rush-racers` plus each changed course's bars (`pnpm arcade test rush-racers src/logic/difficulty/<course>-*.test.ts`) and `pnpm arcade smoke rush-racers`. Filtered tests: `pnpm arcade test rush-racers <paths or @group>`. Typecheck: `pnpm arcade check rush-racers --skip-tests`.
Runner: plain commands (`rr suite -- rush-racers` offloads the slow project when the machine is busy).
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline`.

## Spec

Rush Racers' four worlds share one item set, one race framing and similar course rhythm, so a race in Thornwood plays much like one in Cloudreach. This sprint makes each world and each course feel like its own game: distinct item and movement feel, sections that announce themselves, a signature set piece per course, and items that use their world's medium.

In scope:
- Phase 1 (engine plus non-hashed course data; no simulation or hash change): section callouts and a course intro card; distinct fire and impact visuals per item kind and movement particles per medium; distinct sounds per item kind and per-medium movement sounds.
- Phase 2 (logic): one signature set piece per listed course, and a world-specific Cannonball (Thornwood rolls a Boulder, Cloudreach drops a Meteor on the leader, Farside launches a Comet that wells bend). Reef keeps its items as designed. Each changed course re-passes its own bars and re-measures par if its route length changed.
- Phase 3 (logic, stretch): a second item twist per non-Reef world.

Out of scope: new courses, new worlds, roster changes, art restyle of terrain or backdrops, online protocol changes, save shape changes.

Assumptions (user can override):
- Reef keeps the original item behaviours; the twists are for the worlds whose items were reskins of swim items.
- Sunlit Shallows' set piece must leave `TOP_ROUTE` finishing (re-record it if the course changes under it).
- Section names are engine-facing course data (`Course.sections`), not hashed world state.
- Lanes in phase 1 write their own tests (engine views and audio parts), since the work is judged by `see` captures more than by assertions.

Error model: course data that names an invalid set piece (off the map, overlapping, bad timing) throws `LevelError` from `parseLevel`, like lightning zones and wells. Engine views never throw on missing optional data; a course without `sections` shows no callouts. Everything in logic stays deterministic: no `Math.random`, no inexact `Math` members, state on `World` so `hashWorld` covers it.

## Contracts (scaffold commit)

Phase 1 adds no shared contracts: each lane owns disjoint files and wires itself.

Phase 2 contracts are committed in its scaffold: per-course set piece modules under `src/logic/setpieces/`, per-world Cannonball modules under `src/logic/powerups/cannonball/`, their state on `World`, their `LevelDef` fields and parse hooks, their event types, and the tick-order calls in `world.ts` as no-op stubs.

## Phases

### Phase 1: feel and framing (MVP)

Scaffold: e044492af045b439ce1c3f338a9299448cb6fea1
Tag: polish-phase-1
Demo: `pnpm arcade see rush-racers --scene race --query course=<id> --input "right*900" --at 200,500,900` on each listed course; a section callout shows on entering each zone after the first, items and movement leave distinct particles and sounds.
Checkpoint: 81 min after start (epoch 1795497854).
Test cases: listed per lane below.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/courses/types.ts, games/rush-racers/src/logic/courses/sunlit-shallows.ts, games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/logic/courses/slingshot-alley.ts, games/rush-racers/src/logic/courses/index.test.ts, games/rush-racers/src/engine/view/section-callout.ts, games/rush-racers/src/engine/view/section-callout.test.ts, games/rush-racers/src/engine/view/course-intro.ts, games/rush-racers/src/engine/view/course-intro.test.ts, games/rush-racers/src/engine/scenes/race.ts, games/rush-racers/src/engine/view/race-text.ts, games/rush-racers/src/engine/view/race-text.test.ts | games/rush-racers/DESIGN.md | | opus | merged | sprint/rush-racers-polish-1a | callout and intro tests pass, see captures show them |
| b | M | games/rush-racers/src/engine/fx/, games/rush-racers/src/engine/view/powerup-view.ts, games/rush-racers/src/engine/view/attack-view.ts, games/rush-racers/src/engine/view/racer-view.ts, games/rush-racers/src/engine/view/racer-moments.ts, games/rush-racers/src/engine/view/racer-moments.test.ts | games/rush-racers/src/engine/themes/types.ts | | opus | merged | sprint/rush-racers-polish-1b | fx tests pass, see captures show distinct item and movement effects per world |
| c | M | games/rush-racers/src/engine/audio/ | games/rush-racers/src/engine/worlds/types.ts | | opus | merged | sprint/rush-racers-polish-1c | audio tests pass with the sfx pin deliberately updated |

#### Lane a brief

- Goal: courses announce themselves. A course intro card during the countdown names the course and its world, and a section callout slides in when the local racer enters each named zone of a course, so a long course reads as a run of distinct places.
- Interface: add an optional `sections?: readonly CourseSection[]` to `Course` in `logic/courses/types.ts`, with `export interface CourseSection { fromCol: number; name: string }` (sorted by `fromCol`, names upper case, at most 18 characters so they fit the pixel font at the race's scale). Fill it for the four listed courses from DESIGN.md's zone lists (Sunlit Shallows: THE REEF 0, CURRENT HIGHWAY 95, JELLY FIELD 247, THE SURFACE 365, URCHIN GAUNTLET 461, CORAL GATE 563, THE DARK CAVE 628; Bramble Run, Thunderhead Pass and Slingshot Alley: read each course file's level and comments to find its zones' start columns and name 3-6 zones in that world's voice). A pure function `sectionAt(sections, col): number` (index, -1 before the first) lives in `engine/view/section-callout.ts` with the view `createSectionCallout(scene, world)` that tracks the local racer (`engine/local-racer.ts`). The intro card is `engine/view/course-intro.ts`, built by `scenes/race.ts` alongside the countdown in `race-text.ts`.
- Behavior:
  - The intro card shows from the countdown's first number until GO: course name large, world name and a one-line world tagline small (for example REEF: SWIM; THORNWOOD: RUN AND JUMP; CLOUDREACH: FLAP AND SOAR; FARSIDE: DRIFT ON THRUSTERS), in the world's accent colour from the theme (pick from the theme's existing palette constants; never a new global colour). It must not cover the countdown numeral or the level banner under it.
  - A callout shows the section name for about 2 s when the local racer's column first crosses into a section whose index is higher than any it has entered this race; going back and forth over a boundary never repeats it. The first section is not called out (the intro card covers it).
  - The callout eases in and out (slide plus fade, about 12 ticks each); under reduced motion it appears and disappears without sliding. It sits under the HUD and clear of the hint and guide positions (`view/beside-player.ts`, `UI.md` safe zones).
  - The view advances per world tick, not per rendered frame, so a `see` capture at tick N is the same however frames were split.
  - `debugSummary()` is not in your files, so no new summary fields; tests cover `sectionAt` and the callout's once-per-section rule with a fake world, and the intro card's text.
  - A course with no `sections` shows no callouts and no error. Unlisted test courses get none.
- Decisions already made: section data is engine-facing course data and not hashed; `parTicks`, levels and tuning are untouched.
- Out of scope: any change to the level ASCII, logic, HUD layout or results screen. Don't edit DESIGN.md; report the text it needs and the orchestrator adds it.
- Done when: `pnpm arcade test rush-racers src/engine/view/section-callout.test.ts src/engine/view/course-intro.test.ts src/engine/view/race-text.test.ts src/logic/courses` passes, `pnpm arcade check rush-racers --skip-tests` passes, and you have looked at `pnpm arcade see rush-racers --scene race --query course=sunlit-shallows --input "right*1500" --at 60,1100` and a Bramble Run capture showing the intro card and a callout.

#### Lane b brief

- Goal: items and movement look different from each other and from world to world. Today most item fires and hits share a puff of the theme's bubbles; make each item kind's fire and impact read distinctly, and give each medium its own movement particles.
- Interface: everything under `engine/fx/`, plus `view/powerup-view.ts`, `view/attack-view.ts`, `view/racer-view.ts`, `view/racer-moments.ts`. Read events from `logic/events.ts` (do not edit). Read theme data from `themes/types.ts` (do not edit); if a theme needs a new colour or texture, derive it in `fx/` from the theme's existing values or the world skin (`skinFor(courseOf(world))`), and report anything you could not do without editing a theme.
- Behavior:
  - Item fire: each `item.used` kind gets its own burst shape and colour: Jet Fins a flame streak behind the racer; Bubble Shield fire a ring that expands; Puffer a spiky burst; Ink Sac a dark cloud; Glow Lantern a bright radial flash; Cannonball a heavy dust ring plus streak; Homing Squid a small launch puff; Riptide streaks along the lane; Undertow inward-pulling lines; Mimic a shimmer. Use the world's look: in Thornwood leaves and dust rather than bubbles, in Cloudreach cloud puffs and feathers, in Farside sparks and plasma. A table from (kind, theme id) to effect recipe is the clean shape; keep the recipe table in its own module.
  - Impacts: `racer.hit` by cause gets a distinct burst (urchin spikes, jelly zap, bubble pop, flash sparkle, enemy thump); `shield.popped` a shard ring; keep shake rules unchanged.
  - Movement: run gets dust puffs on `racer.jumped` and on landing (derive landing from the racer leaving the air between ticks in world state) and a small skid puff on a hard turn; flight gets a feather or wisp puff on `racer.flapped` and a speed streak while diving; drift gets a thruster flame opposite the burn direction while thrusting and a spark on `racer.rebounded`; swim keeps its bubble trail. Racer squash and stretch on jump, land and flap in `racer-view.ts`.
  - All particles come from the cosmetic rng, advance per world tick in `onEvents`, respect the particle capacities (raise them only if a capture shows starved effects, and say so), and under reduced motion hold still or shrink as the existing effects do.
  - No change to logic state, the tick rate, or shake magnitudes.
- Decisions already made: engine only; no new hashed state; theme files and art keys are not yours.
- Out of scope: audio, HUD, menus, terrain art, backdrops.
- Done when: `pnpm arcade test rush-racers src/engine/fx src/engine/view/racer-moments.test.ts` passes, `pnpm arcade check rush-racers --skip-tests` passes, and you have looked at `see` captures on all four courses: `--scene race --query course=<id> --query stage=icons-a` and `--query stage=cannonball` with fire inputs (`--input "_*10 fire _*30"`), plus a run, a flight and a drift capture showing movement particles (`?course=run-test`, `sky-test`, `drift-test` with `--input "right*60 up right*40"`). Check `pnpm arcade see --help` for the input names.

#### Lane c brief

- Goal: the soundscape tells items and worlds apart. Each item kind gets its own fire sound, and each medium its own movement sounds, so a Thornwood race sounds like running and a Farside race like thrusters.
- Interface: everything under `engine/audio/`. `adapter.ts` maps events to sounds; `sfx.ts` holds the parts; `sky-sfx.ts` and `attack-sfx.ts` are existing effect sets. Add a per-world or per-medium sound set module (for example `audio/move-sfx.ts`, and `audio/item-sfx.ts` for the per-kind fire table) rather than growing `sfx.ts` past about 250 lines. The adapter knows the course (and so the world and medium) through `courseOf(world)`; read `engine/worlds/types.ts` for world ids.
- Behavior:
  - `item.used` plays a sound per kind (Jet Fins a rising whoosh, Bubble Shield a wobble, Puffer a puff-up, Ink Sac a splat, Glow Lantern a chime, Cannonball a low boom, Homing Squid a chirp launch, Riptide a rushing hiss, Undertow a descending pull, Mimic a shimmer), with the world's flavour where it costs little (a duller thud in Thornwood, airier in Cloudreach, a ring-modulated or square edge in Farside).
  - Movement: run plays a short hop on `racer.jumped` and a soft step pattern while the local racer runs on the ground (at most one step every 14 ticks, only for the local racer); flight keeps its flap; drift plays a low thruster hum or short burn ticks while the local racer thrusts (derived from its velocity change), and a clank on `racer.rebounded`; swim keeps its kick.
  - Only the local racer's movement sounds play; rivals' item fires keep the existing hearing range rule.
  - The existing four-voice limit and sequencer timing stay; nothing new may starve the song (keep new parts short, and test that).
  - The sfx pin (`audio/sfx-pin.test.ts`, the `@behavior` group) will change: update it deliberately and say which entries changed and why in your report.
- Decisions already made: engine only. The song per world is unchanged.
- Out of scope: songs, the synth's voice count, visual effects.
- Done when: `pnpm arcade test rush-racers src/engine/audio` passes, `pnpm arcade check rush-racers --skip-tests` passes, and `pnpm arcade see rush-racers --scenario audio-plays` passes. Run a `see` with `--events audio` on Bramble Run and Slingshot Alley (`--query course=<id> --input "right*300 up right*60"`) and report the sound keys you see.

### Phase 2: each course and world plays differently

Demo: each listed course at its set piece with `see`, and each world's Cannonball fired from the `cannonball` stage (`--query stage=cannonball --query course=<id>`).
Depends on: phase 1
Scaffold: 59d3ab35515ae6df8c1ffbb31fb98624e97b2d86
Checkpoint: 144 min after start (epoch 1795501634). Start nothing new after it.
Test cases: per lane below. The scaffold commits the contracts with no-op stubs: a stub throws only when its course has data for it, so the gate stays green and each lane's own tests define done.

Contracts in the scaffold (read-only to lanes):
- `logic/types.ts`: `VentDef`, `ShiftingWindDef`, `AsteroidDef` (`LevelDef.vents`, `.shiftingWind`, `.asteroids`; `Level.vents`, `.shiftingWind`, `.asteroids`), `HitCause` gains `'asteroid' | 'boulder' | 'meteor' | 'comet'`, `CannonballShotStyle`, `Shot`, `World.shots`.
- `logic/events.ts`: `vent.warned`, `vent.erupted`, `wind.warned`, `wind.shifted`, `shot.launched`, `shot.warned`, `shot.ended`.
- `logic/level/parse.ts` calls `parseVents`, `parseShiftingWind`, `parseAsteroids`.
- `logic/world.ts` tick order: `advanceShots` after `advanceProjectiles`; `eruptVents`, `blowShiftingWind`, `strikeAsteroids` after `strikeLightning`, before contacts.
- `logic/powerups/cannonball/index.ts`: `CannonballShotRules { fire, advance, breaksCoral, rivalWants }`, `shotStyleOf(world)` from `WorldDef.cannonball`, `advanceShots`. `powerups/use.ts` fires the world's style instead of the swim dash; `ai/items.ts` asks `rivalWants` and skips a non-breaking style for coral.
- `logic/worlds/types.ts`: `WorldDef.cannonball?: CannonballShotStyle`.
- Engine: a lane draws its set piece and shot as layers its theme returns from `extraLayers(scene, world)` (`ThemeLayer.sync(world)` every frame; draw from `world.tick`, `world.level` and `world.shots`), so no lane edits `scenes/race.ts`. Sounds and the shared fx for the new events are added by the orchestrator at landing; report which you want.

Rules every lane follows:
- Logic stays deterministic: no `Math.random`, `Date`, `**` or inexact `Math` members (`logic/num.ts`); timers are pure functions of `world.race` tick or state on `World` (hashed by its generic walk).
- On Easy a rival's shot never targets or hits a human (`mayAttack` in `difficulty-level.ts`); the Easy bars check it.
- Invulnerable, fallen, finished racers are skipped as lightning skips them; `applyHit` (`hazards/hits.ts`) does shields, drops and stuns.
- Your course must keep passing its bars: measure first with `node games/rush-racers/scripts/measure.ts race <course> --bot expert --difficulty hard` and `--bot toddler --difficulty easy` (COURSES.md "Difficulty bars"), tune your course file, then run your course's bar files: `pnpm arcade test rush-racers src/logic/difficulty/<course>-<char>.test.ts` etc. for every file with your course's prefix (Sunlit's are the files without a course prefix). Re-measure `parTicks` with `measure.ts par <course> --seeds 40` if the expert's mean finish leaves the 0.92-1.08 band, and write the number with a comment.
- Conformance: `pnpm arcade test rush-racers @courses @seams`.
- Add a scenario for the set piece and one for the shot (on your world's test course if it has one, so it never depends on the listed course's layout), and look at a `see` capture of each.
- Don't edit DESIGN.md, COURSES.md or docs/repo-map.md; report the text they need.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/setpieces/vents.ts, games/rush-racers/src/logic/setpieces/vents.test.ts, games/rush-racers/src/logic/courses/sunlit-shallows.ts, games/rush-racers/src/logic/top-route.test.ts, games/rush-racers/scenarios/kit.ts, games/rush-racers/scenarios/vent-launch.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/themes/ocean/, games/rush-racers/src/engine/view/vent-view.ts, games/rush-racers/src/engine/view/vent-view.test.ts | contracts, games/rush-racers/src/logic/hazards/lightning.ts | | opus | running | sprint/rush-racers-polish-2a | vents tests, Sunlit bars, top route and conformance pass |
| b | M | games/rush-racers/src/logic/media/run/, games/rush-racers/src/logic/race/bounce.ts, games/rush-racers/src/logic/race/bounce.test.ts, games/rush-racers/src/logic/powerups/cannonball/boulder.ts, games/rush-racers/src/logic/powerups/cannonball/boulder.test.ts, games/rush-racers/src/logic/worlds/thornwood.ts, games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/logic/courses/run-test.ts, games/rush-racers/scenarios/mushroom-bounce.ts, games/rush-racers/scenarios/boulder-roll.ts, games/rush-racers/src/engine/themes/forest.ts, games/rush-racers/src/engine/themes/forest/, games/rush-racers/src/engine/worlds/thornwood/, games/rush-racers/src/engine/view/boulder-view.ts, games/rush-racers/src/engine/view/boulder-view.test.ts | contracts, games/rush-racers/src/logic/media/flight/bounce-plan.ts | | opus | running | sprint/rush-racers-polish-2b | run, boulder tests, Bramble bars and conformance pass |
| c | M | games/rush-racers/src/logic/setpieces/shifting-wind.ts, games/rush-racers/src/logic/setpieces/shifting-wind.test.ts, games/rush-racers/src/logic/powerups/cannonball/meteor.ts, games/rush-racers/src/logic/powerups/cannonball/meteor.test.ts, games/rush-racers/src/logic/worlds/cloudreach.ts, games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/logic/courses/sky-test.ts, games/rush-racers/src/logic/media/flight/, games/rush-racers/scenarios/wind-shift.ts, games/rush-racers/scenarios/meteor-strike.ts, games/rush-racers/src/engine/themes/sky.ts, games/rush-racers/src/engine/themes/sky/, games/rush-racers/src/engine/worlds/cloudreach/, games/rush-racers/src/engine/view/wind-view.ts, games/rush-racers/src/engine/view/wind-view.test.ts, games/rush-racers/src/engine/view/meteor-view.ts, games/rush-racers/src/engine/view/meteor-view.test.ts | contracts, games/rush-racers/src/logic/hazards/lightning.ts | | opus | running | sprint/rush-racers-polish-2c | wind, meteor tests, Thunderhead bars and conformance pass |
| d | M | games/rush-racers/src/logic/setpieces/asteroids.ts, games/rush-racers/src/logic/setpieces/asteroids.test.ts, games/rush-racers/src/logic/powerups/cannonball/comet.ts, games/rush-racers/src/logic/powerups/cannonball/comet.test.ts, games/rush-racers/src/logic/worlds/farside.ts, games/rush-racers/src/logic/courses/slingshot-alley.ts, games/rush-racers/src/logic/courses/slingshot-alley.test.ts, games/rush-racers/src/logic/courses/drift-test.ts, games/rush-racers/src/logic/media/drift/, games/rush-racers/scenarios/asteroid-hit.ts, games/rush-racers/scenarios/comet-bend.ts, games/rush-racers/src/engine/themes/space.ts, games/rush-racers/src/engine/themes/space/, games/rush-racers/src/engine/worlds/farside/, games/rush-racers/src/engine/view/asteroid-view.ts, games/rush-racers/src/engine/view/asteroid-view.test.ts, games/rush-racers/src/engine/view/comet-view.ts, games/rush-racers/src/engine/view/comet-view.test.ts | contracts, games/rush-racers/src/logic/level/wells.ts | | opus | running | sprint/rush-racers-polish-2d | asteroid, comet tests, Slingshot bars and conformance pass |

#### Lane a brief (Sunlit Shallows: geyser vents)

- Goal: Sunlit Shallows gets geyser vents, floor vents that rumble and then erupt in a column of rushing bubbles that throws a swimmer upward. Placed under the surface section (365-460), a well-timed eruption launches you out of the water for a long breach over the shark; placed in the jelly field, an eruption is a hazard that can fling you into the high jellies. Reef keeps its items as they are.
- Interface: implement `parseVents` and `eruptVents` in `logic/setpieces/vents.ts` (signatures in the scaffold). Timing: within each `periodTicks`, shifted by `offsetTicks`, the vent warns for 45 ticks (`vent.warned` on the first), then erupts for 60 ticks (`vent.erupted` on the first); outside those it is quiet. While erupting it accelerates racers whose centre is in its column (one tile wide, or two if you find one too fiddly; say which) from its tile up to `height` tiles above upward (pick a push near 2x a strong current; the eruption must breach a racer that rides it to a surface above it). It respects `racer.status.fallen`, finished racers and trapped racers as currents do (look at how currents push in `media/swim/` for the precedent; read only).
- `parseVents` throws `LevelError` (use `errorAt` or the lightning zones' pattern) for a vent off the map, a `height` below 1, a `periodTicks` shorter than warn plus erupt (105), and two vents in one column.
- Course: place 4-6 vents in `sunlit-shallows.ts`: at least two under the surface section and one or two in the jelly field, offset so neighbours erupt out of step. Keep `TOP_ROUTE` finishing; if the vents change the top route's result, re-pin the hashes in `top-route.test.ts` (with a sentence in its comment) and re-record the route in `scenarios/kit.ts` only if it no longer finishes.
- Engine: `view/vent-view.ts` draws each vent (a crack in the floor that glows during the warning) and the eruption column (rising bubble streaks), as an ocean theme extra layer; reduced motion keeps the column but stills the bubbles.
- Tests: parse errors; quiet, warn, erupt phases by tick; a racer in the column is pushed up and one beside it isn't; a fallen or finished racer isn't; a scenario `vent-launch` that rides an eruption into a breach (use a `?stage=`-free approach: place the scenario on Sunlit at a vent under the surface, or tell me if you need a debug stage, which you don't own).
- Out of scope: new items, rival AI changes, other courses.

#### Lane b brief (Bramble Run: spring mushrooms; Thornwood's Boulder)

- Goal: Thornwood plays like a platformer with its own toys. Spring mushrooms (`B` cells drawn as big mushroom caps) launch a runner high, opening sky routes on Bramble Run; and Thornwood's Cannonball, the Boulder, becomes a thrown boulder that rolls along the ground instead of the swim dash.
- Mushrooms: give the run medium `effects.bounceSpeed` (a launch noticeably higher than a held jump, about 5-6 tiles) so `race/bounce.ts` springs a runner landing on a `B` cell, emitting `racer.bounced`. Holding jump on landing should launch higher than not holding it, if `bounce.ts` can tell (you own it; keep flight's behaviour and tests unchanged). Rivals: add a bounce link to the run jump-link graph (`media/run/links.ts`, `nav.ts`) so they take a mushroom when it is quicker. The forest theme draws `B` as a mushroom cap (glyph tile art in `engine/themes/forest/`), with a squash on `racer.bounced` if cheap. Place 3-5 mushrooms on Bramble Run that lift to the treetop route or over a pit, and add one to Run Test past its documented features (update the layout comment there) for the `mushroom-bounce` scenario.
- Boulder: set `cannonball: 'boulder'` in `logic/worlds/thornwood.ts`. `BOULDER.fire` drops a boulder (one tile) just ahead of the racer along its facing, rolling at about 180 px/s along the ground under run gravity, staying on the ground, dropping off ledges and into pits (it ends when it leaves the level: `shot.ended`). It breaks cracked stone it rolls into (`breakCoral`) and ends there. The first racer other than its owner it touches is hit (cause `'boulder'`, `by` its owner) and it ends; its owner is never hit by it. It ends after 4 s anyway. It respects `mayAttack` (Easy rivals' boulders pass through a human). `rivalWants`: a racer within 8 tiles ahead on about the same row with ground between, or cracked stone ahead. `breaksCoral: true`. A stomp on a boulder does nothing special.
- Engine: `view/boulder-view.ts` draws each boulder shot rolling (rotation from distance travelled), as a forest theme extra layer, plus dust where it ends; the Boulder's item icon stays.
- Tests: bounce on `B` in run (with and without jump held), rivals' nav uses a mushroom when it is quicker (a small inline level), boulder rolls, falls in a pit and ends, breaks cracked stone, hits a rival not its owner, Easy rival boulder passes through the player, ends after its ttl. Scenarios `mushroom-bounce` and `boulder-roll` (on `?course=run-test`, the Boulder from the `cannonball` stage: check `engine/debug-stage.ts` handles Run Test; read only).
- Out of scope: other items, collapsing branches, wall jumps.

#### Lane c brief (Thunderhead Pass: shifting wind; Cloudreach's Meteor)

- Goal: Cloudreach's sky is alive. A shifting wind zone on Thunderhead Pass turns its gust round on a timer with a windsock warning, so a flyer times their crossing or fights the headwind; and Cloudreach's Cannonball, the Meteor, falls from the sky onto the leader.
- Shifting wind: implement `parseShiftingWind` and `blowShiftingWind`. Within each `periodTicks` (shifted by `offsetTicks`) the zone blows `+x` for the first half and `-x` for the second; 60 ticks before each turn it emits `wind.warned {zone, dir}` (dir is the coming direction), and `wind.shifted` on the turn. It accelerates every in-play racer whose centre is in the columns by `push` px/s² along its direction (like a gust; read how flight applies gusts in `media/flight/`, which you own, and reuse that path if it is cleaner than a velocity push). Throws `LevelError` for a zone reversed or off the map, overlapping zones or lightning zones, a period under 240 ticks or a push that isn't positive. Place one or two zones on Thunderhead Pass where the course runs straight and level (the high road or before the storm cell), push about a gust's strength. Rivals in `media/flight/` may ignore the timer, but check the bars.
- Meteor: set `cannonball: 'meteor'` in `logic/worlds/cloudreach.ts`. `METEOR.fire` picks the leading in-play, unfinished racer other than the owner that the owner `mayAttack` (none: it fizzles, still spending the charge, `shot.ended` at the owner); emits `shot.launched` and `shot.warned`, then for 60 ticks a shadow follows the target's x; for the last 15 of them the x locks; then it falls from the top of the sky to the first solid tile under that x at about 600 px/s, hitting (cause `'meteor'`, `by` owner) every racer within 1.5 tiles of it on the way, and ends where it lands (`shot.ended`), popping a puff cloud it lands on. The owner is never hit. `rivalWants`: the owner is not in 1st place and some other racer it may attack leads. `breaksCoral: false`.
- Engine: `view/wind-view.ts` draws the zone's wind streaks along its current direction, a windsock or arrow that swings during the warning; `view/meteor-view.ts` draws the shadow (growing as it nears) and the falling meteor with a trail. Both as sky theme extra layers.
- Tests: wind phases and direction by tick, warning before each turn, push only inside the columns; meteor picks the leader not the owner, fizzles with no target, Easy rival's meteor never targets a human, locks x for the last 15 ticks so a target that moves away is missed, hits within radius, ends on solid. Scenarios `wind-shift` (on `?course=sky-test`: add a zone past its documented features and update its layout comment) and `meteor-strike` (from the `cannonball` stage on Sky Test, the local racer fires with a rival ahead).
- Out of scope: other items, lightning changes.

#### Lane d brief (Slingshot Alley: drifting asteroids; Farside's Comet)

- Goal: Farside uses its gravity. Asteroids glide across Slingshot Alley's lanes, forcing a pilot to time a crossing; and Farside's Cannonball, the Comet, is launched as a projectile that every gravity well bends, so a skilled player curves a shot round a planet.
- Asteroids: implement `parseAsteroids`, `asteroidAt` and `strikeAsteroids`. An asteroid moves from `from` to `to` and back once per `periodTicks` (shifted by `offsetTicks`), with eased ends (a smooth turn, using only exact `Math` members: a piecewise polynomial ease, not `cos`); any in-play racer within `radius` tiles of its centre is hit (cause `'asteroid'`, `by` null), and the usual second of invulnerability stops it hitting twice. Throws `LevelError` for an end off the map, a period under 60 ticks or a radius that isn't positive. Place 4-6 asteroids on Slingshot Alley crossing the dust field lanes and the opening straight, out of step. Rivals' pilot (`media/drift/`, which you own) should slow or wait for a crossing asteroid if that is cheap; check the bars either way.
- Comet: set `cannonball: 'comet'` in `logic/worlds/farside.ts`. `COMET.fire` launches a comet from the racer along its aim at about 230 px/s; each tick it is accelerated by `pullAt(level, point)` (`level/wells.ts`) at 2x so wells visibly bend it, it ends in a black hole's horizon, against rock, or after 3 s; ice (coral) it touches breaks (`breakCoral`) and it ends; the first racer other than its owner it touches is hit (cause `'comet'`, `by` owner) and it ends. It respects `mayAttack`. `rivalWants`: a racer it may attack within 10 tiles ahead inside the aim cone, or ice ahead. `breaksCoral: true`.
- Engine: `view/asteroid-view.ts` draws each asteroid (rotating rock sprite) at `asteroidAt`, with a faint dotted track line on Easy only if cheap; `view/comet-view.ts` draws each comet with a tail. Both as space theme extra layers.
- Tests: asteroid position at its ends and midpoint, eased turn, hit on touch, no double hit inside invulnerability; comet bent toward a planet (an inline level with a well), swallowed by a horizon, breaks ice, hits a racer not its owner, Easy rival comet passes through a human. Scenarios `asteroid-hit` and `comet-bend` on `?course=drift-test` (add an asteroid past its documented features and update its layout comment; the comet from the `cannonball` stage if it supports Drift Test, else say so).
- Out of scope: other items, new wells.

### Phase 3: second item twist per world (stretch)

Demo: each twisted item fired from a stage in its world.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/powerups/twists/ | contracts | | opus | pending | | twist tests pass |

## Log

- Phase 1 lanes write their own tests (see Assumptions); checked at landing against the brief.
- Plan critique (sonnet), 5 findings, all applied: spec reworded to "course data only" for phase 1; demo wording fixed; race.ts wiring conflict between 1a and 1b resolved by telling 1b to keep factory signatures and report any race.ts lines for the orchestrator to apply at landing; extra reads sent to 1b and 1c; online HUD clearance and a sections-shape test sent to 1a, voice and rival-silence tests to 1c.
- 1/c merged. Accepted: raceWorld hook on AdapterOptions (orchestrator wired it in runtime.ts, 51baf4f); flat sfx keys; burn = 2 ticks of 3-8 px/s/tick velocity change; short burns over a hum; sfx pin `item.use` replaced by `fire.<kind>` keys. adapter.ts (283) and sfx.ts (278) over 250 lines: left for the final review.
- 1/a merged. Accepted: callout slides without fading (Label has no alpha; not worth a shared-font change); accent-coloured course name off-panel with a contrast test; callout top-left at (6,44); section names as reported. Looked at Bramble intro (tick 60) and Sunlit CURRENT HIGHWAY callout: clear of numeral, banner and HUD.
- 1/b merged. Accepted: movement read from body velocity between ticks (media internals are off limits to the engine); movement particles for all racers; ink cloud plays at the user; reduced motion halves and stills particles. Gate found the 1/c seam break (move-cues imported `media/run/data.ts` and branched on medium id) and a `fields` parameter tripping the nav-read guard in 1/b's recipe files; fixed in c329890 (world skin `moveSound`).
- Phase 1 tagged polish-phase-1 (`phase-N` tags belong to earlier sprints): check passed (20 s), smoke 100 passed. Captures: Bramble intro card, Sunlit callout, Thornwood boulder dust/leaves and Farside flame/ice shards from the cannonball stage.
