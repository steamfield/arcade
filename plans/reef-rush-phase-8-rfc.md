# RFC: Reef Rush phase 8, course and movement-style seams

Status: ready to implement. Written 2026-11-22 at the end of phase 7, for an agent who was not in the session that built phases 1-7.
Game: `games/reef-rush` (Phaser 4.2.1). Read `AGENTS.md`, `docs/repo-map.md`, `games/reef-rush/DESIGN.md` and `games/reef-rush/UI.md` before starting. The phases 1-7 plan, with its lane history and decisions, is `plans/reef-rush.md`; this RFC replaces its "Phase 8" section and keeps its "Phase 9" section as the target the seams must serve.

## 1. Why

The user wants new courses to be quick to make, including arenas that are not underwater, without a rewrite and without lowering the quality of the ocean game that exists today. Their words, 2026-11-22:

- "make sure this is built in a way that it will be easy to add new levels/arenas. This is the water level, but eventually we'll want to expand to other levels, some might not be water based."
- "phase 8 should prove out easily making a new water level, and prove the path to making a different type of level (flying in the air for example) to not be a huge rewrite... maintain the level of gameplay UX."
- "it's important that we don't nerf the quality of the ocean-based game we just built. The framework should be flexible enough to allow detailed customization."
- "each arena type should eventually have its own unique difference. For example, water has currents. Space has zero gravity. Flying has its own different physics engine. Something ground based would be more about running and jumping (kind of like Mario). (Water also has floating physics, etc). These are just examples."
- They asked how this is structured in code, and accepted composition with registries (strategy pattern), not a base game class that courses extend.

Phase 8 builds the seams with the existing ocean course as their only user, and changes no behaviour a player or a test can see. Phase 9 (separate, later) proves them: a second water course made by following a how-to doc, a flight medium, and a sky theme.

## 2. Goals and non-goals

Goals:

1. A course is data in a registry. Adding a water course means adding files, not editing generic code (the phase 9 kelp-forest lane will be held to an owned-files list to prove it).
2. A movement style (medium) is a strategy object: physics, per-racer motion state, environment sampling, navigation, rival piloting, kick rules and effect rules. Generic race code never branches on which medium it is.
3. A look (theme) is a strategy object in the engine: textures, terrain, per-glyph art, backdrop, ambient effects, particle physics, hazard skins, dark tint, contrast bands, extra view layers.
4. Best times are kept per course and per difficulty.
5. The ocean course plays, looks and sounds exactly as it does at the end of phase 7, on all three difficulty levels. This is enforced by fingerprints, captures and pinned audio (section 9).
6. `pnpm arcade check reef-rush` stays at or under 30 s on this machine.

Non-goals for phase 8:

- No new course, medium or theme ships in play (phase 9). A test-only second course and medium are fine where a conformance test needs them.
- No ground or space medium. The interface is designed so they fit (both spikes informed it), but they are later phases.
- No changes under `packages/` (AGENTS.md: they go in their own PR). Courses, media and themes live in this game and are extracted only when a second game needs them.
- No avatar changes. Characters stay aquatic; power-up art, racer sprites and UI stay global.
- No retuning of characters, power-ups or difficulty.

## 3. Where things stand after phase 7

Phase 7 delivered attack power-ups (Homing Squid, Riptide, Undertow, Mimic and their combos), Easy/Normal/Hard difficulty, How to Play, in-race hints, an Easy way-finding guide and steering assist (lane 7/e), and the final review fixes (lane 7/f: best time per difficulty in save v5, TIME UP instead of DNF, title order Race / How to play / Level / Sound / Motion, the level on the countdown, serialized save writes). Lanes 7/e and 7/f were still landing when this RFC was written, so file names below are as of the phase-7 tag plus those lanes: re-check them against main before the scaffold, and treat any mismatch as a finding to fix in this RFC's plan, not a reason to guess.

Layout that matters here (all under `games/reef-rush/src/`):

- `logic/types.ts`: `Cell` (`water rock coral kelp current-*`), `LevelDef`, `Level`, `Body`, `Environment` (`current`, `inKelp`), `MoveModifiers` (`forceMul kickMul kickCooldownTicks dragMul`), `Intent` (`move kick burst`), `RivalProfile`, `FlowFields` (`progress steer smash ram`), `Racer`, `World` (has `difficulty`).
- `logic/world.ts`: `createWorld(level, events, options)` and `stepWorld`; tick order is documented in its header. `intentFor` picks player input or `rivalIntent`; `swim` samples the environment and calls `applyIntent`.
- `logic/swim/physics.ts` (`SWIM`, `BASE_MODIFIERS`, `applyIntent`) and `logic/swim/collide.ts`.
- `logic/level/levels.ts` (`OCEAN_LEVEL`), `level/parse.ts`, `level/query.ts`.
- `logic/race/flowfield.ts` (`buildFlowFields`, entry costs `steerCost`, smash and ram variants), `race/coral.ts`, `race/standings.ts`.
- `logic/ai/rival.ts` (`rivalIntent`, `catchUpMul`, stuck handling), `ai/steer.ts` (`steerDirection`, `downhillPath`, `hasClearSweep`), `ai/avoid.ts`, `ai/items.ts`, `ai/profiles.ts` (includes `BOT_PROFILES` and the `toddler` bot).
- `logic/difficulty-level.ts`: `DIFFICULTY[level]` knob table and accessors (`tuningOf`, `statusTicks`, `playerCatchUpMul`, `mayAttack`, `itemAggressionMul`, `clamBias`, `invulnerableTicks`, `dodgeTicks`, plus the 7/e guide knobs).
- `logic/difficulty/`: `race-bots.ts` (`race(bot, character, seed, difficulty)`, not memoised today; each test file runs its own races), per-character Hard bars, Easy and Normal bars, `scripted-race.ts`, the 7/e stuck-prone bot.
- `logic/modifiers.ts` (`modifiersFor(world, racer)`), `logic/status.ts`, `logic/abilities.ts`, `logic/records.ts`, `logic/save.ts` (v5 after 7/f).
- Engine: `engine/runtime.ts` (scene flow, `startRace`, settings, persist), `engine/game.ts`, `engine/scenes/{boot,title,select,race,results,how-to-play}.ts`, `engine/art/` (`keys.ts`, `index.ts`, `sprites/*`, `palettes.ts`), `engine/view/` (`level-view`, `backdrop`, `racer-view`, `hazard-view`, `dark-view`, `hud`, `hints`, `hint-view`, guide view from 7/e, and more), `engine/fx/` (`swim-trail`, `bursts`, `textures`, `particles`), `engine/audio/` (`adapter.ts` hard-codes the race song, `songs/index.ts`).
- Scenarios: `scenarios/kit.ts` holds `TOP_ROUTE` (recorded on Hard, seed 1), `HARD_SAVE` and `TITLE_TO_RACE`. A fresh save races on Easy, so Hard-tuned scenarios start from `HARD_SAVE`.

Every file that imports the one course today (these are the places course selection must replace): `logic/difficulty/race-bots.ts`, `logic/difficulty/scripted-race.ts`, `engine/runtime.ts`, `engine/scenes/title.ts`, `engine/scenes/select.ts`, `engine/scenes/how-to-play.ts`, `scenarios/kit.ts`, `scenarios/cannonball-combo.ts`, and six test files (`grep -rn OCEAN_LEVEL games/reef-rush`).

### Where water is baked in (survey, re-verify)

Logic:
- Tile names in types, parse, query, flowfield, coral.ts, steer.ts, items.ts, world.ts.
- Swim physics (`SWIM`, `applyIntent`) and the racer hitbox size; `BASE_MODIFIERS.kickCooldownTicks` and Jet Fins' kick-rate passive.
- Trapped racers and loose power-ups float up (`status.ts`, `pickups/loose.ts`).
- The dash, knockback and Mimic decoy set velocity directly with no gravity.
- Squid dodge, squid shake-off and the Undertow counter all read the kick; the dodge window comes from `dodgeTicks(world)`.
- Rival AI decides kicks from alignment and skill, detects stuck by speed only, and assumes straight-line sweeps (`steer.ts hasClearSweep`, `avoid.ts pathIsClear`, `items.ts jetClearTiles`).
- Abilities: Gil's 1.8x steep-upward kick, Streak's wind-up test `vx*facing >= |vy|`, Baron's 0.4 force ramp; latched squids and catch-up scale force.
- Phase 7 additions: Riptide lanes add to the water current (`riptideCurrentAt`, `feltCurrent`); the Easy guide reads `fields.steer`; the Easy steering assist blends a steer direction into swim force; difficulty catch-up (`rivalCatchUp`, `lagTiles`) is measured in tiles along the progress field.
- `difficulty/race-bots.ts` hard-codes the ocean course and a 75-105 s mean bar.
- One course imported by runtime, title, select, how-to-play and race-bots; one best (per difficulty) in the save.

Engine:
- Global art keys and sheets (`art/keys.ts` `Tex.kelp`, `Tex.current*`, `TileIndex.rock/coral`; `art/index.ts` LOOPS; `sprites/index.ts`), terrain, level view, backdrop.
- fx with water drag, rising bubbles, sinking debris (`fx/swim-trail.ts`, `fx/bursts.ts`, `fx/textures.ts`, `fx/particles.ts`).
- Sprite contrast tests against `WATER_BANDS`, and UI.md's rule that only foam and sun sit off panels.
- The audio adapter hard-codes the `race` song; kick and coral sfx; the KICK! prompt; How to Play pages show swimming.

Already medium-neutral: standings, power-up and ability bookkeeping, hits, AI item choice, the dark overlay mechanics, menus, HUD layout, records logic, difficulty bookkeeping.

### Spikes (read them, never merge them)

Two throwaway branches in this repo informed the interface. They are kept as reference and must not be merged:

- `spike/flight` (cbbd8bf): `games/reef-rush/src/logic/fly/` with hold-to-thrust and flap models, rival pilots, an entry-cost function, the progress-based stuck rule and measurements (`SPIKE_REPORT=1 pnpm --filter game-reef-rush exec vitest run src/logic/fly`). Findings: hold-to-thrust with kick as an upward-biased boost won; flap-only was 57% slower, scraped walls twice as often and erased pilot skill. Gravity around 40 px/s² worked against forceMul 0.4-1.6. The progress backstop cut stuck DNFs in flight from 15 of 40 to 1 of 40 and changed 0 of 48 ocean fingerprints.
- `spike/ground` (ab5abac): `games/reef-rush/src/logic/ground/` with running-and-jumping physics, a jump-link navigation graph, a pilot and generic-step tests. Findings: a platformer cannot path through open air, so navigation must be medium-owned (flow field for swim/flight/space, jump-link graph for ground), and the medium needs its own per-racer state (grounded, coyote ticks).

## 4. Design

Composition plus registries. No base class. The world stays plain data and stores ids, not objects; behaviour is looked up from registries by id.

```
logic/courses/<id>.ts      Course data            -> COURSES (logic/courses/index.ts)
logic/media/<id>/          Medium strategy        -> MEDIA   (logic/media/index.ts)
engine/themes/<id>.ts      Theme strategy         -> THEMES  (engine/themes/index.ts)
engine/audio/songs/<id>.ts Song                   -> songs index (already exists)
```

### 4.1 Course (logic)

```ts
// logic/courses/types.ts
export type CourseId = 'sunlit-shallows';           // grows: 'kelp-forest', 'sky-test', ...
export type MediumId = 'swim';                       // grows: 'flight', later 'ground', 'space'
export type ThemeId = 'ocean';                       // engine maps ids to themes, never the reverse
export type SongId = 'race';                         // existing songs index keys

export interface Course {
  id: CourseId;
  name: string;                                      // shown on course select and results
  level: LevelDef;
  medium: MediumId;
  theme: ThemeId;
  song: SongId;
  listed: boolean;                                   // false: reachable only by ?course= (tests, previews)
  parTicks: number;                                  // a good swimmer's finish on Hard; bars derive from it
  tuning?: Partial<MediumTuning>;                    // course overrides of the medium's numbers
  catchUp?: Partial<CatchUpBounds>;                  // replaces Hard's base catch-up for this course only
}
```

- `logic/courses/sunlit-shallows.ts` holds today's `OCEAN_LEVEL` (moved, not copied; `level/levels.ts` re-exports or goes away) with `medium: 'swim'`, `theme: 'ocean'`, `song: 'race'`, `listed: true`, and `parTicks` set from the current Hard expert mean.
- `logic/courses/index.ts`: `COURSES: Record<CourseId, Course>`, `LISTED_COURSES` in a fixed order, `courseById(id: string): Course | null` (string in, for saves and URLs), `DEFAULT_COURSE`.
- Nothing outside `logic/courses/` imports a specific course file. A test asserts this (grep the source tree for imports of `courses/<id>`).
- `createWorld(course, events, options)` replaces `createWorld(level, ...)`; `World` gains `course: CourseId` and `medium: MediumId`. Keep a test helper for inline ASCII levels (most logic tests build small levels): `courseFromLevel(level, medium = 'swim')` in `logic/test-world.ts`.
- Difficulty composes with the course. Hard's `rivalCatchUp` stays the base; a course `catchUp` replaces that base for the course; Easy and Normal keep applying their own deltas on top (lag, min, max as today). Write this as one function in `difficulty-level.ts` with a test, so a course override never silently disables Easy's lag.

### 4.2 Medium (logic)

Final interface, from both spikes. Implement exactly this unless the swim refactor proves a member wrong, in which case change the RFC's plan and say why in the lane report.

```ts
// logic/media/types.ts
export interface Medium {
  id: MediumId;
  tuning: MediumTuning;                       // includes base MoveModifiers (kick cooldown etc.)
  createMotion(body: Body): RacerMotion;      // per-racer state the medium owns; swim: {}
  sampleEnvironment(world: World, body: Body): MediumEnv;
  applyIntent(racer: Racer, intent: Intent, env: MediumEnv, mods: MoveModifiers, events: EventSink<GameEvent>, dt: number): void;
  buildNav(level: Level, broken: ReadonlySet<number>): MediumNav;   // flow fields for swim and flight
  steer(world: World, racer: Racer, nav: MediumNav, mods: MoveModifiers, skill: PilotSkill, draws: AiDraws): Intent;
  enterCost(cell: Cell, isBroken: boolean, move: Vec): number;      // flow-field media; progress field stays uniform
  wayOn(world: World, racer: Racer): Vec | null;                    // the Easy guide and assist ask the medium, not the steer field
  validateLevel(level: Level, nav: MediumNav): string[];            // e.g. a start that can't reach the finish
  racerCollision: 'solid' | 'ghost';
  effects: { dashAxes: 'both' | 'horizontal'; trappedDrift: number; looseDrift: number };
  kickRules: { dodgesSquid: boolean; shakesLatch: boolean; countersUndertow: boolean; springKick(aim: Vec): boolean };
}
```

Notes on each member:

- `tuning`: today's `SWIM` constants and `BASE_MODIFIERS`. `modifiersFor` takes its base from `MEDIA[world.medium].tuning` merged with `course.tuning`.
- `createMotion` / `Racer.motion`: plain data the medium defines (a discriminated union by medium). Swim's is `{}`. Ground will need grounded and coyote ticks; flight needs nothing beyond `{}` per the spike.
- `sampleEnvironment`: swim returns today's `Environment` (`current`, `inKelp`) including the Riptide contribution (`feltCurrent`). `MediumEnv` is a union by medium.
- `applyIntent`: swim's is today's `applyIntent` moved. Every `MoveModifiers` field must have a visible effect in every medium (the conformance suite checks it).
- `buildNav` / `MediumNav`: swim's is today's `FlowFields` (`progress`, `steer`, `smash`, `ram`). Coral breaking rebuilds nav through the medium (today `race/coral.ts` calls the flowfield rebuild).
- `steer`: rival AI splits. Generic stays in `ai/rival.ts`: item choice (`wantsBurst`), the fixed per-tick rng draws (`AiDraws`, so AI rng consumption per tick never varies by medium), catch-up and the progress-based stuck backstop. Medium-owned moves behind `steer`: aim, avoidance, kick decisions, speed-based stuck recovery. Swim's `steer` is today's code moved, so its rng draws and outputs are identical.
- `Intent` gains `kickHeld: boolean` (variable jump height on ground later; swim ignores it). The engine's input reader fills it from the kick action's held state.
- `PilotSkill`: profiles gain `pilotSkill` (0..1), separate from `wobble`, defaulting so swim behaviour is unchanged.
- Stuck detection: keep swim's speed rule and add the generic progress backstop (no new best progress for 240 ticks triggers recovery). The spike showed it changes 0 ocean fingerprints; the fingerprint test is the proof here.
- `enterCost`: swim's is today's `steerCost`; smash and ram variants stay swim helpers.
- `wayOn`: new in this RFC because phase 7 added the Easy guide and steering assist, which read `fields.steer` directly. Move that read behind the medium so flight and ground can answer it from their own nav.
- `validateLevel`: runs in `createWorld` (today the sealed-start check lives there) and in the course conformance suite.
- `racerCollision`, `effects`, `kickRules`: today's behaviour expressed as data. Generic code that sets velocity directly (dash, knockback, decoy), floats trapped racers and loose power-ups, or reads the kick for squid dodge, shake-off and the Undertow counter must read these instead of assuming water. Gil's spring kick goes through `kickRules.springKick`.
- `RACER_SIZE`: the racer hitbox moves to a medium-neutral constant.
- Logic never calls `Math.exp`, `sin`, etc. (use `logic/num.ts`); a medium precomputes constants it needs.
- `MEDIA: Record<MediumId, Medium>` in `logic/media/index.ts`; `logic/media/swim/` holds the swim medium, with `swim/physics.ts` and `swim/collide.ts` moved under it or re-exported (collide stays generic if it is; decide by reading it).

### 4.3 Theme (engine)

```ts
// engine/themes/types.ts
export interface Theme {
  id: ThemeId;
  registerTextures(scene: Phaser.Scene): void;        // builds and registers its own keys and sheets at boot
  terrain: TerrainArt;                                // tiles per cell and per legend glyph, autotiling
  backdrop: BackdropSpec;                             // layers, parallax, light rays
  ambient: AmbientSpec;                               // bubbles, motes, current shimmer
  particles: ParticlePhysics;                         // rise vs drift vs fall, drag
  hazards: { urchin: HazardSkin; jelly: HazardSkin };
  dark: { colour: number; alpha: number };
  contrastBands: readonly ContrastBand[];             // the sprite contrast tests run against these
  extraLayers?: (scene: Phaser.Scene, world: World) => ThemeLayer[];
}
export function defineTheme(spec: ThemeSpec): Theme;  // fills defaults for optional parts
```

- `engine/themes/ocean.ts` is today's art moved behind `defineTheme`. Adding a theme must never edit `art/keys.ts` or `art/index.ts`; ocean's texture keys move into it (keep the existing key strings so captures are identical).
- `THEMES: Record<ThemeId, Theme>` in `engine/themes/index.ts`, registered at boot.
- fx particle physics comes from the theme (`fx/particles.ts`, `fx/bursts.ts`, `fx/swim-trail.ts`, `fx/textures.ts` read it).
- The race song comes from the course's `SongId` through the runtime; `audio/adapter.ts` stops hard-coding `race`.
- Power-up art, racer sprites, HUD and UI stay global.

### 4.4 Level glyphs and legend

Tile names stay as materials in logic and are documented as behaviours in `parse.ts`: `rock` is solid, `coral` breakable, `kelp` slow, `current-*` flow. The medium decides what slow and flow do to a body (kelp drag underwater, thick cloud in the sky). Detailed looks come from glyphs: `LevelDef.legend?: Record<string, { cell: Cell; art: string }>` maps extra glyphs to a base cell plus an art key (a shipwreck hull that is `rock`, a sand bar that is `kelp`), and `Level.glyphs: string[][]` keeps the glyph grid so a theme draws each glyph its own way. A medium may declare extra glyphs it understands (wind for flight, springs for ground) later; phase 8 only adds the mechanism and tests it with a test-only legend.

### 4.5 Save v6 and records

Save v5 (from lane 7/f) has `best: Record<Difficulty, Best | null>`. v6:

```ts
bests: Record<string, Record<Difficulty, { ticks: number; place: number } | null>>;   // keyed by course id string
lastCourse: string | null;
```

- `migrations[5]` moves v5's `best` under `'sunlit-shallows'` and sets `lastCourse: null`. Commit `tests/fixtures/save-v5.json` captured from the v5 code before changing anything, and a v6 fixture after. Never delete old fixtures. `save.test.ts` asserts the full migrated result for v5 (and the existing chain still loads v1-v4).
- Strings, not the `CourseId` union, so a save naming a removed course stays readable; reading ignores unknown course keys.
- Unlisted courses are never written to `lastCourse` and never get a best.
- Records API: `bestFor(save, courseId, difficulty)`, `recordRace(save, courseId, difficulty, result)`. Title and results show the best for the current course and level. Title and select backdrops use `lastCourse` when it is listed, else Sunlit Shallows.

### 4.6 Runtime and scenes

- Runtime holds `course: CourseId` (from `?course=`, else `lastCourse` if listed, else `DEFAULT_COURSE`). `?course=` is read by the game from `location.search` (the shell's LaunchParams carry only testMode, seed, scene and debug); an unknown id logs a warning and falls back to the default. Race again keeps the course.
- A `course` scene (course select) sits between title Race and character select. While only one course is listed it is skipped in play; it is view-tested with three test courses. Same input rules as select (arming ticks, A picks, B back).
- `startRace` builds the world from the course. `debugSummary()` gains `course` and `medium`.
- How to Play stays ocean-only in phase 8; record in COURSES.md that a medium will need its own move page.

### 4.7 Difficulty tests and conformance

- `race-bots.ts` takes a `CourseId` and derives its mean-time bar from `parTicks` (today's 75-105 s band expressed as a ratio of par). Runs are memoised per process: one run per (course, character, bot, seed, difficulty), so the conformance suite and the bars never race the same thing twice.
- Course conformance, for every registered course: parses with its legend; `validateLevel` returns nothing; all four racers finish within 1.6x `parTicks` on 5 seeds on Hard with no racer going more than 10 s without new best progress; theme and song ids resolve (engine half, over `THEMES` and the songs index).
- Medium conformance, for every registered medium: deterministic (same seed and inputs give identical state); caps speed; honours kick cooldown; every `MoveModifiers` field has a visible effect; makes progress in open space in each direction its own spec says it can; `steer` gets a rival through an overhang, a 1-tile gap, a vertical shaft with a lip, and a drop, without stalling. These geometries are small inline test levels.
- Listed courses run the full eight-character bars on all three difficulties as today; unlisted courses run conformance plus their own bars.

## 5. Quality guards for the ocean game (do these first)

The user's requirement is that the ocean game loses nothing. Capture before the scaffold, on main at the phase 7 merge:

1. Logic fingerprints: for every character on seeds 1, 7 and 42, on Hard, Normal and Easy, with the expert bot, the novice bot and the stuck-prone bot, hash the full event log plus every racer's body, status and stack every 60 ticks. Commit the hashes as `logic/fingerprint.test.ts` with a header saying it is deleted after phase 9 (it would block every later tuning change). Every lane's done-when includes it passing unchanged.
2. `arcade see` captures: title, How to Play page 1, select, a race at four fixed ticks (reef, current highway, jelly field, dark drop; pick ticks on seed 1 with `HARD_SAVE` + `TITLE_TO_RACE` + `TOP_ROUTE`), the Easy guide at the first pillar, and results, at desktop and `--mobile`. Store them under `.arcade/baseline-phase7/` (`.arcade/` is gitignored, so they stay local to the run's worktree) and compare side by side after each lane; any visible difference is a bug unless planned.
3. A test pinning the event-to-sfx table and Sunlit's race song id.
4. Difficulty numbers on seeds 1-200 per character per level, recorded in the lane report before and after; they must match exactly.
5. Existing scenarios, specs and smoke pass unmodified except where the flow change (course select, `createWorld` signature) forces an edit, and each such edit is listed in the lane report.

## 6. Plan

Use the deliver workflow (`ce:deliver`): convert this RFC into the plan file `plans/reef-rush.md` (add the phase 8 lane table and briefs under the existing Phase 8 heading, replacing its text with a pointer to this RFC), run `plan_graph.py validate`, have the plan critiqued against the code (devils-advocate), scaffold, then run lanes.

### Scaffold (inline, one commit, no behaviour change)

- Quality guards from section 5 (fingerprint test, baseline captures, sfx/song pin).
- `logic/courses/types.ts`, `logic/courses/index.ts`, `logic/courses/sunlit-shallows.ts` (level moved), `logic/media/types.ts` and `logic/media/index.ts` with a `swim` medium that delegates to today's functions, `engine/themes/types.ts`, `engine/themes/index.ts`, `defineTheme`, an `ocean` theme stub that delegates to today's art.
- `createWorld(course, ...)`, `World.course`, `World.medium`, `Racer.motion`, `Intent.kickHeld`, `RACER_SIZE`, `courseFromLevel` test helper; every caller updated mechanically.
- Save v6 with migration and fixtures, records API.
- Runtime course state, `?course=`, a `course` SceneKey stub, `debugSummary` course and medium.
- Tests prove nothing changed: fingerprints, the full suite and smoke pass.

### Lane 8/a, logic (L)

Owns `logic/media/`, `logic/swim/` (moved or re-exported), `logic/ai/`, `logic/race/flowfield.ts`, `logic/race/coral.ts`, `logic/world.ts`, `logic/modifiers.ts`, `logic/status.ts`, `logic/pickups/loose.ts`, `logic/powerups/` (only the direct-velocity and kick-reading rules), `logic/hazards/` (only kick-reading rules), `logic/abilities.ts` (Gil, Streak, Baron through medium rules), `logic/difficulty-level.ts` (catch-up composition, `wayOn` use), `logic/difficulty/`, `logic/courses/` tests, `logic/conformance/`, `COURSES.md` (new, in `games/reef-rush/`).

Builds: swim fully behind `Medium` per 4.2 (applyIntent, sampleEnvironment, buildNav, steer, enterCost, wayOn, validateLevel, effects, kickRules, motion); the generic/medium AI split with fixed rng draws; the progress stuck backstop; `pilotSkill`; course wiring through `createWorld` and race-bots (4.1, 4.7); memoised bot runs; both conformance suites with a test-only second course and a test-only toy medium (for example a "glide" medium with gravity) proving the suites catch a broken medium; catch-up composition with difficulty; `COURSES.md` with two step-by-step recipes: adding a course (files to add, registration lines, legend, parTicks, how to run its bars) and adding a medium (interface members, conformance, what generic rules read).

Done when: fingerprints unchanged; every existing test passes; conformance suites pass for Sunlit, the test course and the toy medium, and fail when the toy medium is broken on purpose; difficulty numbers unchanged on seeds 1-200; no generic file branches on a medium id (a test greps for `=== 'swim'` outside `logic/media/`); `pnpm arcade check reef-rush` at or under 30 s cold.

### Lane 8/b, engine (M)

Owns `engine/themes/`, `engine/art/` (moving ocean art behind the theme), `engine/view/level-view.ts`, `engine/view/backdrop.ts`, `engine/view/hazard-view.ts`, `engine/view/dark-view.ts` (tint from theme), `engine/fx/`, `engine/audio/adapter.ts`, `engine/scenes/` (course scene, title and results best per course), `engine/runtime.ts` (course state, song), `engine/debug.ts`, sprite contrast tests, scenarios and specs the flow change breaks (pick-character, dnf-results, title-best, results-after-finish, difficulty-setting, and any using `TITLE_TO_RACE`), `tests/course.spec.ts`, `UI.md`, `DESIGN.md`.

Builds: ocean theme behind `defineTheme` with self-registered textures (keys unchanged); fx particle physics from the theme; song from the course; course-select scene skipped while one course is listed, view-tested with three test courses at desktop and phone; per-course, per-level best on title and results; `?course=` spec using `GameDriver.open({ query })` (scenarios can't pass query).

Done when: captures identical to the baseline (side by side, reviewed); smoke passes; the course-select view test renders three courses readably at desktop and phone; `?course=sunlit-shallows` and an unknown id behave as specified; DESIGN.md and UI.md updated.

Lanes 8/a and 8/b run in parallel after the scaffold. Each gets a lane review (ce:code-reviewer for 8/a, game-reviewer for 8/b), fixes go back to the lane builder, then merge. Phase 8 ends with a phase-boundary review because phase 9 builds on these contracts.

## 7. Phase 9 (context; not part of this RFC's work)

The seams must make these possible, and the phase 8 reviewers should check them against it:

- 9/a Moonlit Kelp Forest (M), done only by following COURSES.md: the lane owns only `logic/courses/kelp-forest.ts` and its registration line, `engine/themes/kelp-forest.ts` with its art and song module and their registration lines, its difficulty test files, DESIGN.md and COURSES.md. check-lane enforces that, which is the proof. About 60 s for a good swimmer, night palette, kelp canopy, longer dark stretches, full eight-character bars on all levels (a course `catchUp` if geometry can't get there; profiles never change).
- 9/b flight medium and rival piloting (L): the flight medium as the spike settled it (hold to thrust, kick as an upward-biased boost, gravity about 40), `steer` with `pilotSkill`, each kick-reading rule and direct-velocity effect given a flight answer, abilities checked in flight, `wayOn` for the Easy guide, the unlisted `sky-test` course. The lane reports every file outside the new medium and course it touched, and why: that list measures how far a new medium is from a rewrite.
- 9/c sky theme (M): a finished pixel-art sky theme and song, and a smoke spec racing `?course=sky-test`.

Later phases (not planned): ground (respawn with a `racer.fell` event, jump-link nav, per-speed nav bands, ground item and ability re-spec; the ground spike is the reference) and space (zero gravity, inertia, gravity wells).

## 8. Risks and how they are handled

- Swim refactor drifts behaviour: fingerprints across three difficulties and three bots catch it on every lane.
- AI rng draw order changes when `steer` moves: `AiDraws` makes the per-tick draws generic and fixed; fingerprints catch any drift.
- Check time grows past 30 s with conformance and memoisation: memoise first; if a listed course still pushes it over, the full 30-seed bars move to a `difficulty` Vitest project run by the deliver gate and CI, with a 5-seed sanity version in check. Decide that with the user, not inside a lane.
- Engine captures drift when art moves behind the theme: keep texture keys identical; compare baseline captures after every lane.
- Easy guide and assist break when `fields.steer` moves: they go through `medium.wayOn`; 7/e's stuck-prone bot numbers must be unchanged.
- Scenario flow changes (course select) break many scenarios: the course scene is skipped while one course is listed, so play flow is unchanged in phase 8; only view tests see it.

## 9. Open questions for the user

None block phase 8. Two will come up in phase 9: whether course select shows locked or unlocked courses, and whether How to Play gets a page per medium or a page per course. Ask then.

## 10. Repo rules that apply throughout

- `pnpm arcade check reef-rush` after every change, `pnpm arcade smoke reef-rush` before handing work back, `pnpm arcade see` to look at what changed. Watch every new test fail once.
- Logic is deterministic and engine-free: no `Math.random`, `Date`, or `Math.sin/cos/hypot/exp/pow/atan2`; use `createRng` and `logic/num.ts`.
- Storage only through `@arcade/save`, input only through `@arcade/input` actions, boot only through `@arcade/shell`.
- Save shape changes bump `SAVE_VERSION`, add a migration, and commit the old version's fixture.
- Nothing under `packages/` in this work.
- Every game is original.
- Commit on the lane branch; merge to main only after the user approves. Push only when asked.
