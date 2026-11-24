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
- Phase 1 (engine only, no logic or hash change): section callouts and a course intro card; distinct fire and impact visuals per item kind and movement particles per medium; distinct sounds per item kind and per-medium movement sounds.
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

Demo: `pnpm arcade see rush-racers --scene race --query course=<id> --input "right*900" --at 200,500,900` on each listed course; a section callout shows on entering each zone, items and movement leave distinct particles and sounds.
Checkpoint: 81 min after start (epoch 1795497854).
Test cases: listed per lane below.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/courses/types.ts, games/rush-racers/src/logic/courses/sunlit-shallows.ts, games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/logic/courses/thunderhead-pass.ts, games/rush-racers/src/logic/courses/slingshot-alley.ts, games/rush-racers/src/logic/courses/index.test.ts, games/rush-racers/src/engine/view/section-callout.ts, games/rush-racers/src/engine/view/section-callout.test.ts, games/rush-racers/src/engine/view/course-intro.ts, games/rush-racers/src/engine/view/course-intro.test.ts, games/rush-racers/src/engine/scenes/race.ts, games/rush-racers/src/engine/view/race-text.ts, games/rush-racers/src/engine/view/race-text.test.ts | games/rush-racers/DESIGN.md | | opus | pending | | callout and intro tests pass, see captures show them |
| b | M | games/rush-racers/src/engine/fx/, games/rush-racers/src/engine/view/powerup-view.ts, games/rush-racers/src/engine/view/attack-view.ts, games/rush-racers/src/engine/view/racer-view.ts, games/rush-racers/src/engine/view/racer-moments.ts, games/rush-racers/src/engine/view/racer-moments.test.ts | games/rush-racers/src/engine/themes/types.ts | | opus | pending | | fx tests pass, see captures show distinct item and movement effects per world |
| c | M | games/rush-racers/src/engine/audio/ | games/rush-racers/src/engine/worlds/types.ts | | opus | pending | | audio tests pass with the sfx pin deliberately updated |

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

Demo: each listed course at its set piece with `see`, and each world's Cannonball fired from the `cannonball` stage.
Depends on: phase 1
Checkpoint: 144 min after start (epoch 1795501634). Start nothing new after it.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/setpieces/vents.ts | contracts | | opus | pending | | Sunlit vents tests and Sunlit bars pass |
| b | M | games/rush-racers/src/logic/setpieces/mushrooms.ts, games/rush-racers/src/logic/powerups/cannonball/boulder.ts | contracts | | opus | pending | | Bramble tests and bars pass |
| c | M | games/rush-racers/src/logic/setpieces/shifting-wind.ts, games/rush-racers/src/logic/powerups/cannonball/meteor.ts | contracts | | opus | pending | | Thunderhead tests and bars pass |
| d | M | games/rush-racers/src/logic/setpieces/comets.ts, games/rush-racers/src/logic/powerups/cannonball/comet.ts | contracts | | opus | pending | | Slingshot tests and bars pass |

(Owns lists, test cases and briefs finalised with the phase 2 scaffold during phase 1.)

### Phase 3: second item twist per world (stretch)

Demo: each twisted item fired from a stage in its world.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/logic/powerups/twists/ | contracts | | opus | pending | | twist tests pass |

## Log

- Phase 1 lanes write their own tests (see Assumptions); checked at landing against the brief.
