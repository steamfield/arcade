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

Scaffold: f27b733
Demo: `pnpm arcade see reef-rush --scenario enemy-bonk` and `pnpm arcade see reef-rush --input "_*180 right*900"` on Hard; logic tests in `src/logic/hazards/enemies`.
Test cases:
- Hard shark spots a racer 7.5 tiles ahead (Easy shark doesn't).
- Hard shark is back on patrol 24 ticks after a charge ends; Easy after 40.
- Hard shark charging at a racer that moves 1.5 tiles off the line still turns toward it (ends closer than a straight charge would); Easy shark charges straight.
- A racer that moves 4 tiles off the line escapes a Hard charge (no hit).
- Easy shark still never winds up on the player.
- Two eels at different homes start at different cycle offsets; an eel's offset is the same every race (no rng).
- An eel created mid-cycle is in the mode that offset implies (hidden, windup or lunge) and emits `enemy.telegraphed` when its windup starts.
- Normal's shark tuning equals Hard's; Easy's is today's numbers.
- A Hard shark patrols out to 4 tiles from home before turning; Easy turns at 3.
- Course: Sunlit Shallows has 10 eels and 2 sharks after this phase (3 sharks after phase 3), every eel valid (`createEnemies` doesn't throw via `eelOutward`).

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/hazards/enemies/, games/reef-rush/src/logic/difficulty-level.ts, games/reef-rush/src/logic/difficulty-level.test.ts | contracts | games/reef-rush/src/logic/hazards/enemies/shark.test.ts, games/reef-rush/src/logic/hazards/enemies/eel.test.ts | opus | running | sprint/reef-difficulty-1a | enemy tests pass, typecheck and lint pass |

Inline (me): seven new eels on `sunlit-shallows.ts` at (134,7), (205,7), (252,7), (290,16), (352,10), (360,6), (516,4); after lane a merges, re-record TOP_ROUTE so `top-route.test.ts` passes, and run the difficulty bars. A bar that drops in phase 1 is logged and fixed in phase 3's balance pass, not here, since phase 3 reshapes the course again.

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

Phase 2 scaffold (when phase 1 tags): `Environment.inAir: boolean` in types.ts (query.ts sets it false until lane a), GameEvents `{ type: 'racer.breached'; id: RacerId }` and `{ type: 'racer.splashed'; id: RacerId }` in events.ts, and a test level in `src/logic/surface.test.ts` scaffolded empty for lane a.

Test cases (lane a writes them in `src/logic/surface.test.ts` and `level/parse.test.ts`):
- `surface: [{ from: 2, to: 9, row: 3 }]` parses rows 0-2 water in cols 2-9 to 'air'; rock, and water outside the range, are unchanged; an object glyph (`?`, `o`) in that region sits on an air tile and is still recorded.
- A surface range reversed, off the map, or with `row` outside 1..height-1 throws `LevelError`; an enemy glyph on an air tile throws `LevelError` with its row and col.
- A racer holding up at cruise reaches the surface and pops out less than 1 tile (top of its box never above row - 1), then falls back into the water.
- A racer that dashes straight up from 1 tile under the surface clears 2 tiles above the surface (overlaps a clam placed at row - 2) and opens it.
- In air: no idle sink, no current or kelp effect, a kick does not fire (no `racer.kicked`), the stick steers at a fraction of swim force, and gravity brings the racer back into the water.
- `racer.breached` fires once on the tick a racer's centre goes from water to air, `racer.splashed` once on re-entry.
- Swim's `steerCost` prices air at 4; a rival on a surface-lane level swims under the air rather than through it, and its field values in air are finite.
- A loose power-up rising toward the surface stops at it (never enters air); a bubble-trapped racer stops rising at the surface; scattered pearls never move into air.
- A shark never moves into air (its patrol or charge stops at the surface like rock).

#### Lane 2a brief

- Goal: the surface of the sea, in logic. Water above a surface row becomes air; racers breach out with momentum, arc under gravity and splash back in.
- Interface: `LevelDef.surface` / `Level.surface` (`SurfaceDef`), Cell `'air'`, `Environment.inAir`, events `racer.breached` / `racer.splashed` (all in the scaffold). `parseLevel` validates and applies surface ranges. `sampleEnvironment` (level/query.ts) sets `inAir`. Swim physics branches on `env.inAir`. `SwimMotion` gains `airborne: boolean` (media/swim/data.ts) so applyIntent can emit breach/splash on the change. New tuning in `SWIM_TUNING.extra`: `airGravity` (start 450 px/s²), `airDrag` (0.4), `airSteer` (0.15); adjust until the dash-up and cruise-pop test cases hold. `steerCost` gets `AIR_COST = 4`.
- Behavior: the test cases above. Kick cooldown keeps counting down in air. Speed cap still applies. Air never pushes or slows (no current, no kelp drag) and has no idle sink, only gravity.
- Decisions already made: momentum breach, no jump button; rivals don't plan through air; objects in air are normal pickups; enemies never enter air.
- Out of scope: course edits, engine art, sounds, rival pilot changes beyond what the cost gives, items behaving differently in air (Jet Fins, Cannonball, Riptide just do what they do).
- Done when: `pnpm arcade test reef-rush src/logic/surface.test.ts src/logic/level src/logic/media src/logic/pickups src/logic/hazards src/logic/conformance` passes and `pnpm arcade check reef-rush --skip-tests` passes. The sfx pin (`@behavior`) must not change (Sunlit has no air yet).

#### Lane 2b brief

- Goal: the ocean theme draws a sky over air, a moving waterline at the surface, splashes on breach and re-entry, and an underwater cave over dark ranges.
- Interface: `TerrainArt.tiles.air` (a sky tile, or sky drawn by the backdrop over air tiles; lane's choice, reported), a new optional `TerrainArt.surface: FlowingArt` drawn on every water tile whose tile above is air, `glyphTiles` entries `caveRock`, `stalactite` and `stalagmite` (each a rock-like tile in darker cave stone; stalactite hangs from above, stalagmite rises from below), and a new optional `BackdropSpec.cave: { texture: string }` drawn behind the terrain across every `level.dark` column range (dark rock wall with faint texture), in `themes/types.ts`, `themes/ocean.ts`, `themes/ocean/`, `view/level-view.ts`, `view/backdrop.ts`. Splashes: `fx/event-effects.ts` bursts droplets on `racer.breached` and `racer.splashed` from the theme's `splash` particle physics. Palette rules: at most 4 colours per frame, sky colours added to the theme's contrast bands only if racers stay 3:1 against them (`sprites.test.ts`, `ocean.test.ts`).
- Behavior: a level with a surface shows sky above the waterline in those columns and water below; a level without one looks exactly as today (Sunlit pixels unchanged until phase 3 adds a surface). The cave backdrop shows only in dark columns, under the dark veil.
- Out of scope: logic, course edits, audio, the dark veil itself.
- Done when: `pnpm arcade test reef-rush src/engine/themes src/engine/art src/engine/view src/engine/fx` passes, typecheck passes, and a `pnpm arcade see reef-rush --query course=<test course>` capture of a level with a surface and a dark range shows sky, waterline and cave wall (use a scratch unlisted course only if one already exists; otherwise review via `?stage=` frames on Sunlit for the cave and report the surface as unreviewed until phase 3).

### Phase 3: course, cave layout and balance

Demo: `pnpm arcade see reef-rush --input ...` over the surface and cave; `pnpm --filter game-reef-rush test:difficulty`.
Depends on: phase 2

Inline: insert the surface section, reshape the cave with irregular urchins, eels and pillars, third shark, re-record TOP_ROUTE, re-measure par, run difficulty bars and tune, update DESIGN.md and scenarios.

## Log

- Plan critique (sonnet): (1) shark count wording fixed: 2 now, 3 after phase 3. (2) Normal and patrol-lane test cases added to lane 1a by message. (3) Inline course and route work for phase 1 named above; bars may drop before phase 3, handled there. (4) Lane 1a told to export the eel start-state helper from eel.ts. (5) Phase 2 notes folded into its briefs: steerCost needs an air case, loose.ts, pearl-drift.ts and status.ts each drift on their own, hasClearSweep is shared with rivals so the shark's air block goes in shark.ts.
