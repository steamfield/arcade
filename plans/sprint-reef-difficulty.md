# Plan: Reef Rush difficulty, surface and cave

Skill: sprint. Profile: sprint. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-23 (epoch 1795452220). Timebox: none. Landing branch: sprint/reef-difficulty (worktree `/Users/riley/Projects/games/.claude/worktrees/reef-difficulty`).
Gate: `pnpm arcade check reef-rush && pnpm --filter game-reef-rush test:difficulty && pnpm arcade smoke reef-rush`. Filtered tests: `pnpm arcade test reef-rush <paths or @groups> [-t name]`. Typecheck: `pnpm arcade check reef-rush --skip-tests`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --offline`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Sunlit Shallows gets harder and gains two set pieces. Sharks hunt harder on Normal and Hard, eels are more numerous, sit at chokepoints on the fast line and lunge out of step with each other, a new surface section lets racers breach out of the water to reach floating clams and pearl arcs, and the dark range becomes an underwater cave with an irregular hazard layout that can't be swum in a straight line.

In scope (user decisions, 2026-11-23):
- Surface section is a new section inserted between the jelly field and the urchin gauntlet (~80-100 columns). Race gets longer; par is re-measured.
- Getting out of the water is a momentum breach: no new button. Swim up fast and you leave the water; a dash upward launches you higher. In air, gravity arcs you back with light steering.
- Above the water: floating clams (normal roll table) and pearl arcs that trace a good jump. No air hazard.
- Cave layout is irregular and hand-placed (deterministic), not shuffled per seed.
- Shark: sees further (6 -> 8 tiles), wider patrol lane, rests less after a charge (40 -> 24 ticks), and steers toward its target mid-charge. Normal and Hard only; Easy keeps today's shark.
- A third shark on the course (in the surface section's underwater lane).
- Eels: from 3 to about 8, placed at chokepoints on the fast line, each lunging out of step (cycle offset per eel).
- Work lands on `sprint/reef-difficulty` in its own worktree. Other agents are landing `deliver/rush-racers` (renames the game folder, adds a run medium) and `deliver/reef-online`; whoever merges second resolves. Keep edits tight to reduce conflict surface.

Out of scope: air hazards (seabirds), per-seed random layouts, a jump button, new items, changes under `packages/`, rebalancing characters against each other.

Assumptions (defaulted; the user can override):
- Glyph-free surface: `LevelDef.surface: { from, to, row }[]` turns every water tile above `row` in columns `from..to` into a new `air` cell (objects placed there sit in air). Air is open, not solid.
- Air physics in swim: gravity 450 px/s², drag 0.4/s, steering at 15% of swim force, no idle sink, no currents/kelp, kicks don't fire in air (cooldown still counts down). A dash straight up from cruise (~180 px/s) clears about 2 tiles; plain swimming barely breaks the surface. Floating clams sit 2 tiles above the surface.
- Rivals don't plan through air: swim's `steerCost` prices air at 4, so they swim the surface lane unless a breach carries them.
- Loose power-ups, scattered pearls and bubble-trapped racers stop rising at the surface (never drift into air). Enemies never enter air (sharks treat it like rock).
- Shark knobs move into `DIFFICULTY[level].shark` (`SharkTuning`: sightTiles, patrolTiles, recoverTicks, chargeTurn). Easy keeps today's numbers with `chargeTurn: 0`. Normal and Hard share the aggressive set. Wind-up stays 0.5 s so the tell is unchanged.
- Eel offset: `createEnemies` starts each eel at `modeTicks = (home.x * 37 + home.y * 11) % EEL.cycleTicks`, mode derived from that, so no rng stream is touched.
- Cave art: legend glyphs for cave rock and stalactite/stalagmite tiles (behave as rock), a cave backdrop over the dark range, and a cave-mouth transition. The dark veil stays.
- Difficulty bars stay the gate. If the harder course drops a bar, tune rival numbers (catch-up, avoidance) before touching a bar; record any bar change and why in `hard-bars.ts`/`normal-bars.ts`.

Error model: as today. Bad course data throws `LevelError` with row and col from `parseLevel`: a surface range off the map or reversed, a surface row outside the map, an eel whose hole or lunge path isn't valid. Logic never throws for valid state.

## Contracts (scaffold commit)

    src/logic/types.ts             Cell gains 'air'; LevelDef.surface?: SurfaceDef[]; Level.surface: SurfaceDef[] (SurfaceDef = { from: number; to: number; row: number })
    src/logic/difficulty-level.ts  SharkTuning interface and DifficultyTuning.shark (values filled in lane 1a)
    src/engine/themes/ocean.ts     placeholder tile for 'air' so typecheck holds (lane 2b replaces it)

## Phases

### Phase 1: tougher sharks and eels (MVP)

Demo: `pnpm arcade see reef-rush --scenario enemy-bonk` and `pnpm arcade see reef-rush --input "_*180 right*900"` on Hard; logic tests in `src/logic/hazards/enemies`.
Test cases:
- Hard shark spots a racer 7.5 tiles ahead (Easy shark doesn't).
- Hard shark is back on patrol 24 ticks after a charge ends; Easy after 40.
- Hard shark charging at a racer that moves 1.5 tiles off the line still turns toward it (ends closer than a straight charge would); Easy shark charges straight.
- A racer that moves 4 tiles off the line escapes a Hard charge (no hit).
- Easy shark still never winds up on the player.
- Two eels at different homes start at different cycle offsets; an eel's offset is the same every race (no rng).
- An eel created mid-cycle is in the mode that offset implies (hidden, windup or lunge) and emits `enemy.telegraphed` when its windup starts.
- Course: Sunlit Shallows has at least 8 eels and 2 sharks after this phase, every eel valid (createEnemies doesn't throw).

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/hazards/enemies/, games/reef-rush/src/logic/difficulty-level.ts, games/reef-rush/src/logic/difficulty-level.test.ts | contracts | games/reef-rush/src/logic/hazards/enemies/shark.test.ts, games/reef-rush/src/logic/hazards/enemies/eel.test.ts | opus | pending | | enemy tests pass, typecheck and lint pass |

Inline (me, after lane a): eel placement on `sunlit-shallows.ts`, re-record TOP_ROUTE, top-route test.

#### Lane a brief

- Goal: sharks hunt harder on Normal and Hard; eels lunge out of step.
- Interface: `SharkTuning { sightTiles; patrolTiles; recoverTicks; chargeTurn }` on `DifficultyTuning.shark` in `difficulty-level.ts` (declared in the scaffold). `shark.ts` reads it through `tuningOf(world).shark` instead of `SHARK.sightTiles/patrolTiles/recoverTicks`. `SHARK` in `tuning.ts` keeps the shared numbers (hp, size, speeds, windup, charge ticks, stagger, pearls).
- Behavior: Easy `{ sightTiles: 6, patrolTiles: 3, recoverTicks: 40, chargeTurn: 0 }` (today). Normal and Hard `{ sightTiles: 8, patrolTiles: 4, recoverTicks: 24, chargeTurn: 0.05 }`. During a charge with `chargeTurn > 0` and a target that hasn't finished and isn't downed or invulnerable, each tick: `dir = normalize(vel/|vel| + chargeTurn * unit(target - shark))`, `vel = dir * chargeSpeed`, facing follows `vel.x`. No trig (`num.ts` rules). A charge still ends on rock or after `chargeTicks`. Eels: `createEnemies` gives each eel a start offset `(home.x * 37 + home.y * 11) % EEL.cycleTicks` and sets its mode and `modeTicks` to where that offset falls in the hidden -> windup -> lunge cycle, then places it (`placeEel`), so a lunging eel starts out of its hole. Tests: add the phase test cases to `shark.test.ts` and `eel.test.ts` using `test-arena.ts`; existing tests that assume an eel starts hidden at tick 0 may be adjusted to their offset, and say which in the report. Watch each new test fail once before implementing.
- Decisions already made: Normal and Hard share values; wind-up unchanged; no rng.
- Out of scope: course edits, rival AI changes (`ai/avoid.ts` already reads `eelReachBox`), engine views, DESIGN.md (I update it).
- Done when: `pnpm arcade test reef-rush src/logic/hazards/enemies src/logic/difficulty-level.test.ts` passes and `pnpm arcade check reef-rush --skip-tests` passes.

### Phase 2: the surface

Demo: `pnpm arcade see reef-rush --scenario breach` (a dash up through the surface reaching a floating clam).
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/level/, games/reef-rush/src/logic/media/swim/, games/reef-rush/src/logic/pickups/, games/reef-rush/src/logic/hazards/enemies/shark.ts, games/reef-rush/src/logic/hazards/enemies/shark.test.ts, games/reef-rush/src/logic/status.ts, games/reef-rush/src/logic/surface.test.ts | contracts | | opus | pending | | surface logic tests pass |
| b | M | games/reef-rush/src/engine/themes/, games/reef-rush/src/engine/view/level-view.ts, games/reef-rush/src/engine/view/backdrop.ts, games/reef-rush/src/engine/fx/event-effects.ts | contracts | | opus | pending | | theme tests pass, see capture shows sky, waterline and cave |

(Briefs written when phase 1 lands.)

### Phase 3: course, cave layout and balance

Demo: `pnpm arcade see reef-rush --input ...` over the surface and cave; `pnpm --filter game-reef-rush test:difficulty`.
Depends on: phase 2

Inline: insert the surface section, reshape the cave with irregular urchins, eels and pillars, third shark, re-record TOP_ROUTE, re-measure par, run difficulty bars and tune, update DESIGN.md and scenarios.

## Log
