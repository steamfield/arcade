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
- UI design bar (the user rated the phase 2 placeholder UI 4/10): a designed pixel UI kit, not debug text. One hand-made pixel font with a text size and a display numeral size on the pixel grid; a 4-5 colour UI palette distinct from the world palette; 9-slice pixel panels with a 1 px highlight and shadow; an icon set (kick, burst, the five power-ups, medals, finish flag); a 16x16 portrait per racer; a REEF RUSH logotype. HUD: a framed place panel (portrait plus big numeral), framed timer, a track-style progress strip with racer head icons and a finish flag, animated place changes (arrow and colour pop up or down), big countdown numerals and GO / FINAL STRETCH / FINISH splashes. Results: a podium with portraits, times revealed in sequence, medal and NEW BEST ribbon, framed buttons with an animated cursor. Title: logotype, racers swimming past, blinking PRESS A, best-time card. Layout follows a written grid and safe zones (back link top right, touch controls bottom corners), and UI motion obeys reduced motion.

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
- Tick order in `stepWorld`: countdown; then intents for every unfinished racer are computed from the start-of-tick state in `RACER_IDS` order; then each unfinished racer's physics and tile movement in `RACER_IDS` order; then one pass of pairwise separation over unfinished pairs (i < j) in `RACER_IDS` order (finished racers are out of play: they don't move or bump); then progress, finishes, places and race end. Phase 2+ systems slot in at named points in `world.ts`.
- Randomness: `world.rngs` holds one `Rng` per consumer, forked from the seed with fixed salts (`ai.player`, `ai.tess`, `ai.squib`, `ai.bo`, later `pickups`, `hazards`); the seed is mixed (`Math.imul(seed, 0x9e3779b1)`) before the salt is XORed in, so no stream at one seed replays another stream at another seed. Adding a new consumer never changes an existing stream.
- Placing uses the progress field (uniform-cost geometric distance, coral passable), sampled bilinearly between the four tile centres around the body centre (unreachable corners take a reachable neighbour's value), so places don't flicker crossing kelp or currents. Ties break by `RACER_IDS` order. Same-tick finishes break by how far past the finish line the body centre is (further first), then `RACER_IDS` order.

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
        racers.ts                   queries over the world's racers: playerOf, activeRacers (unfinished, RACER_IDS order)
        modifiers.ts                combines profile, catch-up and (phase 3) held power-ups into MoveModifiers
        level/parse.ts              LevelDef (ASCII + dark zones) into Level; throws LevelError
        level/query.ts              tile lookups on a Level: cellAt, isSolid, overlap and environment sampling
        level/levels.ts             the course data (OCEAN_LEVEL); data only
        swim/physics.ts             one racer's velocity from intent, environment and modifiers (force, drag, sink, kick, current, kelp)
        swim/collide.ts             moving a body through tiles, and separating overlapping racers
        race/flowfield.ts           progress, steer and smash fields over the tile grid: cost model, build, rebuild after coral breaks, progressAt, unreachableStarts
        race/coral.ts               breakCoral(world, tx, ty, by): the only writer of World.broken; rebuilds steer and smash, emits coral.broken
        race/priority-queue.ts      min-heap keyed by distance, used by the flow-field Dijkstra
        race/standings.ts           countdown, progress, finishes, placing and the race result
        ai/rival.ts                 an AI racer's Intent each tick from the fields, its profile, memory and rng
        ai/steer.ts                 steerDirection: downhill lookahead on a field, aimed only where the whole body can slide
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
export interface World { level; fields; broken: ReadonlySet<number>; racers: Racer[]; race: RaceState; tick; rngs: Record<string, Rng>; events: EventSink<GameEvent>; contacts: Set<string> }
```

Events (phase 1): `race.countdown {n}`, `race.started`, `racer.kicked {id}`, `racer.bumped {a, b}`, `coral.broken {tx, ty, by}` (from `breakCoral`; phase 3 calls it), `player.place {place}`, `racer.finished {id, place, ticks}`, `race.finished {standings, playerPlace, playerTicks}`. Engine adds `scene.started`, `menu.selected`, `save.written`, `save.failed`.

`summarize(world)` returns `{ tick, phase, raceTick, place: '2/4', progress (rounded tiles), finished, player: { tile: [x, y], kickReady } }`; phase 3 adds `stack`, `pearls`, `stunned`.

Save v2: `{ best: { ticks: number; place: number } | null, races: number, settings: { muted: boolean, reducedMotion: boolean | null } }` (`reducedMotion: null` follows the OS). `migrations[1]` turns the template's v1 `{collected, completed}` into `NEW_GAME`; `tests/fixtures/save-v1.json` stays and `save-v2.json` is added.

## Phases

### Phase 1: race logic on the first reef section (MVP)

Scaffold: be3d297
Tag: phase-1
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

Scaffold: d1b23ee (single lane owning every file it creates; no stubs needed)
Tag: phase-2
Demo: `pnpm arcade dev reef-rush`: title, countdown, race with HUD (place, timer, progress strip with four racer markers), camera with lookahead, results screen with best time, race again. `pnpm arcade see reef-rush --scenario race-to-finish --mobile`.
Depends on: phase 1

One lane: the engine has no seam inside it until the runtime and scenes exist, and splitting it earlier would leave both halves unverifiable (critique finding 3). It owns every engine file and the scenarios/smoke.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/engine/, games/reef-rush/src/main.ts, games/reef-rush/src/logic/records.ts, games/reef-rush/src/logic/records.test.ts, games/reef-rush/scenarios/, games/reef-rush/tests/smoke.spec.ts, games/reef-rush/DESIGN.md | contracts, templates/phaser-2d/src/engine/game.ts | | opus | merged | deliver/reef-rush-2a | gate passes; see captures at desktop and mobile reviewed |

### Phase 3: stacking power-ups, pickups and hazards

Demo: `pnpm arcade see reef-rush --scenario cannonball-combo --at 0,40,end`; in dev, open clams, stack three power-ups, burst them, get hit and watch the newest power-up float away.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/powerups/, games/reef-rush/src/logic/pickups/, games/reef-rush/src/logic/modifiers.ts | contracts | | opus | merged | deliver/reef-rush-3a | |
| b | M | games/reef-rush/src/logic/hazards/, games/reef-rush/src/logic/ai/rival.ts, games/reef-rush/src/logic/ai/steer.ts, games/reef-rush/src/logic/race/flowfield.ts, games/reef-rush/src/logic/race/coral.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/ai/rival.test.ts, games/reef-rush/scenarios/dnf-results.ts | contracts | | opus | merged | deliver/reef-rush-3b | |
| c | M | games/reef-rush/src/engine/view/pickup-view.ts, games/reef-rush/src/engine/view/hazard-view.ts, games/reef-rush/src/engine/view/powerup-view.ts, games/reef-rush/src/engine/view/hud.ts, games/reef-rush/src/engine/scenes/race.ts, games/reef-rush/scenarios/clam-stack.ts, games/reef-rush/scenarios/cannonball-combo.ts, games/reef-rush/scenarios/hit-pops-newest.ts | contracts | | sonnet | merged | deliver/reef-rush-3c | |

Scaffold: 1c2098b (on phase branch deliver/reef-rush-p3). Scaffold-owned, no lane edits: logic/types.ts, events.ts, world.ts, racers.ts, status.ts, num.ts, test-world.ts (shared test helpers), swim/collide.ts, swim/physics.ts, level/query.ts. Scaffold fixes after lane reviews: 84d33a4 (Racer.dashCombos, applyHit ends a dash, query helpers take Box, sqrt for hypot), 95feccc (num.ts).
Tag: phase-3

Phase 3 scaffold (orchestrator, after phase 2 tags): types, events, World/Racer fields, stubs and the test files below (written from this list), plus the `world.ts` tick-order slots and `modifiers.ts`, `summarize` and `toAscii` hooks. Then lanes a and b own their modules and lane c the views.

Contracts added in the scaffold:
- `PowerUpKind = 'jetFin' | 'bubbleShield' | 'puffer' | 'inkSac' | 'glowLantern'`; `ComboName = 'cannonball' | 'inkTrail' | 'seekerBubble' | 'inkBomb' | 'comet'`.
- `Racer` gains `stack: PowerUpKind[]` (oldest first, at most 3, no duplicates), `burstCooldown`, `pearls`, and `status: { stunned; invulnerable; slowed; trapped; inflated; dashing; boost }` (tick counters, 0 = off) plus `dashDir: Vec`.
- `World` gains `clams: { tile: Vec; closedFor: number }[]`, `pearlsTaken: Set<number>`, `loose: { kind; x; y; grabDelay; ttl }[]`, `inks: { x; y; radius; ttl; owner: RacerId }[]`, `bubbles: { x; y; vx; vy; ttl; owner; seeking: boolean }[]`, `jellies: { home: Vec; phase: number; stunned: number }[]`. RNG streams add `pickups` and `hazards`.
- Events: `clam.opened {id, index, kind}`, `powerup.gained {id, kind}`, `powerup.lost {id, kind, cause: 'hit' | 'full'}`, `loose.spawned {kind}`, `loose.grabbed {id, kind}`, `pearl.collected {id, index, total}`, `burst.fired {id, kinds, combo: ComboName | null}`, `ink.spawned {owner}`, `bubble.spawned {owner}`, `bubble.popped {by: RacerId | null}`, `racer.trapped {id, by}`, `flash.fired {id}`, `racer.hit {id, cause: 'urchin' | 'jelly' | 'bubble' | 'puffer' | 'flash', by: RacerId | null}`, `shield.popped {id}`, `racer.stunned {id}`.
- Tick order slots in `stepWorld` after movement and separation: bursts (from intents) → projectiles and inks advance → jellies move → contacts (urchins, jellies, bubbles, inflated puffers, flash) resolve hits → pickups (clams, pearls, loose) → status counters tick down → standings. Bursts and all of the above apply to active racers only.
- `modifiersFor` folds in held power-ups and statuses: Jet Fins forceMul ×1.15 and kickCooldownTicks 22; boost (pearl) forceMul ×1.2; slowed (ink) forceMul ×0.5; inflated forceMul ×0.8; dashing overrides velocity (see burst) and ignores drag; stunned and trapped zero the intent (handled in world.ts before physics: the intent becomes idle, and trapped racers float up at 30 px/s).

Test cases:
- stack: gaining adds to the top; a fourth power-up drops the oldest with `powerup.lost {cause: 'full'}`; a held kind is never gained twice (clam rolls exclude held kinds); a hit removes Bubble Shield wherever it sits, else the newest, emitting `shield.popped` or `powerup.lost {cause: 'hit'}`; a hit with an empty stack stuns 50 ticks (`racer.stunned`); every hit gives 60 ticks of invulnerability during which further hits do nothing; a hit knocks the racer back 80 px/s away from the source; a power-up lost to a hit spawns a loose pickup at the racer that nobody can grab for 30 ticks and that drifts up and expires after 600 ticks.
- burst: needs a non-empty stack and burstCooldown 0, sets cooldown 150 and emits `burst.fired` with held kinds in stack order and the combo; Jet Fins dashes 24 ticks at 200 px/s along input (or facing); Bubble Shield fires a bubble at 150 px/s that lives 90 ticks and traps the first other racer it touches for 60 ticks (not invulnerable ones, not its owner); Puffer inflates 60 ticks (hitbox 20x20 centred, breaks coral it touches via `breakCoral`, hits other racers it touches, immune to urchins); Ink Sac drops a 32 px cloud 20 px behind the racer lasting 240 ticks that slows other racers inside it for 90 ticks (refreshed while inside); Glow Lantern flashes: other racers and jellies within 4 tiles are stunned 45 ticks (`racer.hit {cause: 'flash'}` for racers, honouring shields and invulnerability).
- combos (pair held, either order, extra kinds allowed): cannonball = Jet Fins + Puffer: the dash is inflated (breaks coral along the dash); inkTrail = Jet Fins + Ink Sac: an ink cloud every 8 ticks along the dash instead of one; seekerBubble = Bubble Shield + Glow Lantern: the bubble steers toward the nearest racer ahead within 8 tiles at up to 4 degrees per tick; inkBomb = Puffer + Ink Sac: the cloud is 48 px and centred on the racer; comet = Jet Fins + Glow Lantern: the flash fires at the dash start and again at its end. With three held, the reported combo is the first matching pair in the order listed here; all effects still apply.
- passives: Jet Fins raises cruise speed by 15% and shortens the kick cooldown to 22; Glow Lantern collects pearls within 3 tiles; Puffer doubles the bump push it gives; Bubble Shield has no passive beyond absorbing a hit.
- pickups: touching a clam opens it once (`clam.opened`), grants a roll and keeps it closed for 240 ticks; the roll uses the `pickups` stream and weights by place (1st: shield 3, lantern 3, ink 2, puffer 1, jet 1; 4th: jet 3, puffer 3, ink 2, shield 1, lantern 1; 2nd and 3rd interpolate), excluding held kinds; pearls collect once per race, add 1 to the racer's pearls and give 30 ticks of boost; loose pickups are grabbed by the first eligible racer to touch them.
- hazards: urchin tiles hit any non-inflated racer overlapping them; jellies bob vertically 2 tiles over a 180-tick cycle (sine of tick, deterministic), hit on contact, and do nothing while stunned; ink and bubbles never hit their owner.
- AI items (rival.ts): with `itemAggression` as the chance per eligible tick, a rival bursts when its held kinds have a use: a racer behind within 4 tiles (ink), a racer ahead within 6 tiles in its aim cone (bubble), racers within 4 tiles (lantern), coral on the smash path within 3 tiles (puffer: it switches to the `smash` field while holding puffer), or a straight path ahead of 5 tiles (jet). Draw count per tick stays fixed (add one draw for the item roll).
- world: an expert bot race still finishes; seeds still repeat exactly; a finished racer never gains, loses or bursts.

### Lane 3/a brief: power-ups and pickups

- Goal: the stacking rules, bursts, combos and passive effects, plus clams, pearls and loose pickups.
- Owns `logic/powerups/stack.ts` (gain, lose-on-full, pop-on-hit selection), `powerups/burst.ts` (firing and per-kind burst effects), `powerups/combos.ts` (combo detection and combo rule changes), `powerups/passives.ts` (modifier and passive contributions read by `modifiers.ts`), `pickups/clams.ts`, `pickups/pearls.ts`, `pickups/loose.ts`, `logic/modifiers.ts`, and their test files from the scaffold.
- Calls `breakCoral` (race/coral.ts) for puffer contact; never edits hazards/ (applying a hit goes through `hazards/hits.ts` `applyHit(world, racer, cause, by, from: Vec)` from lane b's contract in the scaffold).
- Behavior: the stack, burst, combos, passives and pickups bullets above, exactly.
- Done when: its scaffold tests pass (hit-dependent cases pass once 3/b lands, as in phase 1), typecheck, lint, check-lane.

### Lane 3/b brief: hazards, hits and rival item use

- Goal: everything that hurts, and rivals that use items.
- Owns `logic/hazards/hits.ts` (`applyHit`: shield, pop, loose spawn, stun, knockback, invulnerability), `hazards/jellies.ts`, `hazards/projectiles.ts` (bubbles and inks advance, collide, expire), `hazards/contacts.ts` (urchins, jellies, bubbles, inflated puffers, flashes against racers), `ai/rival.ts`, `ai/steer.ts`, `race/flowfield.ts`, `race/coral.ts`, and their test files.
- Behavior: the hazards and AI items bullets above, exactly; shared draws per tick documented in rival.ts.
- Done when: its scaffold tests pass, typecheck, lint, check-lane.

### Lane 3/c brief: power-up, pickup and hazard views

- Goal: show everything phase 3 adds, on placeholder art keyed through `art/keys.ts`, without touching `art/` (phase 4 owns it concurrently).
- Owns `view/pickup-view.ts` (clams open/closed, pearls, loose pickups glowing and drifting), `view/hazard-view.ts` (urchins, jellies bobbing and greyed while stunned, ink clouds fading by ttl, bubbles, trapped racers inside a bubble), `view/powerup-view.ts` (held-stack effects on racers: inflated sprite scale, dash streak, invulnerability flicker at most 3 flashes per second, shield ring), `view/hud.ts` (three stack slots bottom-left with icons, burst cooldown ring, combo name pop for 60 ticks on `burst.fired` with a combo, captions for off-screen threats), `scenes/race.ts` (create and sync the new views; consume drained events through the runtime's cursor), and the three scenarios named in the table.
- Scenarios: `clam-stack` (opening clams fills the stack and the HUD summary shows it), `cannonball-combo` (a seeded run where the player holds Jet Fins + Puffer, bursts and breaks the coral gate; the save fixture or a debug start gives the stack; if no clean start exists, report it and the scaffold adds a `?stack=` test param), `hit-pops-newest` (an urchin hit pops the newest power-up and spawns a loose pickup).
- Done when: gate passes, see captures of each scenario reviewed (`--at` before, at and after the key event, plus `--mobile` for the HUD), check-lane.

### Phase 4: pixel art and chiptune audio

Scaffold: ad8607f (on phase branch deliver/reef-rush-p4)
Tag: phase-4
Demo: `pnpm arcade see reef-rush --scene race --at 0,240` shows final sprites, animated tiles, parallax and light; dev build plays the title and race themes and SFX. Music is judged by ear: the phase tag message asks the user to listen.
Depends on: phase 2

Runs alongside phase 3.
Phase 4 scaffold (orchestrator, before dispatch): `art/pixel.ts` stub exporting `drawSprite`/`drawSheet` signatures (4/a implements, 4/d calls); `audio/notation.ts` stub exporting the final `Song`/`NoteEvent`/`Channel` types and `parseSong` (throws not implemented), so 4/b and 4/c share it; `AudioPort` gains `onRaceProgress(fraction: number)` and the runtime calls it each racing tick with the player's progress fraction; `EngineEvent` gains `audio.played { key; kind: 'sfx' | 'song' }`.

Its lanes own only files behind the seams phase 2 built (`art/index.ts`, `art/font.ts`, `view/backdrop.ts`, `audio/index.ts`), so it never touches phase 3's files. `art/keys.ts` declares phase 3's sprites in phase 2.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/engine/art/index.ts, games/reef-rush/src/engine/art/pixel.ts, games/reef-rush/src/engine/art/palettes.ts, games/reef-rush/src/engine/art/sprites/, games/reef-rush/src/engine/view/backdrop.ts, games/reef-rush/src/engine/art/placeholder.ts, games/reef-rush/src/engine/art/placeholder-sheets.ts | contracts | | opus | merged | deliver/reef-rush-4a | |
| b | M | games/reef-rush/src/engine/audio/index.ts, games/reef-rush/src/engine/audio/synth.ts, games/reef-rush/src/engine/audio/sequencer.ts, games/reef-rush/src/engine/audio/sfx.ts, games/reef-rush/src/engine/audio/adapter.ts, games/reef-rush/scenarios/audio-plays.ts | contracts | | opus | merged | deliver/reef-rush-4b | |
| c | M | games/reef-rush/src/engine/audio/songs/, games/reef-rush/src/engine/audio/notation.ts, games/reef-rush/src/engine/audio/notation.test.ts, games/reef-rush/src/engine/audio/notation/ | contracts | | opus | merged | deliver/reef-rush-4c | |
| d | M | games/reef-rush/src/engine/art/font.ts, games/reef-rush/src/engine/art/ui/, games/reef-rush/UI.md | contracts | | opus | merged | deliver/reef-rush-4d | |

### Phase 5: the full ocean course, difficulty tuning, UI redesign, juice and settings

Demo: full race on the finished course with music, effects and the settings menu; `pnpm --filter game-reef-rush exec vitest run src/logic/difficulty.test.ts`.
Depends on: phase 3, phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/logic/level/levels.ts, games/reef-rush/src/logic/ai/profiles.ts, games/reef-rush/src/logic/ai/rival.ts, games/reef-rush/scenarios/kit.ts, games/reef-rush/scenarios/dnf-results.ts, games/reef-rush/scenarios/race-to-finish.ts, games/reef-rush/scenarios/results-after-finish.ts, games/reef-rush/scenarios/results-ignores-early-kick.ts, games/reef-rush/tests/smoke.spec.ts | contracts | games/reef-rush/src/logic/difficulty.test.ts | opus | running | deliver/reef-rush-5a | |
| b | L | games/reef-rush/src/engine/view/hud.ts, games/reef-rush/src/engine/view/menu-view.ts, games/reef-rush/src/engine/view/race-text.ts, games/reef-rush/src/engine/scenes/title.ts, games/reef-rush/src/engine/scenes/results.ts | contracts, games/reef-rush/UI.md | | opus | running | deliver/reef-rush-5b | |
| c | M | games/reef-rush/src/engine/fx/, games/reef-rush/src/engine/view/racer-view.ts, games/reef-rush/src/engine/view/powerup-view.ts | contracts | | opus | running | deliver/reef-rush-5c | |

Scaffold: 87ddd94 (on the landing branch; phase 5 runs alone). Adds: title menu options Race, Sound, Motion with `Runtime.changeSettings` (applies at once, saves, emits `settings.changed {muted, reducedMotion}`, calls `audio.setMuted`) and the `settings-toggle` scenario; `engine/fx/index.ts` (`createFx(scene, world, reducedMotion): Fx` with `onEvents(events, tick)` and `sync(world)`, a no-op wired into race.ts); `engine/race-progress.ts` (`raceProgress`, `FINAL_STRETCH_AT = 0.75`, shared by the music lift and the HUD; `Runtime.raceFraction`); `WorldOptions.endsWhen: 'everyone'` so bot races time every racer; `logic/difficulty.test.ts` (read-only to lanes). Baseline on the 15 s first section: expert wins 3/10, novice passes.

### Lane 5/a brief: the full ocean course and difficulty

- Goal: finish "Sunlit Shallows" as an original ~90 s ocean course and tune the rivals so the difficulty test passes: neither too hard nor too easy.
- Course: extend `OCEAN_LEVEL` to the right. Keep every row of the first section (columns 0-94) byte-identical so the clam, urchin and cannonball scenarios still hold; remove that section's finish column and move the finish to the new end. Keep 20 rows. Build 3-4 more sections that each teach and then test one idea from what the game has: a current highway with a kelp detour, a jelly field that rewards timing, an urchin gauntlet with a shield-or-thread choice, a coral gate shortcut that Puffer or Cannonball opens beside a longer open route, and a final stretch with a current-down drop. Place clams so trailing racers meet them (catch-up by item), pearls along the better lines, and at least one real route split. Use `dark` ranges only if a section earns them (the lantern lights them). Read docs/repo-map.md and the parse.ts format doc first. Look at captures of every section (`pnpm arcade see reef-rush --scene race --input ... --at ...`) and at `--ascii` output.
- Tuning: `ai/profiles.ts` (rival force, kick skill, wobble, reaction, item aggression; BOT_PROFILES only if the bot definitions in the spec allow it) and `CATCH_UP` in `ai/rival.ts`. Change rival.ts only for tuning constants unless a real AI problem on the new course needs a fix; report any. Rivals must keep distinct personalities (Tess steady, Squib erratic, Bo heavy).
- Done when: `difficulty.test.ts` passes unchanged (expert wins >= 8/10 with the lead rival within 8 s; novice 3rd/4th in >= 7/10 and within 25 s of the winner in >= 8/10; expert mean 75-105 s); `TOP_ROUTE` in scenarios/kit.ts is re-recorded to the new finish and every scenario and smoke test using it passes (update `tests/smoke.spec.ts` only where it depends on the route); `dnf-results` waits long enough for the longer race; `pnpm arcade check` and `pnpm arcade smoke` pass; check-lane.

### Lane 5/b brief: the UI redesign

- Goal: rebuild the race HUD, title, results and menus from the phase 4 UI kit to `UI.md`, so the game's UI moves from the user's 4/10 to something that looks designed. `UI.md` is the spec: its rect tables, zones, palette roles, type scale and motion rules are requirements; if one is wrong, report it rather than silently deviating.
- Race HUD (`view/hud.ts`, keep `createHud(scene, reducedMotion)` with `onEvents` and `sync`): framed place panel with portrait and display numeral, framed timer, power-up well with the three stack slots and the burst ring (keep 3/c's behaviour: readiness, combo pop, captions), kick-ready indicator, track-style progress strip with 7x7 head markers and the finish flag, animated place changes (arrow and colour pop, up or down).
- Race text (`view/race-text.ts`): big countdown numerals, GO, FINAL STRETCH when `rt.raceFraction` crosses `FINAL_STRETCH_AT` (once per race), FINISH; outlined display face over water.
- Title (`scenes/title.ts`, `view/menu-view.ts`): logotype, racers swimming past, blinking PRESS A, best-time card, framed buttons with the animated cursor fin for Race, SOUND ON/OFF and MOTION FULL/REDUCED that update live on `settings.changed`.
- Results (`scenes/results.ts`): podium with portraits and medals, times revealed in sequence, NEW BEST ribbon, framed Race again / Title buttons.
- Every motion obeys reduced motion read live from `rt.settings.reducedMotion` where the screen stays up across a change (title). Debug summaries keep the semantic fields scenarios assert (scene, menu options and selection, best text); keep option strings unchanged ('Race', 'Sound', 'Motion', 'Race again', 'Title') since scenarios and smoke assert them.
- Done when: check and smoke pass, check-lane, and you have looked at desktop and `--mobile` captures of title, a race at countdown, mid-race and final stretch, and results (win and DNF), and confirmed nothing sits in a touch or back-link zone.

### Lane 5/c brief: juice and effects

- Goal: make the race feel good. Read `.claude/skills/game-feel` first.
- Owns `engine/fx/` (implement `createFx` behind the scaffold's seam; split into small modules), `view/racer-view.ts` and `view/powerup-view.ts`.
- Effects, from events and world state only: kick squash-and-stretch and a bubble puff; swim trail bubbles scaled by speed; coral breaking into debris; hit sparks and a short camera shake on the player's hits; pearl sparkle and a pickup pop on clams and loose grabs; ink and bubble pops; a cannonball impact shake; place-up flash on the player; finish bubbles burst. Replace 3/c's stand-ins with the real thing: the inflated Puffer is a scaled sprite (integer-friendly), invulnerability a sprite flicker at 3 Hz or less.
- Rules: render-only (never touch logic state or the tick); pool particles, no per-frame allocation; every effect has a reduced-motion form that keeps its information (no shake, no flashing, small or no motion); stays readable at 1x on phones.
- Done when: check and smoke pass, check-lane, and captures (`--at` around kicks, a hit, the cannonball and the finish, with and without reduced motion) show each effect.

### Phase 6: playable roster and signature abilities

Demo: pick any of eight racers on the select screen and race the other three; `pnpm --filter game-reef-rush exec vitest run src/logic/difficulty.test.ts` passes for every pick.
Depends on: phase 5

The user asked (2026-11-22) for a playable cast where each racer has its own ability. They first named Nintendo and Sega characters; those are ruled out by the originality rule, and the user approved this original cast instead, plus a shark. It replaces Pip, Tess, Squib and Bo. Racer slots stay `RACER_IDS` (`player` plus three rival slots); a character is data assigned to a slot, so tick order, rng salts and tie-breaks don't change. The game fills the three rival slots from the characters not picked, by seed.

| Character | Look | Ability |
| --- | --- | --- |
| Rudy | red snapper in a brass diving helmet, the plucky hero | Shake it off: stuns and bubble traps last half as long |
| Gil | lanky green seahorse, Rudy's cousin | Spring kick: kicks push harder upward |
| Streak | electric-blue sailfish, the cocky speedster | Wind-up: top speed rises the longer it swims without turning hard or being hit |
| Onyx | black barracuda with a scarred fin, the brooding rival | Ambush: bumping a racer from behind takes some of its speed |
| Nib | cleaner shrimp in goggles, the tinkerer | Deep pockets: holds 4 power-ups instead of 3 |
| Baron Barnacle | huge spider crab with a crusted crown, the bruiser | Bulldozer: breaks coral by ramming, barely moves in bumps, accelerates slowly |
| Selene | moon jellyfish with a starlight glow, the mystic | Moonlight: sees through dark zones, immune to jelly stings |
| Rook | hammerhead shark, the hunter | Frenzy: when a racer near it is hit or loses a power-up, it gets a short speed burst |

Abilities stay small next to power-ups. Difficulty bars from phase 5 must hold with the player as each character, and no character's expert-bot win rate may exceed any other's by more than 2 of 10 seeds.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/logic/characters.ts, games/reef-rush/src/logic/abilities.ts, games/reef-rush/src/logic/ai/profiles.ts | contracts | games/reef-rush/src/logic/abilities.test.ts | opus | pending | | |
| b | L | games/reef-rush/src/engine/art/sprites/racers.ts | contracts, games/reef-rush/UI.md | | opus | pending | | |
| c | M | games/reef-rush/src/engine/scenes/select.ts, games/reef-rush/scenarios/pick-character.ts | contracts, games/reef-rush/UI.md | games/reef-rush/scenarios/pick-character.ts | opus | pending | | |

Scaffold (written when phase 5 tags): `CharacterId` and `Character` in types.ts, `Racer.character`, `WorldOptions.character`, save version bump for the last pick, the select scene's place in the scene flow, and ability hook points in `world.ts`. Lane briefs are written with the scaffold.

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
  - Use `playerOf`/`activeRacers` from `logic/racers.ts` (not world.ts). Render a `coral.broken` event by removing that tile (phase 3 emits it).
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

### Lane 4/d brief: the UI kit

- Goal: the designed pixel UI system the spec's "UI design bar" describes, as reusable pieces with no game-state knowledge, plus the written spec the screens are built to. Phase 5 lane b builds the HUD and screens from it.
- Owns `art/font.ts` (keep the `createLabel` signature and `Label` interface; add `size: 'text' | 'display'` and `tone` options), `art/ui/` (`palette.ts` UI colours; `panel.ts` 9-slice pixel panels with highlight and shadow, `createPanel(scene, x, y, w, h, style)`; `icons.ts` kick, burst, five power-ups, medals 1-3, finish flag, arrow up/down, cursor fin; `portraits.ts` 16x16 heads for Pip, Tess, Squib, Bo; `logo.ts` the REEF RUSH logotype; `button.ts` framed menu button with selected state), and `games/reef-rush/UI.md`.
- Behavior: everything is drawn from palette-indexed text through lane 4/a's `art/pixel.ts` (coordinate: until 4/a lands, depend only on its exported `drawSprite`/`drawSheet` signatures, which the phase 4 scaffold stubs); the font is a hand-made 5x7 text face and an 8x12 or larger display face for numerals and splashes, both crisp at 1x on the pixel grid, rendered via BitmapText or glyph images; text keeps 4.5:1 contrast via panel backing or a designed 1 px shadow. `UI.md` fixes: the UI palette with roles, type scale, the 320x180 layout grid and margins, safe zones (back link top right, touch controls bottom-left and bottom-right on phones), HUD zones per element, motion rules (durations in ticks, reduced-motion fallbacks), and a sketch (ASCII or described) of the race HUD, title and results layouts that lane 5/b implements.
- Out of scope: wiring the HUD or screens (phase 5 lane b), world sprites (4/a).
- Done when: gate passes; a `?scene=uikit` debug scene is out of scope, so instead a see capture of the title and race shows the new font through `createLabel` with no layout regressions; `UI.md` exists and is under two screens; check-lane clean.

### Lane 4/a brief: pixel art, pixel font and backdrop

- Goal: replace every placeholder world texture with original pixel art authored as palette-indexed text, and replace the placeholder backdrop, behind the seams phase 2 built (`buildTextures`, `createBackdrop`). The UI kit (font, panels, icons, portraits) is lane 4/d's; export `drawSprite`/`drawSheet` from `art/pixel.ts` for it to use, so no scene or view file changes. Raise the bar on 8-bit: tight palettes, readable silhouettes, animation, depth.
- Interface:
  - `art/palettes.ts`: named palettes, each at most 4 colours plus transparent per sprite (NES-style constraint), chosen so player, rivals, hazards and pickups read first and the background recedes. Racers stay distinguishable by silhouette and palette in grayscale (Pip round brass helmet, Tess shell, Squib tentacles, Bo diving bell).
  - `art/pixel.ts`: `drawSprite(scene, key, rows: readonly string[], palette)` and `drawSheet(scene, key, frames, palette)`: turns text rows (one char per pixel, `.` transparent, digits index the palette) into a texture or spritesheet via Graphics + generateTexture. Throws a plain Error naming the key and row when a row is ragged or uses an index the palette lacks.
  - `art/sprites/*.ts`: one file per family (racers, terrain, pickups, hazards, powerups, hud), data only, every key in `art/keys.ts` covered with the frame counts keys.ts declares.
  - `art/index.ts`: `buildTextures(scene)` builds everything from sprites and registers animations once. `art/placeholder.ts` is deleted when nothing references it.
  - `view/backdrop.ts`: `createBackdrop` body: a depth gradient (lighter near the surface row, darker toward the floor), 3 parallax layers (far reef silhouettes, mid kelp forest, near drifting particles), god-ray light shafts from the surface that sway slowly, and a caustics shimmer band near the top. Advanced per runtime tick where it is deterministic, honouring `reducedMotion` (static rays, no parallax drift).
- Behavior: animated tiles (kelp sway 2 frames, current flow 2 frames per direction, jellyfish pulse) use registered animations; animation timing may use Phaser's clock (visual only). `?debug=1` unaffected. No asset files: everything is generated at boot, and boot stays under 200 ms of texture generation on desktop (measure once with performance marks in a see run, and remove the marks).
- Decisions already made: originality (no sprites resembling existing games' characters); 16 px tiles; racer bodies 12x10 with sprites up to 16x12 drawn around them; palette constraint per sprite; colour never carries meaning alone (game-feel skill section 5).
- Out of scope: particles and screen shake (phase 5), sound, any logic, view files other than backdrop.ts.
- Done when: gate passes; `pnpm arcade see reef-rush --scenario race-to-finish --at 0,200,600,end` and `--mobile` captures reviewed (you read frames.png): racers, hazards and pickups readable at 1x, HUD text crisp and legible, background clearly behind gameplay; a grayscale check of one capture still distinguishes the four racers; check-lane clean.

### Lane 4/b brief: chiptune synth, sequencer and SFX

- Goal: a small WebAudio chip synth behind `audio/index.ts` `createAudio`, playing songs written in the notation lane 4/c owns and short SFX for gameplay events, emitting `audio.played` so tests can hear it.
- Interface:
  - `audio/synth.ts`: four voices like classic hardware: two pulse channels with duty 12.5/25/50/75%, a triangle bass, and a noise channel (white noise buffer with short/long decay for kick, snare, hat). Per-note volume envelope (attack, decay, sustain level, release), optional vibrato and pitch slide. One master gain with mute. Pulse waves via `PeriodicWave` built once per duty.
  - `audio/sequencer.ts`: schedules a `Song` (type from `audio/notation.ts`) with lookahead scheduling on the AudioContext clock (the standard 25 ms timer, 100 ms schedule-ahead pattern), loops from the song's loop point seamlessly, supports `setTempoScale(1.0..1.15)` for the final-stretch lift without restarting, and stops/crossfades songs over 100 ms. Music timing uses the AudioContext clock (audio only; never gameplay).
  - `audio/sfx.ts`: one short sound per event: countdown beep (3/2/1 low, GO high), kick whoosh, bump thud, place gained / lost blips, finish fanfare sting, coral break crunch, clam open, power-up gain arpeggio, power-up lost, burst whoosh plus per-combo accent, hit, stun, pearl ping (pitch rises with consecutive pearls), menu move and confirm. Pitch varies ±5% with a cosmetic rng seeded from launch params.
  - `audio/adapter.ts`: maps drained events and scene changes to SFX and songs (title song on title, race song on race start, tempo lift when the player passes 75% progress, win jingle for 1st, lose jingle otherwise, results loop); emits `audio.played { key, kind: 'sfx' | 'song' }` once per SFX and once per song start or section change, never per note, and only when the context is running. Exposes nothing beyond `AudioPort`.
  - `audio/index.ts`: `createAudio(ctx, settings)` wires synth, sequencer, sfx, adapter; registers the AudioContext with `ctx.registerAudioContext`; reports node creation failures to `ctx.reportError`.
- Behavior: mute from settings is honoured immediately; reduced motion does not affect audio; a suspended context before the first gesture plays nothing and emits nothing; audio never blocks `idle()`. Under test mode, events still emit when the context is running (headless Chromium runs it), so a scenario can assert `audio.played` for the race song and the countdown beeps.
- Decisions already made: no audio files; `audio.played` volume bounded by the 1000-event log (per sound, not per note); EngineEvent union gains `audio.played` (adapter emits through the runtime's log passed in at creation).
- Out of scope: composing songs (lane 4/c; use a 4-bar test song until 4/c lands, and the integration of 4/c's songs is a merge, since 4/c owns `songs/` and `notation.ts`), settings UI.
- Done when: gate passes; a scenario `audio-plays` asserts the race song starts and countdown beeps emit `audio.played`; you listened to nothing (you can't), so describe in the report what the user should listen for; check-lane clean.

### Lane 4/c brief: the soundtrack

- Goal: write the game's music as data: catchy, original, hummable chiptune that a player remembers after one race. The user named classic console and handheld themes (the Mario and Pokemon Game Boy themes) as the bar for catchiness; match that quality without quoting or paraphrasing any existing melody, bass line or chord progression signature.
- Interface:
  - `audio/notation.ts`: the `Song` type and a parser from compact text to note events: per channel (pulse1, pulse2, triangle, noise) a line of tokens like `C5/8 E5/8 G5/4. r/8 [x2]`, with tempo, time signature, loop point, per-channel duty and envelope, slides and vibrato marks. `parseSong(source): Song` throws a plain Error naming the channel, bar and token on bad input. Pure TypeScript, no WebAudio; unit tested (`audio/notation.test.ts`): durations, dotted notes, rests, repeats, ties, bar-length validation (every bar of every channel sums to the time signature), loop point.
  - `audio/songs/race.ts`, `title.ts`, `win.ts`, `lose.ts`, `results.ts`: data only, each a source string plus metadata.
  - `audio/songs/songs.test.ts`: every song parses, bars balance across channels, the race song loops at a bar line, melodies stay in a singable range (lead within about an octave and a half), and each song's lead motif recurs (the hook is stated at least 3 times in the race song).
- Composition rules (these are the brief, not suggestions):
  - Race theme, about 130-150 BPM, major key with a bright, swimming feel; structure: 2-bar intro (drums and bass), A section 8 bars (the hook: a 1-2 bar motif, stated, answered, stated, resolved), A' 8 bars (hook varied: same rhythm, higher or altered ending), B section 8 bars contrasting in register and rhythm (longer notes, a different chord colour, e.g. move to the IV or relative minor), then a 4-bar turnaround back into A. Loop seamlessly from the turnaround to A.
  - Counter-melody on pulse 2 (harmony in thirds/sixths or a rhythmic arpeggio), never fighting the lead; triangle bass with movement (walking or octave bounce), noise drums with a clear backbeat and fills at section ends.
  - Hook test: the lead of A's first 2 bars is singable on its own, uses mostly stepwise motion with one memorable leap, and has a distinctive rhythm (syncopation or a repeated rhythmic cell).
  - Title theme: same hook, slower and lighter (so the race theme feels like a payoff); win jingle 2-3 s ending on the tonic with a flourish; lose jingle 2-3 s, wistful but not sad; results loop gentle and short.
  - Originality: do not reproduce any existing tune. If a phrase reminds you of a known theme, change it.
- Out of scope: synthesis and playback (lane 4/b), SFX.
- Done when: notation and song tests pass; typecheck and lint pass; the report includes, for the race theme, the hook written out in note names and a one-line description of each section, so the user can judge it before hearing it; check-lane clean.

## Log

- 2026-11-22: `arcade new` writes `.claude/launch.json` in a shape Biome rejects (`tools/arcade/src/new-game.ts:78`, `JSON.stringify` expands arrays), so `check` fails on a freshly created game. Formatted with `pnpm fix` here; the tool fix is a separate change.
- 2026-11-22: main gained 1e3b073 (docs/repo-map.md) after the landing branch was cut; merged main into deliver/reef-rush as 1febb4d. Phase 1 lanes branch from 1febb4d and use it as their check-lane and lane-review base. The first dispatch used agent worktree isolation, which cut both lanes from main and deleted their worktrees when they stopped to ask; both were redispatched into orchestrator-made worktrees with no work lost.
- 2026-11-22: Lane 4/c (b4f7293): race theme G major 144 BPM, intro/A/A'/B/turnaround, hook B4 A4 B4 D5 C5 B4 | F#5 E5 D5 B4 stated 4x per loop. Accepted choices: [..]xN repeats, quarter-note beat, silent unwritten channels, slideTo relative, one duty per channel per song (types fix it). notation.ts was 462 lines, so audio/notation/ was added to the lane for a split before review.
- 2026-11-22: Lane 4/b (906bfcd) review: 3 findings sent back: the gate tap resumes audio before the context exists (Safari keyboard players get no sound; in-lane one-shot resume listener, proper fix belongs in packages/shell and goes in the final report as follow-up), overdue cues clump after main-thread stalls (re-anchor), finished jingles leak their gain bus. Accepted choices: audio.played emitted while muted; section-change audio.played events stamped on wall-clock ticks (cosmetic; scenarios filter keys containing ':'); x1.1 final-stretch tempo; slideTo = semitones relative to the note (sent to 4/c). Landing follow-up: Phaser's own unused AudioContext (disable Phaser audio in game.ts).
- 2026-11-22: Phase 4 scaffold ad8607f on phase branch deliver/reef-rush-p4 (worktree ../games-reef-rush-p4). The plan lives on the landing branch; when a phase branch merges back, resolve plans/reef-rush.md to the landing copy.
- 2026-11-22: Lane 2/a fixes (048adae) merged; gate green (16 smoke tests). Accepted: MENU_ARM_TICKS = 20 shifted smoke and race-again timings; a failed save doesn't bump races, so that rematch reuses the seed. Tagged phase-2.
- 2026-11-22: Lane 2/a (b55fdc7) review (game-reviewer): 5 findings accepted and sent back: switching to the running scene leaves it blank and freezes real-time logic (clock moves to one Phaser STEP listener), off-tick save writes not covered by idle(), menus confirming on their first tick, stale world in the title summary, missing doc blocks. Accepted lane choices: tick-driven RacerView.sync, extra engine modules (menu, debug, layers, race-text, menu-view, debug-overlay, placeholder-sheets), Runtime.listen, isNewBest excludes ties, LevelView.placeholders, Backdrop.update seam. Changed decision: Race again seeds with params.seed + save.races instead of replaying the same race. The phone capture missing the A button is a see artifact (canvas-only screenshot), not a bug.
- 2026-11-22: User rated the phase 2 placeholder UI 4/10. Added the UI design bar to the spec, a UI kit lane 4/d (font moves from 4/a), and split phase 5 so lane b redesigns the HUD, title, results and menus from the kit while lane c does fx. Phase 2 merges as the functional base.
- 2026-11-22: Phase 1 boundary review: 5 findings, all accepted and fixed in 1b1595a: progress now bilinear (no 0.5-tile steps at turns, so the open item below is resolved), breakCoral contract with coral.broken event and read-only World.broken, finished racers out of play via logic/racers.ts (activeRacers, single playerOf), seed mixed before salting (streams aliased across seeds), committed .vitest artifact removed, steering split to ai/steer.ts (flowfield.ts 201 lines, resolving the size item below). Accepted fixer choices: breakCoral replaces the Set rather than mutating it; activeRacers orders by RACER_IDS; racers.test.ts added.
- 2026-11-22: Lane 1/b fixes (5453629) merged. Open: flowfield.ts is 266 lines (field building and field lookups in one file; splitting needs test import changes); progressAt still steps 0.5 tiles where the route turns, inherent to the briefed interpolation, which can swap places of racers within half a tile. Both left for the phase 1 boundary review.
- 2026-11-22: Lane 1/b review: 3 findings, all accepted and sent back: kicks aligned against move instead of aim (sideways kicks during stuck recovery), the clear-line check tests only the centre line so 12x10 bodies clip rock corners, and progressAt interpolates toward corner-blocked diagonals (non-monotonic progress, place flicker). Scaffold fixture bug in rival.test.ts (ragged rows) fixed on the landing branch in d533e48.
- 2026-11-22: Lane 1/a fixes (7fa13b3) merged: the wall fix uses a push-out pass at the start of moveBody instead of leading-edge resolution (the lane showed leading-edge still snapped on the next row of a full-height wall); MAX_SUBSTEPS = 64; regression tests added to collide.test.ts and physics.test.ts with explicit permission (check-lane flags them as outside Owns; accepted).
- 2026-11-22: Lane 1/a review: 3 findings, all accepted and sent back: racers bumped into a wall stuck to it (resolve only tiles the leading edge newly enters), drag reversing velocity and unbounded sub-steps at large dt (clamp both), MAX_STEP comment gave the wrong reason. The lane may add regression tests to collide.test.ts and physics.test.ts.
- 2026-11-22: Lane 1/b (e8ad20d) accepted choices: diagonal current entry judged by the sign of its along-current component; costs charged on the entered tile; a diagonal is blocked when either orthogonal tile is unenterable for that field; steerDirection walks the lookahead path only while the straight line stays clear; progressAt projects in [-0.5, 0.5] and is Infinity on unreachable tiles; rivalsDoneAt set in recordFinishes; standings act only while racing; three rng draws per rival tick (wobble, kick, recovery side), wobble step 0.15 x profile.wobble; no kick at zero speed. flowfield.ts was 290 lines with a heap inside, so race/priority-queue.ts was added to the lane.
- 2026-11-22: Lane 1/a (b3e3195) accepted choices: racers sink only with no input at all (a test needs exact forceMul scaling, and holding sideways shouldn't drag a racer to the floor); touching racers keep an existing contact and only a real gap clears it; coincident centres push the later racer forward; sub-steps at most 8 px sized by speed; dark-zone LevelErrors carry null row/col; an empty level fails as a missing start; edge-only contact doesn't cover a tile.
- 2026-11-22: The `arcade new` launch.json fix landed separately on branch fix/arcade-new-launch-format (069a0e3).
- 2026-11-22: Scaffold test writer flagged contract gaps; settled: createWorld computes initial progress, catch-up is 1 for non-finite progress, cruise is force/drag less one tick of drag, held kicks repeat every cooldown+1 ticks, LevelError row/col null for whole-level errors, bump velocity exchange only when closing and mass-weighted. Steer cost for entering a current diagonally is left to lane b and not tested.
- 2026-11-22: Plan critique (devils-advocate, opus) raised 8 findings; all applied: integration files owned inline in the scaffold, DNF/limit race end, engine split moved to its own single-lane phase, seams for art/audio so phase 4 runs beside phase 3, explicit tick order + forked rngs + progress-field placing with tie-breaks, save v2 with migration instead of editing v1, three flow fields with rebuild on coral break (phase 3 lane b owns flowfield.ts), audio.played per sound and no console in the difficulty test.
- 2026-11-22: Lane 4/c (1e4106e) review (code-reviewer): 6 findings accepted and fixed in 7513690: empty sections allowed a zero-length loop, the B counter-melody sat above the lead, section-relative bar counts and bracket bar numbers in errors, tie-into-rest message, type-only import cycle (types moved to notation/types.ts). Race theme checked against the brief and judged original. Merged into p4; songFor now returns the composed songs (fd604cd).
- 2026-11-22: Lane 4/a (d50e33a) review (game-reviewer): accepted racer and urchin contrast (>= 3:1 test against water bands), drawFrames throws on an existing key (skip guard moves to buildTextures), backdrop redraw guards and ray culling, band dither, pearl and Squib shapes. Orchestrator wires reducedMotion into createBackdrop in race.ts at merge. Placeholder art files added to 4/a's Owns.
- 2026-11-22: Phase 3 scaffold 1c2098b. Decisions: bursting keeps the stack (the 150-tick cooldown limits reuse; revisit in phase 5 tuning if combos dominate); flash and bubble hits stun or trap without popping a power-up (a shield still absorbs them); the fixed fourth rival draw is lane 3/b's, which re-records dnf-results standings. 79 new tests fail not-implemented, 10 on assertions (do-nothing stubs for systems that run every tick on OCEAN_LEVEL), 14 pass against stubs (near-miss cases and scaffold-implemented world behaviour).
- 2026-11-22: Lane 4/a fixed review findings in c236a3a (water bands darkened so racers reach 3:1 against every band; far reef now stands on the floor rows); merged into p4. Orchestrator wired reducedMotion into createBackdrop and set Phaser audio to noAudio (713250b). Lane 4/d dispatched without a separate mockup step: its UI.md sketch is the review point.
- 2026-11-22: Lane 3/c f2aeef5 done. cannonball-combo has no stack start: ScenarioStart carries only save/scene/seed, and a ?stack= param would change packages/shell and packages/testing (own PR, rejected for this run). The orchestrator picks a seed after 3/a and 3/b land so the player earns Jet Fins + Puffer from clams. Inflated sprite scale and sprite flicker move to phase 5 lane c (fx, owns racer-view.ts); 3/c draws a halo and glow pulse. DESIGN.md phase 3 notes are the orchestrator's at phase landing.
- 2026-11-22: Determinism rule added: logic never calls Math.sin, cos, tan, atan2, hypot, exp, pow or log, because ECMA-262 lets engines approximate them and smoke runs Chromium and WebKit with exact seeded outcomes. Use logic/num.ts (length, sin, cos; built from + - * / sqrt round) and vector math instead of atan2. Follow-up outside this run: extend tools/biome/no-nondeterminism.grit to ban them in every game's logic (a shared-tooling change, own PR).
- 2026-11-22: Lane 3/a (8eb1223) review: accepted all 8 fixes (combos fixed at firing via dashCombos, hits end dashes, exact distance math, missing choice tests, reuse query helpers, LAST_PLACE from RACER_IDS, no side effects in filter, one combo source); lane choices accepted except reading combos live mid-dash. Puffer "doubles the push" vs bumpMass x2 (2/3 not 1/2 of the overlap) and the 23-tick dash are tuning for phase 5. Lane 3/c (f2aeef5) review: accepted all 10 (burst ring readiness, event effects stamped by world tick, scenario robustness with pinned seeds, bubble scale per sync, 4-way off-screen caption, allocation, reduced motion on bob/glow/wobble, slot panel alpha, setTexture caching).
- 2026-11-22: Lane 3/b (0909f99) review: accepted all 11 (puffer holders use the smash field only when inflated or burst-ready, no burst during stuck recovery, dnf-results stops pinning rival order, guard order in applyHit, hits end dashes, flashed jellies harmless for the full 45 ticks, exact math incl. vector seeker steering, seeker and contact-order tests, inSolid naming, no stuck recovery while stunned). Lane choices accepted; the ±30° bubble cone is revisited in phase 5 tuning if bubbles are wasted.
- 2026-11-22: Phase 3 integration 47c828d: TOP_ROUTE re-recorded past the urchin at (32,4); hit-pops-newest pinned to seed 1 (Jet Fins roll, hit at tick 588, input stops 2 ticks later so the knockback leaves the pickup ungrabbed); cannonball-combo earns its stack on seed 12 by opening the first clam twice (Jet Fins, then Puffer after the 240-tick close) and smashes all 10 gate tiles. Gate: 260 tests, 19 smoke. Tagged phase-3.
- 2026-11-22: Lane 4/d (9a6cfba) review (game-reviewer): accepted all 14. Notable: UI.md safe zones were estimated from the Pixel 7 capture, whose letterbox hides the touch overlay; re-derived from packages/input and packages/shell at scale 2 with no letterbox. Off-panel text fails contrast on water, so only foam and sun are allowed off panels and splashes get an outline. The text face resembled the HD44780 LCD ROM and is redrawn for originality. Baked ink shadow sheet for Canvas. Orchestrator wires buildUiTextures into BootScene and points DESIGN.md at UI.md at merge.
- 2026-11-22: Phase 4 landed: lanes a-d merged into p4 (UI textures built at boot, 756566d), p4 merged into landing with the plan resolved to the landing copy. Gate on landing: 416 tests, lint, 20 smoke. Cannonball scenario checked on the new art. Canvas fallback draws tones white (accepted: meaning never rides on colour alone; smoke asserts WebGL). Tagged phase-4.
- 2026-11-22: User asked for a playable roster with per-character abilities, naming Nintendo and Sega characters; declined under the originality rule and proposed an original cast, which the user approved with a shark added (Rook). Recorded as phase 6, after phase 5.
- 2026-11-22: Lane 5/b (af3d898) done: HUD, splashes, title, results and menus rebuilt to UI.md; check-lane ok, 21 smoke. Review dispatched (game-reviewer).
