# Courses and media

How to add a course (a new level with its own look and song) and how to add a medium (a new movement style: swim today, flight next). Both plug into registries; no generic race code changes. Paths below are under `games/reef-rush/src/`.

A **course** is data: a level, the medium it races in, a theme and song id, a par time and optional tuning. A **medium** is code: physics, environment, navigation, rival steering and a few rules the generic systems read. A **theme** is engine art for a course. Logic never imports the engine; the engine maps a course's theme and song ids to art and music.

## Add a course

### Files

| File | What goes in it |
| --- | --- |
| `logic/courses/<course-id>.ts` | The course: one exported `Course` constant, data only. Copy `sunlit-shallows.ts` for the shape. |
| `logic/courses/index.ts` | Registration: import the constant and add it to `COURSES`, whose order is the menu order. `LISTED_COURSES` (course select) is derived from `COURSES` by each course's `listed` flag, so there is no second list to keep in step. This is the only file allowed to import a course file; `logic/architecture.test.ts` fails otherwise. |
| `logic/courses/types.ts` | Add the id to `ShippedCourseId`, and the theme or song id to `ThemeId` / `SongId` if they are new. |
| `engine/themes/<theme-id>.ts` | Only for a new look: the theme, built with `defineTheme`, with its art kept beside it. Register it in `THEMES` in `engine/themes/index.ts`. `engine/themes/ocean.ts` is the example. |
| `engine/audio/songs/<song-id>.ts` | Only for a new song: register it in `songs` in `engine/audio/songs/index.ts`. |
| `logic/difficulty/<course-id>-*.test.ts` | The course's difficulty bars (see below). |
| `DESIGN.md`, this file | The course's section in DESIGN.md; anything this recipe got wrong. |

That list is the whole change. A course lane (phase 9/a, Moonlit Kelp Forest) owns exactly: `logic/courses/<course-id>.ts`, its lines in `logic/courses/index.ts` and `logic/courses/types.ts`, `engine/themes/<theme-id>.ts` and its art, its line in `engine/themes/index.ts`, `engine/audio/songs/<song-id>.ts` and its line in `engine/audio/songs/index.ts`, its `logic/difficulty/<course-id>-*.test.ts` files, `DESIGN.md` and `COURSES.md`. If a course needs anything else changed, that is a missing seam: report it rather than editing generic code.

### The course constant

```ts
export const KELP_FOREST: Course = {
  id: 'kelp-forest',          // saves, ?course= and the registry key; never change it once shipped
  name: 'Moonlit Kelp Forest', // course select and results
  level: LEVEL,               // a LevelDef: ascii, optional dark zones, optional legend
  medium: 'swim',             // a key of MEDIA
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

The medium checks the level too: `createWorld` throws `LevelError` (with row and column) for anything `medium.validateLevel` reports, such as a start that can't reach the finish in swim without breaking coral.

### parTicks

`parTicks` is a good racer's finish on Hard: the expert bot's mean finish over seeds 1-200 and all eight characters. The difficulty bars and course conformance judge race length against it, so measure it rather than guess. Sunlit's 5144 came from that run.

Measure with a throwaway test file (don't commit it), with `parTicks` set to a rough guess first:

```ts
// src/logic/difficulty/measure-par.test.ts
import { it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { CHARACTER_IDS } from '../types.ts';
import { race } from './race-bots.ts';

it('measures par', () => {
  const times = CHARACTER_IDS.flatMap((character) =>
    Array.from({ length: 200 }, (_, i) => race(BOT_PROFILES.expert, character, i + 1, 'hard', 'kelp-forest').finish.player),
  ).filter((t) => t !== null);
  console.log('par', Math.round(times.reduce((a, b) => a + b, 0) / times.length), 'from', times.length, 'finishes');
}, 3_600_000);
```

Run it with `pnpm --filter game-reef-rush exec vitest run --project difficulty src/logic/difficulty/measure-par.test.ts` (1600 races take several minutes) and write the number into the course with a comment saying where it came from.

### Difficulty bars

Every helper in `logic/difficulty/` takes a course id as its last argument and defaults to Sunlit: `race(bot, character, seed, difficulty, courseId)`, `describeDifficulty(character, courseId)`, `describeNovice(character, courseId)`, `describeNormal(character, courseId)`, `scriptedRace(character, seed, difficulty, courseId)`. Race runs are memoised inside one test file, so bars in the same file never race the same thing twice. (`kidRace` in `kid-bot.ts` races Sunlit only for now.)

A listed course runs the same bars Sunlit does, one file per character so Vitest runs them in parallel, directly in `logic/difficulty/` (the `difficulty` Vitest project takes only files there):

```ts
// logic/difficulty/kelp-forest-rudy.test.ts
import { describeDifficulty } from './race-bots.ts';
describeDifficulty('rudy', 'kelp-forest');
```

plus `kelp-forest-rudy-novice.test.ts` (`describeNovice`), the Normal files (`describeNormal`) and Easy files modelled on `easy-level.test.ts` and `easy-toddler.test.ts` with the course id passed to `race` and `scriptedRace`. The bars themselves (win counts, balance band, the par band for mean finish) don't change per course, and character profiles never change for a course.

If the geometry can't reach a bar, tune the level first. If it still can't, the course may override the rivals' catch-up for one difficulty level: `catchUp: { hard: { max: 1.3 } }` is merged field by field onto that level's bounds in `DIFFICULTY` (`rivalCatchUpFor` in `logic/difficulty-level.ts`); levels the course doesn't name keep the table's bounds exactly.

Run the bars with `pnpm --filter game-reef-rush test:difficulty`. `pnpm arcade check reef-rush` runs the `unit` project only and must stay under 30 s cold, so never put whole-race bars outside `logic/difficulty/`'s top level.

### Conformance

`logic/conformance/course.test.ts` runs over every course in `COURSES` with no edit: the level parses (legend glyphs read as their base cells), the medium's `validateLevel` finds nothing, and four racers (the expert bot as the player) finish within 1.6x `parTicks` on seeds 1-5 on Hard with none going 600 ticks of free swimming (stuns and traps restart the count) without new best progress. The engine's half (in `engine/themes/`) checks that every course's theme and song id resolve and that its theme has a tile for every legend art key.

```
pnpm --filter game-reef-rush exec vitest run --project unit src/logic/conformance
```

### Done

`pnpm arcade check reef-rush`, `pnpm --filter game-reef-rush test:difficulty` and `pnpm arcade smoke reef-rush` pass, and you've looked at the course in its theme (`pnpm arcade dev reef-rush`, then `/games/reef-rush/?course=<course-id>`, or a scenario that passes `?course=` as a launch parameter and `arcade see --scenario`). The course select scene appears only while more than one course is listed.

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

Moving a body through the tiles and separating racers is generic (`logic/race/collide.ts`), so a medium only sets velocity.

Outside the folder, the code needs two lines: the medium in `MEDIA` (`logic/media/index.ts`) and its id in `ShippedMediumId` (`logic/courses/types.ts`). `logic/media/types.ts` doesn't change. Then add a course that races in it (an unlisted test course is enough to start), and a How to Play move page: `engine/view/how-to-play/<medium-id>-page.ts` with its entry in `MOVE_PAGES` (`engine/view/how-to-play/index.ts`). `MOVE_PAGES` is keyed by `ShippedMediumId`, so a shipped medium without a page fails to compile; `move-page.ts` is swim's.

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
| `tuning` | `base` modifiers, `force`, `drag`, `maxSpeed`, `kick`, and medium-only numbers in `extra`. `effectiveTuning(world)` (in `logic/media/index.ts`) merges `course.tuning` over it once per course, `extra` key by key; `applyIntent` and `modifiersFor` both read that result, so every override applies. | Today's swim constants; `extra` holds `sink`, `currentForce`, `kelpDragMul`. |
| `createMotion(body)` | Per-racer movement state the medium owns (`Racer.motion`), a `RacerMotion` with the medium's `kind`. | `{ kind: 'swim' }` |
| `createPilot()` | Per-rival AI state for the medium's `steer`, a `PilotMemory` with the medium's `kind`. | Wobble, speed-based stuck count, recovery, aim and replan timer. |
| `sampleEnvironment(world, racer)` | What the surroundings do to this racer this tick. Takes the racer because a held power-up can change what its holder feels. | The current under the racer (including a Riptide's lane) and whether it's in kelp. |
| `applyIntent(racer, intent, env, tuning, mods, events, dt)` | Velocity, facing and kick cooldown for one tick, reading every number from `tuning` (the effective tuning above), never from module constants. Every `MoveModifiers` field must have a visible effect. | Thrust toward the stick, drag, idle sink, current push, kelp drag, kick with cooldown, speed cap. |
| `buildNav(level, broken)` | Navigation over the level with broken coral gone; rebuilt when coral breaks. | Flow fields toward the finish: steer, smash, ram. |
| `steer(world, racer, mods, draws, forceRecover)` | A rival's stick, kick, held kick, aim and whether it is recovering. Uses the four `AiDraws` the generic AI draws every tick; `forceRecover` comes from the generic progress backstop (`PROGRESS_BACKSTOP_TICKS`, 600 racing ticks without new best progress, rivals only; it resets while stunned or trapped and holds while Undertow pulls). | Aim along the steer field with wobble and avoidance, kick when aligned, recover from speed-based stalls. |
| `enterCost(cell, isBroken, move)` | Cost of entering a cell, for flow-field media. | Today's steer costs (kelp and currents against you cost more). |
| `aimFrom(world, body, lookaheadTiles)` | Unit aim toward the finish along the medium's way; zero at the finish. | Reads the steer field. |
| `nextTile(world, tile)` | Offset of the neighbour nearer the finish, or null. Draws the Easy guide's arrow. | Downhill step on the steer field. |
| `distanceAt(world, tile)` | Distance to the finish from a tile; Infinity when unreachable. | Steer field value. |
| `validateLevel(level, nav)` | Located problems that make the level unraceable in this medium; empty when fine. `createWorld` throws one `LevelError` listing them all, located at the first. | A start that can't reach the finish without breaking coral. |
| `coralAhead(world, tile, steps)` | Whether unbroken coral lies within `steps` tiles along the medium's way from `tile`; the Puffer item choice asks it. Return false in a medium without breakable coral. | Walks the smash field. |
| `racerCollision` | `'solid'` racers bump each other; `'ghost'` pass through. | `'solid'` |
| `effects` | Data the generic push rules read (below). | `dashAxes: 'both'`, bubbles and loose power-ups float up. |
| `kickRules` | How generic counters read a kick (below). | Every counter on; Gil's spring kick applies when kicking upward. |

### Generic rules that read the medium

- `effects.dashAxes`: Jet Fin dashes, knockback from hits and the Mimic decoy hold velocity on both axes, or only horizontally when gravity should keep the vertical.
- `effects.trappedDrift`: a racer trapped in a bubble drifts at this vertical speed (px/s, negative is up).
- `effects.looseDrift`: a dropped, loose power-up drifts at this vertical speed.
- `kickRules.dodgesSquid`: a kick just before contact makes a Homing Squid miss.
- `kickRules.shakesLatch`: kicks while latched take ticks off the latch.
- `kickRules.countersUndertow`: a kick against an Undertow cuts its pull that tick.
- `kickRules.springKick(aim)`: whether Gil's spring kick applies to a kick along `aim`.

The progress for placing (`World.progress`) is generic and the same in every medium; only navigation is the medium's.

### Conformance

`logic/conformance/medium.test.ts` runs over every entry in `MEDIA` plus a test-only glide medium with its own navigation and pilot (`conformance/glide.ts`, `glide-data.ts`, `glide-nav.ts`, `glide-pilot.ts`; a working example of a second medium): deterministic for the same seed and inputs, caps speed, honours kick cooldown, every `MoveModifiers` field changes motion, progress in open space in each direction the medium says it can move, and a rival gets through an overhang, a 1-tile gap, a shaft with a lip and a drop without stalling. Then race a course in the medium through course conformance and its own difficulty bars.

```
pnpm --filter game-reef-rush exec vitest run --project unit src/logic/conformance
```
