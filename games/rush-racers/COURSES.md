# Adding to Rush Racers

Recipes for the changes that recur: a course (a level with its own look and song), a medium (a movement style), a world (a medium with its own cast, names, art, theme, song and courses), and the smaller pieces: an item, an enemy, a set piece, a capture stage and a net message. The shipped worlds, media and courses are the table in `DESIGN.md` "Worlds and courses"; where every folder lives is `MAP.md`. Each piece plugs into a registry, so no generic race code changes. Paths below are under `games/rush-racers/src/` unless they start with `games/`, `scenarios/` or `tests/`.

A **course** is data: a level, the world it races in (which names its medium), a theme and song id, a par time and optional tuning. A **medium** is code: physics, environment, navigation, rival steering and a few rules the generic systems read. A **world** is the medium plus everything a player reads or sees per world: the cast's names and art, and the names and art of the shared items, pickups, enemies and hazards. A **theme** is engine art for a course. Logic never imports the engine; the engine maps a course's theme and song ids to art and music.

## Add a course

### Files

| File | What goes in it |
| --- | --- |
| `logic/courses/<course-id>.ts` | The course: one exported `Course` constant, data only. Copy `sunlit-shallows.ts` for the shape. |
| `logic/courses/index.ts` | Registration: import the constant and add it to `COURSES`, whose order is the menu order. `LISTED_COURSES` (course select) is derived from `COURSES` by each course's `listed` flag, so there is no second list to keep in step. This is the only file allowed to import a course file; `logic/architecture.test.ts` fails otherwise. |
| `logic/courses/types.ts` | Add the id to `ShippedCourseId`, and the theme or song id to `ThemeId` / `SongId` if they are new. |
| `engine/themes/<theme-id>.ts`, `engine/themes/<theme-id>/` | Only for a look no theme has yet: the theme's data in `<theme-id>.ts`, built with `defineTheme` from its `keys.ts` and `palettes.ts` and importing no sprite, and its `art.ts`, whose `registerArt(scene)` draws the sheets in `sprites/` and registers the loops. Register the data in `THEMES` and the art in `THEME_ART` (`<theme-id>: () => import('./<theme-id>/art.ts')`), both in `engine/themes/index.ts`; `engine/worlds/load.ts` imports it when a screen first draws the theme, so it is a chunk of its own. `engine/themes/ocean.ts` and `engine/themes/ocean/art.ts` are the example. |
| `engine/audio/songs/<song-id>.ts` | Only for a song not yet shipped: register it in `songs` in `engine/audio/songs/index.ts`. |
| `logic/balance/<course-id>-*.test.ts` | The course's difficulty bars (see below). |
| `DESIGN.md`, this file | The course's row and one-line description in DESIGN.md "Worlds and courses"; anything this recipe got wrong. |

That list is the whole change, so a course lane owns exactly: `logic/courses/<course-id>.ts`, its lines in `logic/courses/index.ts` and `logic/courses/types.ts`, `engine/themes/<theme-id>.ts` and `engine/themes/<theme-id>/` (keys, palettes, sprites, `art.ts`), its entries in `THEMES` and `THEME_ART` in `engine/themes/index.ts`, `engine/audio/songs/<song-id>.ts` and its line in `engine/audio/songs/index.ts`, its `logic/balance/<course-id>-*.test.ts` files, `DESIGN.md` and `COURSES.md`. The course in the example below, Moonlit Kelp Forest, is not a shipped course. If a course needs anything else changed, that is a missing seam: report it rather than editing generic code.

### The course constant

```ts
export const KELP_FOREST: Course = {
  id: 'kelp-forest',          // saves, ?course= and the registry key; never change it once shipped
  name: 'Moonlit Kelp Forest', // course select and results
  level: LEVEL,               // a LevelDef: ascii, optional dark zones, legend and surface
  world: 'reef',              // a key of WORLDS; the world names the medium
  theme: 'kelp-forest',       // a key of THEMES
  song: 'kelp',               // a key of songs
  listed: true,               // false: only ?course= and tests reach it; it never gets a best
  parTicks: 3600,             // measured, see below
  // tuning: { drag: 1.1 },   // optional overrides of the medium's numbers (MediumTuning)
  // catchUp: { hard: { max: 1.3 } }, // optional, per difficulty level, see below
};
```

Ids are plain strings in saves, so adding or removing a course never needs a save migration. A save keeps bests per course id; an unlisted course is never written to `lastCourse` and never gets a best.

### The level

The format is documented at the top of `logic/level/parse.ts`: one character per tile, every row the same width, starts `1`-`4`, a column of `F` for the finish, `o` pearls, `?` clams, `*` urchins, `j` jellies, and `dark` as inclusive column ranges.

Cell names are materials but mean behaviours the medium interprets: `#` rock is solid, `C` coral is solid until broken, `~` kelp slows, `> < ^ v` currents push, `.` is open. For a look the base glyphs don't have, add a **legend**: each extra character behaves as one base cell and names an art key the theme draws it with.

```ts
legend: {
  w: { cell: 'rock', art: 'wreck-hull' },
  s: { cell: 'kelp', art: 'sand-bar' },
},
```

`parseLevel` rejects a legend glyph that reuses a built-in character, maps to a cell that doesn't exist, is longer than one character, or is whitespace (rows are trimmed, so it could vanish). `Level.glyphs` keeps the glyph at every tile, so the theme can tell a wreck from plain rock. The theme must have a tile in `terrain.glyphTiles` for every art key the legend names: `assertCourseAssets` (`engine/themes/course-assets.ts`) throws, naming the course, glyph and art key, for one it lacks, so `engine/themes/course-assets.test.ts` fails for a shipped course and boot fails for the course a session starts on.

A swim course can open stretches of the sea to the sky with a **surface**: `surface: [{ from, to, row }]` turns every open (`.`) tile above `row` in columns `from..to` into the `air` cell (`level/surface.ts`). Racers breach into it and arc back under gravity (swim's `airGravity`, `airDrag`, `airSteer`); enemies and starts may not sit in it, and pickups placed there float in the air. `parseLevel` throws `LevelError` for a range that runs backwards, leaves the map, or puts `row` outside 1..height-1. The theme draws air with `terrain.tiles.air` and the waterline with `terrain.surface`. Run rejects a surface in `validateLevel` (on foot every open tile is already air), so it is a swim feature only.

### Set pieces

Three course features any medium can carry (Cloudreach's courses use all three; DESIGN.md "Sky set pieces" says how they play):

- `B` is a bounce cloud: solid like rock, and it springs a body coming down onto it back up. Only a medium whose `effects.bounceSpeed` is set allows one; `createWorld` throws `LevelError` at the cell otherwise.
- `@` is a boost ring (`Level.rings`), an open tile like a pearl's. Lay ring lines across the way, not up a climb, since a ring's boost doesn't help a climb. A flight rival heads for a ring only when it is 1-8 columns ahead (`RING_LOOK_TILES`), on its way with at most 1 tile of detour (`RING_DETOUR_TILES`), reachable at no more than 0.8 rows up or 2 rows down per column crossed, and in clear sight, and then only if it passes a skill roll against its wobble (`media/flight/ring-line.ts`).
- `lightning: [{ cols: [from, to], periodTicks, offsetTicks }]` in the `LevelDef` is a storm zone over those columns (`level/lightning-zones.ts`). `parseLevel` throws `LevelError` naming the zone for a range that runs backwards or leaves the map, two zones sharing a column, or a period shorter than the warning plus the strike (57 ticks). Offset neighbouring zones so they strike out of step.

Rivals (flight's pilot) take a bounce cloud only when it saves at least 0.1 s over flapping, so put one at the foot of a wall tall enough that bouncing wins, where the way arrives at floor level within about 2 columns of it.

A drift course can place **gravity wells**: `wells: [{ col, row, reach, pull, horizon? }]`, each centred on its tile, `reach` and `horizon` in tiles and `pull` in px/s² at the centre, fading to nothing at the reach (`level/wells.ts`). One without a `horizon` is a planet to swing round; one with it is a black hole that swallows a racer whose centre crosses the horizon. `parseLevel` throws `LevelError` for a centre off the map, a `reach` or `pull` that isn't positive, or a `horizon` that isn't positive and smaller than the reach. Put a planet's centre inside rock on the inside of a turn so its disc doesn't cover open tiles, and keep the main way clear of a hole's reach or price the lane through it: rivals fly a lane inside a reach when it is shorter by more than the nav surcharge.

The medium checks the level too: `createWorld` throws `LevelError` (with row and column) for anything `medium.validateLevel` reports, such as a start that can't reach the finish in swim without breaking coral.

### parTicks

`parTicks` is a good racer's finish on Hard: the expert bot's mean finish over seeds 1-200 and all eight characters. The difficulty bars and course conformance judge race length against it, so measure it rather than guess.

Measure it with the committed script, from the repo root, with `parTicks` set to a rough guess first:

```
node games/rush-racers/scripts/measure.ts par <course-id>            # 8 characters x 200 seeds on Hard, several minutes
node games/rush-racers/scripts/measure.ts par <course-id> --seeds 20  # a quick estimate while the level still moves
```

Write the number into the course with a comment saying where it came from, as each shipped course file does. Don't write a throwaway test file for this; the script is the harness.

### Difficulty bars

Every bar helper in `logic/balance/` takes a course id as its last argument and defaults to `DEFAULT_COURSE`: `describeDifficulty(character, courseId)` and `describeNovice(character, courseId)` (`hard-bars.ts`), `describeNormal(character, courseId)` (`normal-bars.ts`), `describeEasyLevel(courseId)` and `describeEasyToddler(courseId)` (`easy-bars.ts`), and under them `race(bot, character, seed, difficulty, courseId)` (`race-bots.ts`) and `scriptedRace(character, seed, difficulty, courseId)` (`scripted-race.ts`). Race runs are memoised inside one test file, so bars in the same file never race the same thing twice. `kidRace` (`kid-bot.ts`) races only the default course.

A listed course runs the same bars every listed course does, as one stub file per character and level so Vitest runs them in parallel, directly in `logic/balance/` (the `difficulty` Vitest project takes only files there):

```ts
// logic/balance/kelp-forest-rudy.test.ts
import { describeDifficulty } from './hard-bars.ts';

describeDifficulty('rudy', 'kelp-forest');
```

and likewise `kelp-forest-<character>-novice.test.ts` (`describeNovice`), `kelp-forest-<character>-normal.test.ts` (`describeNormal`), `kelp-forest-easy-level.test.ts` (`describeEasyLevel`) and `kelp-forest-easy-toddler.test.ts` (`describeEasyToddler`). `balance/sanity/files.test.ts` fails in the unit gate when any of these files is missing for a listed course. The bars themselves (win counts, balance band, the par band for mean finish) don't change per course, and character profiles never change for a course.

If the geometry can't reach a bar, tune the level first. If it still can't, the course may override the rivals' catch-up for one difficulty level: `catchUp: { hard: { max: 1.3 } }` is merged field by field onto that level's bounds in `DIFFICULTY` (`rivalCatchUpFor` in `logic/difficulty-level.ts`); levels the course doesn't name keep the table's bounds exactly.

Before running a bar, see its margin: `node games/rush-racers/scripts/measure.ts race <course-id> --bot <expert|noDash|novice|toddler> --difficulty <easy|normal|hard> [--char rudy,baron] [--seeds 30]` prints each character's places and mean finish against the par band, in about ten seconds per character at 30 seeds. To tune, edit the course or medium file and rerun it; sweep with more seeds rather than smaller knob steps, since a small change to a physics knob can swing results across the whole seed set. Run it on the stub level as soon as the course is listed, for the toddler on Easy and the expert on Hard, and plan the tuning as its own lane, since a first draft of a level usually misses most bars.

Run a course's bars file by file, `pnpm arcade test rush-racers src/logic/balance/<course-id>-rudy.test.ts`; `@bars` (every bar) belongs to the merge gate. `arcade check` runs only the `unit` project, which must not race whole races, so whole-race bars go only in `logic/balance/`'s top level (the `difficulty` project's glob in `games/rush-racers/vite.config.ts`).

### Conformance

`logic/conformance/course.test.ts` runs over every course in `COURSES` with no edit: the level parses (legend glyphs read as their base cells), the medium's `validateLevel` finds nothing, and four racers (the expert bot as the player) finish within 1.6x `parTicks` on seeds 1-5 on Hard with none going 600 ticks of free swimming (stuns and traps restart the count) without new best progress. The engine's half (in `engine/themes/`) checks that every course's theme and song id resolve and that its theme has a tile for every legend art key.

```
pnpm arcade test rush-racers @courses @behavior
```

`@courses` is course conformance, levels and the course registry; `@behavior` is the sfx pin, which must not change when a course is added.

### Done

The groups above and `pnpm arcade check rush-racers --skip-tests` pass, and you've looked at the course in its theme (`pnpm arcade dev rush-racers`, then `?course=<course-id>` on the game's page, or a scenario that passes `?course=` as a launch parameter and `arcade see --scenario`). The course select scene appears only while more than one course is listed. Whoever merges runs the full gate in AGENTS.md "Test scope", with the `@bars` group since balance files changed.

## Add a medium

A medium is an object implementing `Medium` in `logic/media/types.ts`. Generic code calls it through `mediumOf(world)` and never branches on its id (`logic/architecture.test.ts` fails on `=== 'swim'` outside `logic/media/`; `logic/media/boundary.test.ts` fails on a read of `world.nav` outside `logic/media/`, and on an import from a medium's folder, such as `logic/media/swim/`, by any file outside that folder other than the registry `logic/media/index.ts` and the conformance suite in `logic/conformance/`, which hosts the test-only glide medium).

### Files

Everything the medium knows lives in its own folder, `logic/media/<medium-id>/`. Swim's is the example:

| File | What it holds |
| --- | --- |
| `index.ts` | The medium object, assembling the members from the files beside it. |
| `data.ts` | The medium's data shapes and their accessors (below). |
| `physics.ts` | `applyIntent`: velocity, facing and kick cooldown from intent, environment and tuning. |
| `nav.ts`, `way.ts` | `buildNav`, `enterCost`, `validateLevel`; `aimFrom`, `nextTile`, `distanceAt`, `coralAhead`. |
| `pilot.ts` | `createPilot` and `steer`. |
| `tuning.ts` | `tuning`, `effects`, `kickRules`. |

Moving a body through the tiles (`logic/race/move.ts`) and separating racers (`logic/race/separate.ts`) is generic, so a medium only sets velocity.

Outside the folder, the code needs two lines: the medium in `MEDIA` (`logic/media/index.ts`) and its id in `ShippedMediumId` (`logic/courses/types.ts`). `logic/media/types.ts` doesn't change. Then add a course that races in it (an unlisted test course is enough to start), and How to Play pages: `engine/view/how-to-play/<medium-id>-page.ts` with its entry in `MEDIUM_PAGES` (`engine/view/how-to-play/index.ts`), plus crates, enemies and dodge (page 7) pages where the medium plays them differently (run's are `run-crates-page.ts`, `run-enemies-page.ts` and `run-shield-page.ts`, the last because a dash on foot dodges nothing). A medium's `kickRules` also drive the views: the DASH! hint for a squid and the latched DASH! prompt show only where `dodgesSquid` and `shakesLatch` say a dash helps. A medium How to Play has no pages for falls back to swim's with a warning. `MEDIUM_PAGES` is keyed by `ShippedMediumId`, so a shipped medium without a move page fails to compile; `move-page.ts` is swim's, `run-page.ts` run's. A medium is raced through a world, so it also needs a world (below), or a test world from `courseFromLevel(level, medium)` in `logic/test-world.ts` while it is being built.

### Data shapes and accessors

`MediumNav`, `MediumEnv`, `RacerMotion` and `PilotMemory` in `logic/media/types.ts` are opaque: each is only `{ readonly kind: string }`, and that is all generic code, `World` and `Racer` see. In `data.ts` the medium extends each one with its own `kind` and fields, for example:

```ts
export interface FlightNav extends MediumNav, GridSize {
  readonly kind: 'flight';
  distance: Float32Array;
}
```

and writes one accessor per shape it reads back, which checks `kind` and throws on another medium's data:

```ts
export function flightNav(nav: MediumNav): FlightNav {
  if (nav.kind !== 'flight') throw wrongKind('nav', nav.kind);
  return nav as FlightNav;
}
```

The medium's own code reads its data only through these (`swimNav(world.nav)`, `swimEnv(env)`, `swimPilot(racer.ai.pilot)`) and never casts its data anywhere else. Swim's are `SwimNav`, `SwimEnv`, `SwimPilot` and `SwimMotion`; glide's (`conformance/glide-data.ts`) share nothing with them.

### Every member

| Member | What it is | What swim does |
| --- | --- | --- |
| `id` | Registry key, the course's `medium`. | `'swim'` |
| `tuning` | `base` modifiers, `force`, `drag`, `maxSpeed`, `kick`, medium-only numbers in `extra`, and optional `byDifficulty` multipliers over `extra` per level (flight's lighter Easy gravity). `effectiveTuning(world)` (in `logic/media/index.ts`) merges `course.tuning` over it, `extra` key by key, then applies the level's multipliers, once per course and level; a multiplier naming an unknown extra throws. `applyIntent` and `modifiersFor` both read that result, so every override applies. | Swim's own constants; `extra` holds `sink`, `currentForce`, `kelpDragMul`. |
| `createMotion(body)` | Per-racer movement state the medium owns (`Racer.motion`), a `RacerMotion` with the medium's `kind`. | `{ kind: 'swim' }` |
| `createPilot()` | Per-rival AI state for the medium's `steer`, a `PilotMemory` with the medium's `kind`. | Wobble, speed-based stuck count, recovery, aim and replan timer. |
| `sampleEnvironment(world, racer)` | What the surroundings do to this racer this tick. Takes the racer because a held power-up can change what its holder feels. | The current under the racer (including a Riptide's lane) and whether it's in kelp. |
| `applyIntent(racer, intent, env, tuning, mods, events, dt)` | Velocity, facing and kick cooldown for one tick, reading every number from `tuning` (the effective tuning above), never from module constants. Every `MoveModifiers` field must have a visible effect. | Thrust toward the stick, drag, idle sink, current push, kelp drag, kick with cooldown, speed cap. |
| `buildNav(level, broken)` | Navigation over the level with broken coral gone; rebuilt when coral breaks. | Flow fields toward the finish: steer, smash, ram. |
| `steer(world, racer, mods, draws, forceRecover)` | A rival's stick, kick, held kick, aim and whether it is recovering. Uses the four `AiDraws` the generic AI draws every tick; `forceRecover` comes from the generic progress backstop (`PROGRESS_BACKSTOP_TICKS`, 600 racing ticks without new best progress, rivals only; it resets while stunned or trapped and holds while Undertow pulls). | Aim along the steer field with wobble and avoidance, kick when aligned, recover from speed-based stalls. |
| `enterCost(cell, isBroken, move, tile, level)` | Cost of entering a cell, for flow-field media; `tile` and `level` let a medium price by position (flight makes low sky over a gap dear). | Its steer costs (kelp and currents against you cost more). |
| `aimFrom(world, body, lookaheadTiles)` | Unit aim toward the finish along the medium's way; zero at the finish. | Reads the steer field. |
| `nextTile(world, tile)` | Offset of the neighbour nearer the finish, or null. Draws the Easy guide's arrow. | Downhill step on the steer field. |
| `distanceAt(world, tile)` | Distance to the finish from a tile; Infinity when unreachable. | Steer field value. |
| `validateLevel(level, nav)` | Located problems that make the level unraceable in this medium; empty when fine. `createWorld` throws one `LevelError` listing them all, located at the first. | A start that can't reach the finish without breaking coral. |
| `coralAhead(world, tile, steps)` | Whether unbroken coral lies within `steps` tiles along the medium's way from `tile`; the Puffer item choice asks it. Return false in a medium without breakable coral. | Walks the smash field. |
| `ramsCoral(racer)` | Whether the racer breaks every coral tile it enters this tick, asked after `applyIntent` and before the move. | False. Flight answers true in a dash's first `dashTicks`. |
| `afterMove(world, racer, contacts, events)` | Runs once per unfinished racer per tick right after the generic move, with what it ran into (`MoveContacts`: floor, ceiling and the tiles bumped, walls, and `lost`, the velocity each axis had when a tile stopped it, since `moveBody` has already zeroed the body's own; a medium whose racers bounce reads it, as drift's `bounce.ts` does). | Nothing. Run and flight set the last safe spot and falls here, through the shared fall, park and respawn timer in `logic/media/fall-out.ts`; drift bounces and runs its black holes here. |
| `racerCollision` | `'solid'` racers bump each other; `'ghost'` pass through; `'horizontal'` push apart along x only, so one can land through another. | `'solid'` (run: `'horizontal'`) |
| `effects` | Data the generic push rules read (below). | `dashAxes: 'both'`, bubbles and loose power-ups float up. |
| `kickRules` | How generic counters read a kick (below). | Every counter on; Gil's spring kick applies when kicking upward. |

### Generic rules that read the medium

- `effects.dashAxes`: Jet Fin dashes, knockback from hits and the Mimic decoy hold velocity on both axes, or only horizontally when gravity should keep the vertical.
- `effects.trappedDrift`: a racer trapped in a bubble drifts at this vertical speed (px/s, negative is up).
- `effects.looseDrift`: a dropped, loose power-up drifts at this vertical speed.
- `effects.stompBounce`: when set, a falling racer landing on an enemy stomps it (`enemy.bonked` with `how: 'stomp'`) and leaves at this upward speed; null keeps contact a hit or a dash bonk.
- `effects.solidClams`: shut clams are solid and open only from below (a head bump).
- `effects.pitBelow`: the bottom edge of the level is open, so a body can fall out; the medium decides what happens then (run respawns it in `afterMove`).
- `effects.allowsLedges`: the level may use `=` ledges; `createWorld` rejects one otherwise.
- `effects.assistAxes`: `'horizontal'` keeps the Easy steering assist off the vertical stick, where Up jumps or flaps.
- `effects.bounceSpeed`: the upward speed a bounce cloud gives a body landing on it; null rejects `B` in the level.

- `effects.gravityWells`: the level may have gravity wells (`LevelDef.wells`, parsed by `level/wells.ts`), and the medium says what they do to a racer (drift samples `pullAt` into its environment and swallows racers at a horizon in `afterMove`). `createWorld` throws a `LevelError` for a level with wells in a medium without the flag, and for any start whose centre is inside a black hole's reach.
- `kickRules.dodgesSquid`: a kick just before contact makes a Homing Squid miss.
- `kickRules.shakesLatch`: kicks while latched take ticks off the latch.
- `kickRules.countersUndertow`: a kick against an Undertow cuts its pull that tick.
- `kickRules.springKick(aim)`: whether Gil's spring kick applies to a kick along `aim`.

### Putting a racer out of play

A medium that can take a racer out (run and flight through a pit, drift into a black hole) uses the shared timer in `logic/media/fall-out.ts` from its `afterMove`. Its racer motion extends `ParkingMotion`, which keeps `parkedAt`, the spot an out racer waits on. `fallOut(racer, events, respawnTicks)` stops the racer, parks it, sets `status.fallen` and emits `racer.fell`; each later tick `waitOut(racer)` holds it parked at rest and counts `fallen` down (`tickStatuses` leaves that counter alone), returning true when the wait ends; then `respawnAt(racer, spot, invulnTicks, events)` puts it back on the spot the medium chose, at rest with no dash running, invulnerable, and emits `racer.respawned`. The medium keeps its own rule for which spots are safe (run's last safe ground, drift's last spot outside every hole's reach) and resets its own motion.

While `status.fallen > 0` the generic rules treat the racer as gone: its intent is cut to nothing (`controlledIntent`), it can't fire an item (`canFire`, which also covers the tick it falls, after its intent was read), it opens no clam and collects no pearl or loose item, a hit doesn't land on it (`applyHit`), a squid won't pick it, and it passes through other racers (`isDowned`). The views hide its item overlays and the latched DASH! prompt.

The progress for placing (`World.progress`) is generic and the same in every medium; only navigation is the medium's.

### Conformance

`logic/conformance/medium.test.ts` runs over every entry in `MEDIA` plus a test-only glide medium with its own navigation and pilot (`conformance/glide.ts`, `glide-data.ts`, `glide-nav.ts`, `glide-pilot.ts`; a working example of a second medium): deterministic for the same seed and inputs, caps speed, honours kick cooldown, every `MoveModifiers` field changes motion, progress in open space in each direction the medium says it can move, and a rival gets through an overhang, a 1-tile gap, a shaft with a lip and a drop without stalling. Then race a course in the medium through course conformance and its own difficulty bars.

```
pnpm arcade test rush-racers @media @seams @behavior
```

## Add a world

A world is a medium, a cast of eight on the shared character slots, the names and art of the shared items, pickups, enemies and hazards, a theme and song, and its courses. Build it in this order; each step leaves the game green. Step 1 is logic plus the medium's How to Play pages; step 2 is logic only; steps 3-5 are engine only; the listed course in step 6 is what puts it in front of players.

### 1. The medium, if the world moves differently

Follow "Add a medium" above: a folder `logic/media/<medium-id>/`, its entry in `MEDIA` and `ShippedMediumId`, and the medium's own How to Play pages (engine files in `engine/view/how-to-play/`). Start with a working baseline raced on test levels built with `courseFromLevel(level, medium)` (`logic/test-world.ts`), which races them in a registered test world for the medium, so no shipped world is needed yet. Once step 2 gives the medium a world, add an unlisted test course in it (Thornwood's `run-test`) and grow physics, falls and navigation behind the same `Medium` members: start from a simple way and pilot and replace them with a richer nav (run's jump-link nav: `links.ts`, `nav.ts`, `pilot.ts`) without the members changing. If a generic seam is missing, add it as a `MediumEffects` field or `Medium` member that every existing medium answers so as to keep its behaviour, and prove the shipped courses unchanged (`top-route.test.ts`, the sfx pin). Seams a medium may need: contacts from the move, ledges, open pits, `afterMove`, stomps, solid crates and sideways-only collision (run's); `ramsCoral`, `byDifficulty`, `assistAxes`, a positional `enterCost`, and the shared fall timer in `media/fall-out.ts` (flight's). Add the medium's cases to the conformance suite (`CASES_BY_MEDIUM` in `conformance/geometries.ts`, which `conformance/medium.test.ts` runs: the directions it can move in open space and the geometries that apply). A world that reuses a medium skips this step.

### 2. The logic world

| File | What goes in it |
| --- | --- |
| `logic/worlds/<world-id>.ts` | One exported `WorldDef`, data only: `id`, `name`, `medium` (a `ShippedMediumId`, so a misspelt or unshipped medium fails to compile; `logic/worlds/index.test.ts` also checks each resolves in `MEDIA`), `cast` (a name per `CharacterId`), and the world's names for `items`, `pickups`, `enemies` and `hazards`. Copy `thornwood.ts`. |
| `logic/worlds/index.ts` | Import it and add it to `WORLDS`; the only file that imports a world file. |
| `logic/worlds/types.ts` | Add the id to `ShippedWorldId`. `logic/architecture.test.ts` then fails any `=== '<world-id>'` or `case '<world-id>':` outside `logic/worlds/` and `engine/worlds/`, as it does for medium ids outside `logic/media/`: ask the world or its skin instead. |

Character ids are slots, not characters: the world's cast gives each slot a name, a look and the ability's wording, and keeps the slot's ability and rival profile. An ability that means nothing in the added medium gets a medium-neutral hook in `logic/abilities.ts` that the medium reads (Gil's slot jumps higher through `jumpMulFor`, which only run calls). Items, pickups and enemies keep their ids and balance.

### 3. The engine skin

Every view reads racer art, portraits, heads, ability wording, item icons and art, attack art, pickups, enemies, hazards and their glints, and item and enemy words through `skinFor(course)` (`engine/worlds/index.ts`), so a world adds files and changes no view.

| File | What goes in it |
| --- | --- |
| `engine/worlds/<world-id>/keys.ts` | Every texture and frame name the world draws, prefixed with the world id so no key collides with another world's. |
| `engine/worlds/<world-id>/cast.ts` | The `CastSkin` (racers, portraits, heads, ability name and blurb per slot): data only, no sprite imports. |
| `engine/worlds/<world-id>/objects.ts` | The `ObjectSkin` (item icons and art, attack art, pickups, enemies, hazards, glints with their own keys, and `text`: captions, `slowedBy`, the trapped word, the crates and pearls page headings): data only, no sprite imports. Hazard texture and loop keys live in `keys.ts`; a colour both the skin and the art read (a glint matching its hazard) lives in `palettes.ts`. |
| `engine/worlds/<world-id>/art.ts` | `registerArt(scene)`, which draws the cast, object and hazard sheets and registers the hazards' loops. It is the world's only file outside `sprites/` that imports from `sprites/`; `worlds/art-boundary.test.ts` fails otherwise. |
| `engine/worlds/<world-id>.ts` | The `WorldSkin`: wiring only. |
| `engine/worlds/index.ts` | Its entry in `SKINS`, keyed by `ShippedWorldId`, so a world without a skin fails to compile, and its entry in `WORLD_ART`, `<world-id>: () => import('./<world-id>/art.ts')`, which `worlds/load.ts` runs when a screen first needs the world, not at boot. |

`assertSkinAssets` (tests and boot) fails naming the world and key for a missing character, item, pickup, enemy or glint, and `assertSkinTextures` (run by `worlds/load.ts` as each world's art registers) for a texture or frame the skin names but never drew, hazards included, so a missing texture fails when that world first loads. Each racer's main colour must hold 3:1 against every theme's contrast bands (`art/sprites/sprites.test.ts`), and both hazard bodies against the bands of every listed course's theme (`view/hazard-view.test.ts`). Ship a placeholder skin first (Reef's art under the added world's words), so the medium can be raced before its art exists. Each world's owner label is one constant in its `keys.ts` (`CLOUDREACH_ART_OWNER = worldArtOwner('cloudreach')`), which its `art.ts` imports.

### 4. The theme

`engine/themes/<theme-id>.ts` built with `defineTheme` (data only), its keys, palettes and sprites under `engine/themes/<theme-id>/` with `art.ts` holding `registerArt`, its id in `ThemeId` and its entries in `THEMES` and `THEME_ART`, as in "Add a course". A medium may need tiles no other theme draws (the forest's branch tile for `=`, earth with a grass top only where it meets open space). Fix the palette first: the backdrop bands are `contrastBands`, and every racer of every world and all global art must keep 3:1 against them. That caps how bright a band can be: against the dimmest racer colours a band can reach only about 0.08 luminance, so a bright world takes its light from terrain rather than bands (Cloudreach's sun shafts and pale foreground clouds over a deep blue). A theme that shares Reef's backdrop pieces reads as Reef; give it its own haze, burst frames and terrain patterns. `forest.ts` is the land example, `sky.ts` the air one.

### 5. The song

`engine/audio/songs/<song-id>.ts` in the game's notation, its id in `SongId` and its entry in `songs`. Its own key, tempo and hook, not a reharmonised race theme. The sfx pin over Sunlit Shallows must not change.

### 6. The course

Follow "Add a course": `logic/courses/<course-id>.ts` with `world: '<world-id>'` and its theme and song, its id in `ShippedCourseId` and its entry in `COURSES`, par measured, and the difficulty bars. A course may be listed early, with a draft level, so course select, `tests/course.spec.ts` and smoke can be built in parallel with the level; it must pass the bars before release. Listing it shows it on course select (and turns course select on, if it is the second listed course: every hand-written menu walk then needs the course step, as `TITLE_TO_SELECT` in `scenarios/kit.ts` has). Every spec or scenario that asserts course select's rows or walks to a course by row index then needs the added row. Build the medium on the unlisted test course (`run-test`, `sky-test`) and the listed course once the nav and art are in.

### 7. Docs and checks

DESIGN.md gets the world's rows in "Worlds and courses" and its section (cast and names, how its medium plays, any set pieces); UI.md anything that reads differently; MAP.md a row for any folder added; this file anything the recipe got wrong.

Tests, as each world has them:

- Mechanics scenarios on the unlisted test course (on Hard, pinned through `HARD_SAVE`), so they don't move when the listed course is retuned: one per move and set piece (Cloudreach's `flight-*` scenarios). A debug stage such as `cannonball` starts one near the moment under test.
- The debug stages work on the test course too: `capture-stages.test.ts` stages `enemy-modes` on `sky-test`, whose floor has a bounce cloud in it.
- A How to Play scenario that pages through the world's pages on its listed course (`how-to-play-cloudreach`).
- `tests/course.spec.ts`: course select lists the course with its best, picking it shows the world's cast on select, the race runs in the medium, and it becomes the last course the title's best follows.
- `tests/smoke.spec.ts`: a race from the menus that runs 600 ticks on every browser project, and the touch Up button on the phone doing the medium's vertical move.

```
pnpm arcade test rush-racers @worlds @media @courses @seams @platform @behavior
```

## Add an item

Items are shared by every world; only names and art differ. Add the kind to `PowerUpKind` and `POWER_UP_KINDS` (`logic/types.ts`); most of what else needs an entry is a record keyed by the kind, so the type checker lists it.

| Where | What |
| --- | --- |
| `logic/powerups/charges.ts` | `CHARGES`: uses per pickup. |
| `logic/powerups/tuning.ts` | Its clam roll weights by place (`firstWeights`, `lastWeights`) and its numbers. |
| `logic/powerups/use.ts`, `logic/powerups/passives.ts` | What firing it does, and its passive while selected. An effect that lasts gets a module of its own beside them (`undertow.ts`, `decoys.ts`, `riptides.ts`) and a call in `logic/world.ts` at the point in the tick order its header gives. |
| `logic/ai/items.ts` | When a rival fires it. |
| `logic/worlds/<world-id>.ts` | Its name in each world (`items`). |
| `engine/worlds/<world-id>/keys.ts`, `sprites/items.ts`, `objects.ts` | Its icon and world art in each world, through the `ObjectSkin`. |
| `engine/view/powerup-view.ts` or `engine/view/attack-view.ts` | How it looks on a racer or in the water. |
| `engine/audio/attack-sfx.ts`, `engine/audio/sfx.ts` | Its sounds. |
| `engine/capture-stages.ts` | A stage that holds it (`STAGED_ITEMS`), so its view can be reviewed. |
| `DESIGN.md` "Power-ups" | Its row. |

Adding a kind changes every clam roll, so the top-route hash pin (`top-route.test.ts`) and smoke's hash change, and `TOP_ROUTE` may need re-recording (its comment in `scenarios/kit.ts` says what it depends on). `rival-items.test.ts` (in `@bars`) checks every kind gets fired. Any state the item adds to `World` is hashed automatically (`logic/hash.ts`); keep it plain data, since `hashWorld` throws on a value it has no rule for.

```
pnpm arcade test rush-racers @worlds @behavior src/logic/powerups src/logic/ai src/engine/capture-stages.test.ts
```

## Add an enemy

Add the kind to `EnemyKind` and `ENEMY_KINDS` (`logic/types.ts`); the type checker then asks for its entries in the records keyed by kind.

| Where | What |
| --- | --- |
| `logic/hazards/enemies/<kind>.ts` | Its step function, modes and any placement check (a crab needs a floor), with numbers in `enemies/tuning.ts`. |
| `logic/hazards/enemies/index.ts` | Its start in `START` and its dispatch in `stepEnemies`. |
| `logic/hazards/enemies/contact.ts` | Its size and pearls in `KIND`; bonks and hits go through the shared touch rule. |
| `logic/level/parse.ts`, `logic/world.ts` | Its level glyph, and the same glyph in `ENEMY_CHARS` for `toAscii`. |
| `logic/ai/avoid.ts` | How rivals keep clear of it or dash into it. |
| `logic/worlds/<world-id>.ts` | Its name in each world (`enemies`). |
| `engine/worlds/<world-id>/sprites/enemies.ts`, `keys.ts`, `objects.ts` | Its art, body texture and caption in each world. |
| `engine/view/enemy-look.ts` | How each of its modes looks. |
| `engine/audio/adapter.ts` | Its warning sound in `TELL_SFX`, or null. |

Test it in a `test-arena.ts` world (its own small level with the rivals sealed away), as the other kinds' tests in `logic/hazards/enemies/` do, and look at it with the `enemy-modes` stage, which lines up every kind in every mode.

```
pnpm arcade test rush-racers src/logic/hazards/enemies src/engine/view/enemy-look.test.ts src/engine/capture-stages.test.ts @worlds
```

## Add a set piece

A set piece is a course feature any medium could carry: bounce clouds, boost rings and lightning (DESIGN.md "Sky set pieces"), and gravity wells.

1. The level: a glyph in `logic/level/parse.ts`, or a `LevelDef` field parsed and checked in a file of its own in `logic/level/` (as `lightning-zones.ts` and `wells.ts` are), throwing `LevelError` with its position for a bad entry.
2. If only some media may carry it, a `MediumEffects` field every medium answers (as `bounceSpeed` and `gravityWells` are), and a `LevelError` from `createWorld` for a level that uses it in a medium without it.
3. The rule, in the logic folder it belongs to (`pickups/rings.ts`, `hazards/lightning.ts`, `race/bounce.ts`), called from `logic/world.ts` in tick order and emitting events declared in `logic/events.ts`. Rivals must know about it, in `logic/ai/` or the medium's pilot.
4. The view: `engine/view/set-pieces/<name>-view.ts`, created in `engine/scenes/race.ts`; its sound in `engine/audio/adapter.ts` and its effects in `engine/fx/event-effects.ts`.
5. A mechanics scenario on the medium's unlisted test course, and a line in DESIGN.md.

```
pnpm arcade test rush-racers src/logic/level src/engine/view/set-pieces @media @courses
```

## Add a capture stage

A capture stage (`?stage=<name>`, honoured with `?debug=1` or in test mode) writes plain world state before the race's first frame, so a view can be captured without waiting for a seed to produce the moment. All of it is `engine/capture-stages.ts`: add the name to `STAGES`, a `case` in `applyStage` (items go in `STAGED_ITEMS`), and a line in the header, which is the stage list DESIGN.md points to. A stage that needs something the course lacks (a dark zone, a black hole) throws naming it. Add a case to `capture-stages.test.ts` that stages it on a real course and asserts the world it set up, then look at it: `pnpm arcade see rush-racers --query scene=race --query stage=<name>`.

## Add a net message

Online races are lockstep: every page steps its own world from the same inputs, so nothing but those inputs and the host's start message may decide what a world does.

- Where things live: per-tick inputs and world hashes are binary, encoded in `net/codec.ts`; the game's JSON messages (`lobby`, `start`, `end`) are zod schemas in `net/messages.ts`; the room service relays them without reading their payload (`apps/api/src/protocol.ts` says what the room itself reads). `net/lobby.ts`, `net/race.ts` and `net/client.ts` handle them.
- A change to what a race simulates goes into the start message (`StartSchema`, which `net/race-world.ts` builds the world from) or into the input bits (`codec.ts`, which rejects reserved bit patterns). Anything else (pings, readiness, lobby picks) must not touch `World`. Validate every field in its schema so a bad message is dropped before it can reach `createWorld`.
- Versions: the game's messages carry no version number. `simulationBuildId` in `games/rush-racers/vite.config.ts` hashes every non-test file under `SIMULATION_FOLDERS` (`src/logic`, `packages/core/src` and all of `src/net`), and the room refuses a peer whose build id differs from the room's (GAME VERSIONS DIFFER), so a change to any of those files is safe across a deploy. A new net file is hashed without being listed; only a net file that doesn't affect what peers simulate or send may go in `NOT_SIMULATION`, with its reason. Bump `PROTOCOL_VERSION` (`apps/api/src/protocol.ts`) only when the room's own protocol changes, and deploy the API with it (`pnpm deploy:api`; AGENTS.md says when).
- Tests that pin it: `net/codec.test.ts` (every input round-trips), `net/messages.test.ts` (what each schema accepts and drops), `net/session.test.ts` and `net/client.test.ts` (peers on the in-memory room `net/transport/memory.ts`, which `transport/memory.test.ts` holds to `apps/api`'s Room), `logic/two-peers.test.ts` (two worlds stay equal, through a takeover), and in the browser `tests/online.spec.ts` and `tests/online-leave.spec.ts`.

```
pnpm arcade test rush-racers src/net src/logic/two-peers.test.ts
```

## A ninth character

Not supported. Eight is built into the select screen: its 4x2 grid fills the space between the back link and the touch zones (UI.md "Select"), so a ninth needs that screen redesigned first. A character also needs a name, look, art and ability wording in every world, a rival profile (`logic/characters.ts`), and three bar files per listed course (`balance/sanity/files.test.ts`).
