# Plan: Reef Rush

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-22. Timebox: none. Landing branch: deliver/reef-rush.
Gate: `pnpm arcade check reef-rush && pnpm arcade smoke reef-rush` (about 8s). Filtered tests: `pnpm --filter game-reef-rush exec vitest run <path>`. Typecheck: `pnpm --filter game-reef-rush typecheck`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --offline`. Lane worktrees are created by the orchestrator (`git worktree add ../games-reef-rush-<lane> <lane branch>` from the landing tip) and lanes are dispatched without `isolation`, because agent-isolated worktrees are cut from main's HEAD and removed when an agent stops with no changes.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, todo: true
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Reef Rush is an original underwater racing platformer in 8-bit style: the player swims a reef course against three rival swimmers, grabbing power-ups that stack and combine, and tries to reach the finish gate first. It is the first real game in the arcade monorepo, so its layout, tests and engine patterns are the reference later games copy.

In scope:
- Free 8-direction swimming with momentum and water drag, a slow idle sink, and a kick (short burst, cooldown). Controls: move (arrows/WASD, d-pad), kick (Space/Z, touch A), burst (X/Shift, touch B).
- A race: 3-2-1 countdown, four racers, live placing, finish, results screen with time and placing, best time saved.
- Three rivals with distinct personalities that steer by a flow field toward the finish, kick, use power-ups and bump. Mild catch-up both ways so races stay close.
- Power-ups that stack: up to 3 held, all passive effects active at once, and the burst button fires every held power-up's burst together, so combinations emerge. Named combos for specific pairs. A hit knocks off the newest power-up (a Bubble Shield is always taken first) and the lost power-up floats loose for anyone to grab. A hit with an empty stack stuns.
- Ocean level features: rock, breakable coral, kelp (drag), currents (push), urchins and jellyfish (hazards), pearls (small boost), clams (power-up boxes), a dark trench (lit by Glow Lantern).
- Raised-bar 8-bit presentation: strict per-sprite palettes and a 320x180 integer-scaled canvas, but with multi-frame animation, parallax layers, light shafts and caustics, depth-graded palettes, a pixel font, particles and juice.
- Music is a first-class feature: original, hummable chiptune in the spirit of classic console and handheld themes (the user cited the Mario and Pokemon Game Boy themes as the bar for catchiness, not as material to copy). Four voices like the classic hardware (two pulse leads with duty-cycle changes, a triangle bass, noise drums), a race theme with intro, A and B sections and a seamless loop, a title theme, a results jingle for winning and one for losing, and a tempo lift for the final stretch of the course. The hook is a short motif (2 bars or less) stated, answered and varied, with the B section contrasting in register and rhythm. Plus SFX for every player-facing event.
- Settings persisted in the save: mute and reduced motion.

Out of scope: more than one level, multiple difficulty settings, online play, remappable keys (needs `packages/input` work), changes under `packages/` (the user chose to keep new infrastructure in the game and extract it when a second game needs it), Arcade/Matter physics.

Assumptions (defaults the user can override):
- Stacking model: stack of 3, hit pops newest (the user had no preference; this was the recommended option).
- Name and cast are original: the player is Pip, a small diver in a round brass helmet; rivals are Tess (sea turtle, steady and clean), Squib (squid, fast and erratic, item-happy) and Bo (hermit crab in a diving bell, slow to turn, heavy in bumps). No names, characters, art, music or level layouts from existing games.
- Power-ups (passive / burst): Jet Fins (+15% swim force, kick cooldown 36 to 22 ticks / Torpedo dash), Bubble Shield (absorbs the next hit / fires a trapping bubble forward), Puffer (stronger bumps / inflate for 60 ticks: big, breaks coral, hits rivals on contact, immune to urchins), Ink Sac (none / ink cloud behind you that slows other racers), Glow Lantern (pulls nearby pearls, lights the dark trench / flash that stuns nearby rivals and jellyfish). Named combos: Jet Fins + Puffer "Cannonball", Jet Fins + Ink Sac "Ink Trail", Bubble Shield + Glow Lantern "Seeker Bubble", Puffer + Ink Sac "Ink Bomb", Jet Fins + Glow Lantern "Comet". Burst has one shared cooldown of 150 ticks.
- Difficulty is measured, not eyeballed: on the final course an expert bot (rival AI steering with player physics, full kicks and items) wins at least 8 of 10 seeds while the lead rival finishes within 8 s of it, and a novice bot (no kicks, steering noise, no items) places 3rd or 4th in most seeds and finishes within 25 s of the winner. Rival tuning lives in `logic/ai/profiles.ts`. The difficulty test reports through assertion messages, never the console (`noConsole` covers tests under `src/`).
- Art is authored as palette-indexed text in TypeScript (one string row per pixel row) and turned into textures at boot. Audio is synthesized with WebAudio (square, triangle and noise voices); no audio files.
- The course is about 90 s for a good player. Phase 1 ships its first section; phase 5 completes it.
- Tile 16 px, canvas 320x180 (2x on a landscape phone, 6x at 1080p).

Error model:
- Level data errors (ragged rows, unknown characters, missing or duplicate start digits, no finish column, finish tiles in more than one column, dark zones outside the map or with from > to) throw `LevelError` from `parseLevel`, with `row` and `col` set where a position is meaningful (null for whole-level errors such as a missing start or no finish; ragged rows set only `row`). Levels are compiled-in constants, so a bad level fails unit tests and boot; the throw propagates out of `startPhaser` and the shell reports it as a game error.
- `createWorld` throws `LevelError` when a start tile cannot reach the finish without breaking coral.
- `stepWorld` never throws for reachable states. Physics clamps (speed caps, collision resolution) instead of asserting.
- Races always end: when the player finishes, or `DNF_GRACE_TICKS` (600) after the third rival finishes, or at `RACE_LIMIT_TICKS` (18000, 5 min). A player who has not finished gets `playerTicks: null`, is placed by progress after every finisher, the results screen shows "DNF", and no best time is written.
- Engine: loader, WebGL context and audio-node failures go to `ctx.reportError` (tests fail on them). Save failures emit `save.failed` with the reason and log a warning; the race continues and the results screen says the best time was not saved. An unreadable save shows the shell notice and is never overwritten (`@arcade/save` blocks the slot).
- Audio that cannot start yet (suspended context before a gesture) is not an error: nothing plays and no `audio.played` is emitted. `audio.played` is emitted once per SFX and once per song start or section change, never per note, so long holds can't overflow the 1000-event log.

Determinism rules (every lane follows these):
- Tick order in `stepWorld`: countdown; then intents for every racer are computed from the start-of-tick state in `RACER_IDS` order; then each racer's physics and tile movement in `RACER_IDS` order; then one pass of pairwise separation over pairs (i < j) in `RACER_IDS` order; then progress, finishes, places and race end. Phase 2+ systems slot in at named points in `world.ts`.
- Randomness: `world.rngs` holds one `Rng` per consumer, forked from the seed with fixed salts (`ai.tess`, `ai.squib`, `ai.bo`, `ai.bot`, later `pickups`, `hazards`). Adding a new consumer never changes an existing stream.
- Placing uses the progress field (uniform-cost geometric distance, coral passable), sampled at the body centre with sub-tile interpolation, so places don't flicker crossing kelp or currents. Ties break by `RACER_IDS` order. Same-tick finishes break by how far past the finish line the body centre is (further first), then `RACER_IDS` order.

## Contracts (scaffold commit)

Shared types live in `logic/types.ts`. Every new lane-owned module exists as a stub exporting its final signatures and throwing `new Error('not implemented')`. Integration files (`world.ts`, `modifiers.ts`, `types.ts`, `events.ts`, `save.ts`, `levels.ts`, `ai/profiles.ts`) are written for real in the scaffold, and the template's coin-game files are deleted.

Layout (all under `games/reef-rush/`):

    src/
      main.ts                       wires save store, input and shell boot; no logic
      logic/
        types.ts                    shared types and tuning constants other modules agree on; no functions
        events.ts                   GameEvent union: everything observable in a race
        save.ts                     save schema v2, migrations, NEW_GAME
        world.ts                    createWorld/stepWorld in the fixed tick order, summarize, toAscii; no rules of its own
        modifiers.ts                combines profile, catch-up and (phase 3) held power-ups into MoveModifiers
        level/parse.ts              LevelDef (ASCII + dark zones) into Level; throws LevelError
        level/query.ts              tile lookups on a Level: cellAt, isSolid, overlap and environment sampling
        level/levels.ts             the course data (OCEAN_LEVEL); data only
        swim/physics.ts             one racer's velocity from intent, environment and modifiers (force, drag, sink, kick, current, kelp)
        swim/collide.ts             moving a body through tiles, and separating overlapping racers
        race/flowfield.ts           progress, steer and smash fields over the tile grid; distance and steering lookups
        race/priority-queue.ts      min-heap keyed by distance, used by the flow-field Dijkstra
        race/standings.ts           countdown, progress, finishes, placing and the race result
        ai/rival.ts                 an AI racer's Intent each tick from the fields, its profile, memory and rng
        ai/profiles.ts              rival and bot profiles; data only
        powerups/   (phase 3)       stack rules, burst effects, combos
        pickups/    (phase 3)       clams, pearls, loose power-ups
        hazards/    (phase 3)       urchins, jellyfish, hits, stun and knockback
      engine/                       phase 1: the template engine adapted to the new world; phase 2 replaces it with:
        game.ts                     startPhaser and the GameHandle; wiring only
        runtime.ts                  Runtime: fixed-step ticking, scene switching, draining events to audio, persistence
        input.ts                    action map and touch layout
        scenes/boot.ts, title.ts, race.ts, results.ts
        view/level-view.ts, racer-view.ts, hud.ts, camera.ts, backdrop.ts
        art/keys.ts                 every texture, frame and animation key as typed consts
        art/index.ts                buildTextures(scene): the one entry point boot calls (placeholder in phase 2, pixel art in phase 4)
        art/font.ts                 createLabel(scene, ...): the one way scenes draw text (Phaser text in phase 2, pixel font in phase 4)
        audio/index.ts              createAudio(ctx, settings): AudioPort { onEvents(drained), setMuted } (silent in phase 2, real in phase 4)
        art/ (phase 4)              pixel.ts, palettes.ts, sprites/*.ts
        audio/ (phase 4)            synth.ts, sequencer.ts, sfx.ts, adapter.ts, notation.ts, songs/*.ts
        fx/    (phase 5)            effects driven by drained events: particles, shake, flashes
    scenarios/                      Playwright scenarios (typed kit)
    tests/                          smoke.spec.ts, save.test.ts, fixtures/save-v1.json (template shape), fixtures/save-v2.json

Test files sit next to the module they test (`level/parse.test.ts`), matching the template.

Core types (in `logic/types.ts`, abbreviated):

```ts
export const TILE = 16;
export type RacerId = 'player' | 'tess' | 'squib' | 'bo';
export const RACER_IDS: readonly RacerId[] = ['player', 'tess', 'squib', 'bo'];
export interface Vec { x: number; y: number }
export interface Intent { move: Vec; kick: boolean; burst: boolean }
export type Cell = 'water' | 'rock' | 'coral' | 'kelp' | 'current-right' | 'current-left' | 'current-up' | 'current-down';
export interface LevelDef { name: string; ascii: string; dark?: readonly [from: number, to: number][] }
export interface Level { name; width; height; cells: Cell[][]; starts: Vec[]; finishX: number; pearls: Vec[]; clams: Vec[]; urchins: Vec[]; jellies: Vec[]; dark: [number, number][] }
export interface Body { x; y; vx; vy; w; h }
export interface Environment { current: Vec | null; inKelp: boolean }
export interface MoveModifiers { forceMul; kickMul; kickCooldownTicks; dragMul }
export interface AiMemory { wobble; stuckTicks; recoverTicks; recoverDir: Vec; aim: Vec; replanIn }
export interface RivalProfile { id; forceMul; kickSkill; wobble; reactionTicks; mass; itemAggression }
export interface Racer { id; body; facing: 1 | -1; kickCooldown; progress; place; finished: { tick; place; overshoot } | null; ai: AiMemory | null; profile: RivalProfile }
export interface RaceState { phase: 'countdown' | 'racing' | 'finished'; raceTick; rivalsDoneAt: number | null; result: RaceResult | null }
export interface RaceResult { standings: RacerId[]; playerPlace: number; playerTicks: number | null }
export interface FlowFields { width; height; progress: Float32Array; steer: Float32Array; smash: Float32Array }
export interface World { level; fields; broken: Set<number>; racers: Racer[]; race: RaceState; tick; rngs: Record<string, Rng>; events: EventSink<GameEvent>; contacts: Set<string> }
```

Events (phase 1): `race.countdown {n}`, `race.started`, `racer.kicked {id}`, `racer.bumped {a, b}`, `player.place {place}`, `racer.finished {id, place, ticks}`, `race.finished {standings, playerPlace, playerTicks}`. Engine adds `scene.started`, `menu.selected`, `save.written`, `save.failed`.

`summarize(world)` returns `{ tick, phase, raceTick, place: '2/4', progress (rounded tiles), finished, player: { tile: [x, y], kickReady } }`; phase 3 adds `stack`, `pearls`, `stunned`.

Save v2: `{ best: { ticks: number; place: number } | null, races: number, settings: { muted: boolean, reducedMotion: boolean | null } }` (`reducedMotion: null` follows the OS). `migrations[1]` turns the template's v1 `{collected, completed}` into `NEW_GAME`; `tests/fixtures/save-v1.json` stays and `save-v2.json` is added.

## Phases

### Phase 1: race logic on the first reef section (MVP)

Scaffold: be3d297
Demo: `pnpm arcade dev reef-rush`, press A on the title, swim the first section against three rivals (template-style placeholder rendering adapted to the new world), see the finish text. Headless: `pnpm arcade see reef-rush --scenario race-to-finish --at 0,200,end` and `pnpm --filter game-reef-rush exec vitest run src/logic/world.test.ts`.
Test cases:
- parse: reads every tile character (`#` rock, `C` coral, `~` kelp, `> < ^ v` currents, `.` water, `1-4` starts, `F` finish, `o` pearl, `?` clam, `*` urchin, `j` jellyfish); start and object tiles are water; dark zones pass through.
- parse: throws LevelError with row/col for ragged rows, unknown characters, missing or duplicate start digits, no `F`, `F` in two columns, a dark zone outside the map or with from > to.
- query: outside the map on every side is rock; coral is solid unless its index is in `broken`; kelp, currents and water are not solid; environment sampling at the body centre reports current direction and kelp.
- physics: holding a direction from rest reaches cruise speed (`SWIM.cruise`, about 70 px/s) and no more; diagonal input has the same cruise speed; releasing input decays speed by drag; no vertical input sinks slowly; kick adds an impulse along input (along facing when input is zero), sets the cooldown, emits `racer.kicked`, and is ignored while cooling down; total speed never exceeds `SWIM.maxSpeed`; kelp lowers cruise speed; a current pushes a racer with no input and speeds one swimming with it; forceMul scales cruise speed; facing follows horizontal input and keeps its value at zero input.
- collide: a body stops flush against rock on each side and loses that velocity component; diagonal movement slides along a wall; a body never ends a step inside a solid tile at max speed; a broken coral tile is passable; two overlapping racers are pushed apart in proportion to the other's mass and emit `racer.bumped` once per contact start (not every tick of a sustained overlap).
- flowfield: progress is 0 on finish tiles and grows away from it; rock is unreachable (Infinity); progress treats coral as passable and steer treats it as solid unless broken; kelp and swimming against a current cost more in steer; steering from a body points toward lower steer distance and never through a solid corner; `unreachableStarts` lists starts that steer cannot reach; sub-tile progress is lower for a body further along the same tile.
- standings: countdown emits 3, 2, 1 at race ticks 0, 60, 120 and `race.started` at 180, and racers do not move before it; placing follows progress with finished racers first; ties break by `RACER_IDS`; `player.place` is emitted only on change and not during countdown; crossing `finishX` records place, ticks and overshoot once; two racers crossing on the same tick are placed by overshoot; the race ends when the player finishes, `DNF_GRACE_TICKS` after the third rival finishes, or at `RACE_LIMIT_TICKS`, and the result places the DNF player after finishers with `playerTicks: null`.
- rival: on a corridor level a rival reaches the finish; it never kicks while its kick is cooling down; with the same seed two runs are identical; a rival pinned against a wall recovers within 60 ticks; catch-up multiplies force by less than 1 when far ahead of the player and more than 1 when far behind, within `CATCH_UP` bounds.
- world (scaffold-owned): a full race on OCEAN_LEVEL with an idle player ends by DNF with all three rivals finished; the same seed repeats exactly; different seeds differ; `createWorld` throws LevelError for a level whose start is sealed off.
- save (scaffold-owned): NEW_GAME validates; the v1 fixture migrates to NEW_GAME; the v2 fixture loads unchanged.
- scenarios (scaffold-owned): `countdown-holds-racers`, `race-to-finish` (holding right with kicks finishes the first section).

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/level/parse.ts, games/reef-rush/src/logic/level/query.ts, games/reef-rush/src/logic/swim/physics.ts, games/reef-rush/src/logic/swim/collide.ts | contracts, templates/phaser-2d/src/logic/world.ts | games/reef-rush/src/logic/level/parse.test.ts, games/reef-rush/src/logic/level/query.test.ts, games/reef-rush/src/logic/swim/physics.test.ts, games/reef-rush/src/logic/swim/collide.test.ts | opus | merged | deliver/reef-rush-1a | level and swim tests pass, typecheck passes |
| b | M | games/reef-rush/src/logic/race/flowfield.ts, games/reef-rush/src/logic/race/priority-queue.ts, games/reef-rush/src/logic/race/priority-queue.test.ts, games/reef-rush/src/logic/race/standings.ts, games/reef-rush/src/logic/ai/rival.ts | contracts | games/reef-rush/src/logic/race/flowfield.test.ts, games/reef-rush/src/logic/race/standings.test.ts, games/reef-rush/src/logic/ai/rival.test.ts | opus | merged | deliver/reef-rush-1b | race and rival tests pass, typecheck passes |

Inline (orchestrator, in the scaffold and while lanes run): types, events, save v2 and fixtures, world.ts and world.test.ts, levels.ts first section, profiles.ts, template engine adapted to the new world API, scenarios, smoke, DESIGN.md and game.json, deleting the template's coin files.

(Lane briefs follow below the phase list.)

### Phase 2: the playable race engine

Demo: `pnpm arcade dev reef-rush`: title, countdown, race with HUD (place, timer, progress strip with four racer markers), camera with lookahead, results screen with best time, race again. `pnpm arcade see reef-rush --scenario race-to-finish --mobile`.
Depends on: phase 1

One lane: the engine has no seam inside it until the runtime and scenes exist, and splitting it earlier would leave both halves unverifiable (critique finding 3). It owns every engine file and the scenarios/smoke.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/engine/, games/reef-rush/src/main.ts, games/reef-rush/src/logic/records.ts, games/reef-rush/src/logic/records.test.ts, games/reef-rush/scenarios/, games/reef-rush/tests/smoke.spec.ts, games/reef-rush/DESIGN.md | contracts, templates/phaser-2d/src/engine/game.ts | | opus | pending | | gate passes; see captures at desktop and mobile reviewed |

### Phase 3: stacking power-ups, pickups and hazards

Demo: `pnpm arcade see reef-rush --scenario cannonball-combo --at 0,40,end`; in dev, open clams, stack three power-ups, burst them, get hit and watch the newest power-up float away.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/powerups/, games/reef-rush/src/logic/pickups/, games/reef-rush/src/logic/modifiers.ts | contracts | | opus | pending | | |
| b | M | games/reef-rush/src/logic/hazards/, games/reef-rush/src/logic/ai/rival.ts, games/reef-rush/src/logic/race/flowfield.ts | contracts | | opus | pending | | |
| c | M | games/reef-rush/src/engine/view/pickup-view.ts, games/reef-rush/src/engine/view/hazard-view.ts, games/reef-rush/src/engine/view/powerup-view.ts, games/reef-rush/src/engine/view/hud.ts, games/reef-rush/src/engine/scenes/race.ts, games/reef-rush/scenarios/ | contracts | | sonnet | pending | | |

### Phase 4: pixel art and chiptune audio

Demo: `pnpm arcade see reef-rush --scene race --at 0,240` shows final sprites, animated tiles, parallax and light; dev build plays the title and race themes and SFX. Music is judged by ear: the phase tag message asks the user to listen.
Depends on: phase 2

Runs alongside phase 3. Its lanes own only files behind the seams phase 2 built (`art/index.ts`, `art/font.ts`, `view/backdrop.ts`, `audio/index.ts`), so it never touches phase 3's files. `art/keys.ts` declares phase 3's sprites in phase 2.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/engine/art/index.ts, games/reef-rush/src/engine/art/font.ts, games/reef-rush/src/engine/art/pixel.ts, games/reef-rush/src/engine/art/palettes.ts, games/reef-rush/src/engine/art/sprites/, games/reef-rush/src/engine/view/backdrop.ts | contracts | | opus | pending | | |
| b | M | games/reef-rush/src/engine/audio/index.ts, games/reef-rush/src/engine/audio/synth.ts, games/reef-rush/src/engine/audio/sequencer.ts, games/reef-rush/src/engine/audio/sfx.ts, games/reef-rush/src/engine/audio/adapter.ts | contracts | | opus | pending | | |
| c | M | games/reef-rush/src/engine/audio/songs/, games/reef-rush/src/engine/audio/notation.ts | contracts | | opus | pending | | |

### Phase 5: the full ocean course, difficulty tuning, juice and settings

Demo: full race on the finished course with music, effects and the settings menu; `pnpm --filter game-reef-rush exec vitest run src/logic/difficulty.test.ts`.
Depends on: phase 3, phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/level/levels.ts, games/reef-rush/src/logic/ai/profiles.ts, games/reef-rush/src/logic/difficulty.test.ts | contracts | | opus | pending | | |
| b | M | games/reef-rush/src/engine/fx/, games/reef-rush/src/engine/scenes/title.ts, games/reef-rush/src/engine/scenes/results.ts | contracts | | sonnet | pending | | |

## Lane briefs, first phase

### Lane 1/a brief: level parsing, tile queries, swim physics and collision

- Goal: turn course ASCII into a `Level`, answer tile questions about it, and move one racer's body through it with swim physics and tile collision, plus racer-to-racer separation.
- Interface (stubs and their doc blocks are in the scaffold; keep every signature):
  - `level/parse.ts`: `class LevelError extends Error { row: number | null; col: number | null }`, `parseLevel(def: LevelDef): Level`.
  - `level/query.ts`: `cellAt(level, tx, ty): Cell`, `isSolid(level, broken, tx, ty): boolean`, `tileIndex(level, tx, ty): number`, `bodyTiles(body): { left; right; top; bottom }`, `overlapsTile(body, tx, ty): boolean`, `sampleEnvironment(level, body): Environment`.
  - `swim/physics.ts`: `SWIM` constants, `applyIntent(racer, intent, env, mods, events, dt): void` (velocity, facing, kick cooldown; never position).
  - `swim/collide.ts`: `moveBody(body, level, broken, dt): void` (integrates position, resolves X then Y against solids, zeroes the blocked component), `separateRacers(racers, contacts, events): void`.
- Behavior:
  - Parse: rows trimmed of surrounding whitespace, blank leading/trailing lines ignored; `\r\n` treated as `\n`. Characters per the test-case list. Starts `1`-`4` map to `starts[0..3]` in `RACER_IDS` order. Errors as in the error model, message format `"<what> at row R, col C"` with 0-based indices.
  - Query: outside the grid is `rock`. `isSolid` is true for rock and for coral whose `tileIndex` is not in `broken`. Environment samples the tile under the body centre.
  - Physics: per tick, with `d` = normalised `intent.move` (zero stays zero): `v += d * SWIM.force * mods.forceMul * dt`; if `intent.move.y === 0` add `SWIM.sink * dt` downward; current adds `SWIM.currentForce * dt` along its direction; drag `v *= 1 - SWIM.drag * mods.dragMul * (kelp ? SWIM.kelpDragMul : 1) * dt`; kick when `intent.kick && kickCooldown === 0`: add `SWIM.kick * mods.kickMul` along `d` (or `{x: facing, y: 0}`), set cooldown to `mods.kickCooldownTicks`, emit `racer.kicked`; cooldown counts down by 1 per tick otherwise; clamp speed to `SWIM.maxSpeed`. Because drag applies after force within a tick, cruise settles at `force / drag * (1 - drag * dt)`, about 66 px/s with scaffold values; tests accept 90-100% of `force / drag`. A kick fires when cooldown is 0 and sets it to `kickCooldownTicks`; the countdown starts next tick, so a held kick fires every `kickCooldownTicks + 1` ticks.
  - Collide: one axis at a time like the template's `resolveX`/`resolveY`, using `isSolid`; sub-step when `|v| * dt` exceeds half a tile so a body never tunnels. Separation: for each pair (i < j) in array order that overlaps, push apart along the axis of least penetration, split by mass (`profile.mass`), and, only while they are closing on that axis, exchange velocity so each loses half the closing speed for equal masses, with the heavier racer's velocity changing less (scale each share by the other's mass fraction); key `"a|b"` in `contacts` tracks contact so `racer.bumped` fires only when a contact starts, and the key is removed when they separate.
- Decisions already made: determinism rules in the spec; tile 16 px; body 12x10; no throws during stepping.
- Out of scope: flow fields, AI, standings, power-up effects (they only arrive through `MoveModifiers`), anything in `world.ts`.
- Done when: the four test files pass, typecheck passes, check-lane is clean.

### Lane 1/b brief: flow fields, standings and the rival AI

- Goal: compute distance-to-finish fields, keep the race's countdown, progress, finishes, places and result, and drive each rival's intent.
- Interface (stubs in the scaffold; keep every signature):
  - `race/flowfield.ts`: `buildFlowFields(level, broken): FlowFields`, `progressAt(fields, level, body): number`, `steerDirection(field: Float32Array, fields, level, broken, body, lookahead): Vec`, `unreachableStarts(level, fields): number[]`.
  - `race/standings.ts`: `COUNTDOWN_TICKS = 180`, `DNF_GRACE_TICKS = 600`, `RACE_LIMIT_TICKS = 18000`; `advanceClock(world): boolean` (true while counting down; on the start tick switches to racing with raceTick 0; while racing adds 1), `updateProgress(world)`, `recordFinishes(world)`, `updatePlaces(world)`, `checkRaceEnd(world)`.
  - `ai/rival.ts`: `createAiMemory(): AiMemory`, `rivalIntent(world, racer, rng): Intent` (reads world, mutates only `racer.ai`), `catchUpMul(racer, player): number`, `CATCH_UP` bounds.
- Behavior:
  - Fields: Dijkstra from every finish-column tile over 8-neighbours, no diagonal move when either orthogonal neighbour is solid. `progress`: cost 1 orthogonal / √2 diagonal, coral passable, rock Infinity. `steer`: same base cost times 2.5 in kelp; entering a current tile costs 0.4× moving with its direction, 3× against, 1× across; coral Infinity unless broken. `smash`: like `steer` but coral costs 6 (used by puffer holders in phase 3). Tile values in tile units.
  - `progressAt`: interpolate between the body centre's tile and its lowest-progress neighbour by the centre's projection toward that neighbour, so a body further along a tile has lower progress.
  - `steerDirection`: follow descending `field` values `lookahead` tiles (default 3) from the centre tile; return the unit vector from the body centre to that tile's centre; `{0,0}` on a finish tile.
  - Standings: race tick advances only while racing; countdown events at race ticks 0/60/120 and `race.started` at 180 (countdown phase uses `race.raceTick` counting 0..180 then resets to 0 for racing). Finishing: body centre x ≥ `finishX * TILE`, records `{tick: raceTick, place, overshoot}` once and emits `racer.finished`. Places: finished first by place, then by progress, ties `RACER_IDS`. `player.place` on change only. Race end per error model; emit `race.finished` once and set `race.result`.
  - Rival: aim = `steerDirection(fields.steer, ...)` re-sampled every `profile.reactionTicks`; add wobble (a random walk on angle bounded by `profile.wobble` radians, stepped with the racer's rng every tick); kick when off cooldown and aim·velocity-direction > 0.8 and `rng.next() < profile.kickSkill` (rng consumed every tick regardless, so streams stay aligned); stuck when speed < 8 px/s for 30 ticks while racing, then swim for 20 ticks perpendicular to aim (side picked by rng) before resuming. Catch-up: gap = racer.progress − player.progress (tiles); `1 + clamp(gap * CATCH_UP.perTile, CATCH_UP.min - 1, CATCH_UP.max - 1)`, and exactly 1 when either progress is not finite, with `CATCH_UP = { perTile: 0.004, min: 0.9, max: 1.08 }`. `rivalIntent` never sets `burst` in phase 1.
- Decisions already made: determinism rules in the spec; placing uses `progress`, steering uses `steer`; `world.ts` calls these in the documented order and owns the rngs (`rivalIntent` receives the racer's own rng).
- Out of scope: items and burst use, `smash` consumers, profile tuning (profiles.ts is scaffold data), anything in `world.ts`.
- Done when: the three test files pass, typecheck passes, check-lane is clean.

### Lane 2/a brief: the playable race engine

- Goal: replace phase 1's adapted template engine with the engine layout in Contracts, so the game plays title, countdown, race with HUD, and results, and every later phase plugs into a named seam instead of editing a 300-line file. This engine is the reference later games copy; structure matters as much as behavior.
- Interface (create these; each file opens with a responsibility block, each export has a doc comment):
  - `engine/game.ts`: `startPhaser(ctx, saves): Promise<GameHandle>`; Phaser config, scene list, ResizeObserver integer zoom, WebGL context-loss reporting, audio context registration, and the GameHandle (`advance`, `idle`, `renderer`, `debugSummary`, `debugState`, `loadState`, `pause`, `resume`). Wiring only.
  - `engine/runtime.ts`: `class Runtime` owning `events: EventLog<GameEvent | EngineEvent>`, `step: FixedStep`, `scene`, `loading`, `world`, `save`, `settings` (resolved: `muted`, `reducedMotion` from the save or `matchMedia` when null), `lastResult`, `audio: AudioPort`; methods `frame(deltaMs)`, `goTo(scene)`, `entered(scene)`, `startRace()`, `persist(data)`. Its tick drains events once with its own cursor and hands them to `audio.onEvents`. `EngineEvent` (scene.started, menu.selected, save.written, save.failed {reason}) is exported from here.
  - `engine/input.ts`: unchanged from phase 1.
  - `engine/scenes/boot.ts` (calls `buildTextures(scene)` then routes by `?scene=`), `title.ts`, `race.ts`, `results.ts`. Scene keys: `boot`, `title`, `race`, `results`; `?scene=race` (and `?scene=play` as an alias) skips the title.
  - `engine/view/level-view.ts` (`createLevelView(scene, level): LevelView`: rock and coral via a Phaser Tilemap built from data with a generated tileset, kelp and currents as sprites, finish gate, inert placeholders for pearls, clams, urchins and jellies so phase 3 can replace them), `racer-view.ts` (`createRacerView(scene, racer): RacerView` with `sync(racer)`: position rounded, facing flip, two-frame swim animation keyed by speed, kick squash), `hud.ts` (`createHud(scene): Hud` with `sync(world)`: big place ("2nd"), race timer m:ss.cc, progress strip across the top with four racer markers in distinct shapes and colors, kick-ready pip, countdown and GO banner; text only through `art/font.ts`), `camera.ts` (`followRacer(camera, body, level)`: deadzone, velocity lookahead, frame-rate independent smoothing, integer scroll), `backdrop.ts` (`createBackdrop(scene, level): Backdrop`: depth-graded colour bands and two placeholder parallax layers; phase 4 replaces the body).
  - `engine/art/keys.ts`: `Tex`, `Frame` and `Anim` consts for every sprite the game will need, including phase 3's: racers (2 swim frames each), rock, coral, coral debris, kelp (2 frames), currents (4 dirs, 2 frames), finish gate, pearl, clam (closed, open), urchin, jellyfish (2 frames), the five power-up icons, ink cloud, bubble, loose power-up glow, HUD marker shapes. `engine/art/index.ts`: `buildTextures(scene)` builds every key (placeholders from `art/placeholder.ts` now) and registers animations once. `engine/art/font.ts`: `createLabel(scene, x, y, text, options): Label` (Phaser Text with monospace now; phase 4 swaps to a pixel font behind the same signature).
  - `engine/audio/index.ts`: `type AudioPort = { onEvents(events): void; setMuted(muted): void; dispose(): void }` and `createAudio(ctx, settings): AudioPort`, silent in this phase.
  - `logic/records.ts`: `recordResult(save, result): SaveData` (one more race; a new best only when the player finished and beat the old ticks) with `records.test.ts` covering first finish, slower finish, faster finish, DNF.
  - Delete `engine/textures.ts`.
- Behavior:
  - Title: game title, "Race" (kick confirms; up/down move the selection if more options exist), best time and place when the save has one.
  - Race: countdown banner 3/2/1/GO, HUD, camera follows the player, rivals rendered and labelled by colour/shape on the strip. When `race.finished` fires, wait 90 ticks (counted in the runtime tick, not Phaser time) then go to `results`.
  - Results: standings with each racer's name and time (or DNF), the player's row highlighted, "New best!" when it is, "Best time not saved" when `save.failed` fired; options "Race again" and "Title".
  - Persistence: exactly one `persist(recordResult(...))` per finished race; emits `save.written` or `save.failed {reason}` and logs a warning on failure.
  - Debug: `debugSummary()` = `{ scene, save, ...summarize(world) }` plus `menu` on menus; `debugState()` adds racers, race, settings, `ascii`.
  - `?debug=1` draws racer hitboxes from logic state and shows tick and tile.
  - Text: every HUD and menu string goes through `createLabel`; nothing else creates `Phaser.GameObjects.Text`.
- Scenarios (yours; delete none, add these): `race-to-finish` (keep phase 1's), `countdown-holds-racers`, `results-after-finish` (finishing shows the results scene with the player's place and a `save.written`), `dnf-results` (an idle player reaches results with DNF), `race-again` (from results, Race again returns to a fresh countdown). Update `tests/smoke.spec.ts` for the new scenes, keep the `@touch` test, and add a reload test showing the best time on the title.
- Decisions already made: Phaser 4.2.1 (read `node_modules/phaser/skills/` for tilemaps, cameras, text, animations before writing them; the repo's `.claude/skills/phaser-game` wins on how Phaser fits the repo); logic ticks only in the FixedStep callback; no Phaser input, clocks or tweens for gameplay; engine effects only from drained events; 320x180, integer zoom, `pixelArt: true`.
- Out of scope: real pixel art, sound, particles and screen shake, power-ups, settings UI (settings are read and stored only), changes to logic outside `records.ts`.
- Done when: `pnpm arcade check reef-rush` and `pnpm arcade smoke reef-rush` pass; `pnpm arcade see reef-rush --scenario race-to-finish --at 0,200,600,end` and the same with `--mobile` are reviewed and the HUD is readable and clear of the touch overlay and back link; DESIGN.md is updated for scenes, controls and scenarios; check-lane is clean.

## Log

- 2026-11-22: `arcade new` writes `.claude/launch.json` in a shape Biome rejects (`tools/arcade/src/new-game.ts:78`, `JSON.stringify` expands arrays), so `check` fails on a freshly created game. Formatted with `pnpm fix` here; the tool fix is a separate change.
- 2026-11-22: main gained 1e3b073 (docs/repo-map.md) after the landing branch was cut; merged main into deliver/reef-rush as 1febb4d. Phase 1 lanes branch from 1febb4d and use it as their check-lane and lane-review base. The first dispatch used agent worktree isolation, which cut both lanes from main and deleted their worktrees when they stopped to ask; both were redispatched into orchestrator-made worktrees with no work lost.
- 2026-11-22: Lane 1/b fixes (5453629) merged. Open: flowfield.ts is 266 lines (field building and field lookups in one file; splitting needs test import changes); progressAt still steps 0.5 tiles where the route turns, inherent to the briefed interpolation, which can swap places of racers within half a tile. Both left for the phase 1 boundary review.
- 2026-11-22: Lane 1/b review: 3 findings, all accepted and sent back: kicks aligned against move instead of aim (sideways kicks during stuck recovery), the clear-line check tests only the centre line so 12x10 bodies clip rock corners, and progressAt interpolates toward corner-blocked diagonals (non-monotonic progress, place flicker). Scaffold fixture bug in rival.test.ts (ragged rows) fixed on the landing branch in d533e48.
- 2026-11-22: Lane 1/a fixes (7fa13b3) merged: the wall fix uses a push-out pass at the start of moveBody instead of leading-edge resolution (the lane showed leading-edge still snapped on the next row of a full-height wall); MAX_SUBSTEPS = 64; regression tests added to collide.test.ts and physics.test.ts with explicit permission (check-lane flags them as outside Owns; accepted).
- 2026-11-22: Lane 1/a review: 3 findings, all accepted and sent back: racers bumped into a wall stuck to it (resolve only tiles the leading edge newly enters), drag reversing velocity and unbounded sub-steps at large dt (clamp both), MAX_STEP comment gave the wrong reason. The lane may add regression tests to collide.test.ts and physics.test.ts.
- 2026-11-22: Lane 1/b (e8ad20d) accepted choices: diagonal current entry judged by the sign of its along-current component; costs charged on the entered tile; a diagonal is blocked when either orthogonal tile is unenterable for that field; steerDirection walks the lookahead path only while the straight line stays clear; progressAt projects in [-0.5, 0.5] and is Infinity on unreachable tiles; rivalsDoneAt set in recordFinishes; standings act only while racing; three rng draws per rival tick (wobble, kick, recovery side), wobble step 0.15 x profile.wobble; no kick at zero speed. flowfield.ts was 290 lines with a heap inside, so race/priority-queue.ts was added to the lane.
- 2026-11-22: Lane 1/a (b3e3195) accepted choices: racers sink only with no input at all (a test needs exact forceMul scaling, and holding sideways shouldn't drag a racer to the floor); touching racers keep an existing contact and only a real gap clears it; coincident centres push the later racer forward; sub-steps at most 8 px sized by speed; dark-zone LevelErrors carry null row/col; an empty level fails as a missing start; edge-only contact doesn't cover a tile.
- 2026-11-22: The `arcade new` launch.json fix landed separately on branch fix/arcade-new-launch-format (069a0e3).
- 2026-11-22: Scaffold test writer flagged contract gaps; settled: createWorld computes initial progress, catch-up is 1 for non-finite progress, cruise is force/drag less one tick of drag, held kicks repeat every cooldown+1 ticks, LevelError row/col null for whole-level errors, bump velocity exchange only when closing and mass-weighted. Steer cost for entering a current diagonally is left to lane b and not tested.
- 2026-11-22: Plan critique (devils-advocate, opus) raised 8 findings; all applied: integration files owned inline in the scaffold, DNF/limit race end, engine split moved to its own single-lane phase, seams for art/audio so phase 4 runs beside phase 3, explicit tick order + forked rngs + progress-field placing with tie-breaks, save v2 with migration instead of editing v1, three flow fields with rebuild on coral break (phase 3 lane b owns flowfield.ts), audio.played per sound and no console in the difficulty test.
