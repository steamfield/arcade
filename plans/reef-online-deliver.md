# Plan: Reef Rush online, RFC phase 1 (determinism guard and human slots)

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-23. Timebox: none. Landing branch: deliver/reef-online (worktree `/Users/riley/Projects/games/.claude/worktrees/reef-online`).
Gate: `pnpm arcade check reef-rush && pnpm arcade smoke reef-rush && pnpm --filter game-reef-rush test:difficulty` (about 2 min). Filtered tests: `pnpm arcade test reef-rush <paths or @groups>`. Typecheck and lint: `pnpm arcade check reef-rush --skip-tests`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --offline`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, todo: true
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Product and design spec: `plans/reef-rush-multiplayer.md` (the RFC), sections 5.1 and 5.2 and its phase 1. This run builds only that phase: what the game's logic needs before any networking exists. It has no player-visible change. After it, the simulation has a hash that proves two engines computed the same race, the logic no longer assumes exactly one human, a racer whose input stops is handed to the AI on that tick, and the engine can show the race from any slot.

All paths below are under `games/reef-rush/` unless they start with `tools/`, `docs/`, `plans/` or `biome.json`.

In scope:

- `hashWorld(world)`: one 32-bit hash of everything in a world that can differ between two runs.
- That hash pinned for the top route in Node, and asserted in smoke on every browser project, so Chromium and WebKit are compared for the first time.
- `**` removed from non-test logic, and a lint rule that bans it and the inexact `Math` functions in this game's logic.
- `world.humans`, `stepRace(world, inputs, dt)`, takeover of a human slot by the AI, and the rules that read "the player" generalised to "a human".
- An engine-side local racer (which slot this screen follows), with a debug-only `?local=<slot>` launch parameter to exercise it.

Out of scope: anything in `src/net/`, `apps/api`, WebSockets, new scenes, the RFC's phases 2 to 4. More than four racers (owner, 2026-11-23: "start with 4, dont build the 10"). Easy level with more than one human. Changes under `packages/`. Save shape changes. Retuning any difficulty number.

Assumptions (defaulted, the owner can override):

- A human's own catch-up boost (`playerCatchUpMul`) keeps measuring against every other racer, humans included. RFC question 5 is open; this is today's rule applied unchanged.
- AI rivals measure catch-up against `catchUpTarget`: the leading unfinished human slot (ties by `RACER_IDS` order), and when every human slot has finished, the human with the best finish place. With one human that is always that human, finished or not, which is today's rule in `endsWhen: 'everyone'` bot races.
- A racer the AI takes over keeps the human rules as a target and for its own body (status length, invulnerability, clam rolls, its own catch-up, protection from rival attacks) and becomes a rival as an actor: it gets the stuck backstop, its character's rival profile (`{ id, ...CHARACTERS[character].profile }`, RFC 5.2) from the takeover tick, level item aggression, and it may attack humans only where the level lets rivals do so (`mayAttack` and `undertowSparesPlayer` treat it as a rival attacker).
- A human in any slot swims with `{ ...PLAYER_PROFILE, id }`, never that slot's character rival profile, so humans are equal whatever slot they hold.
- The banned-math lint rule applies to `games/reef-rush/src/logic/**` only, in its own plugin file, not to every game and template. `templates/three-3d/src/logic/world.ts` uses `Math.hypot` and is not a lockstep game.
- `player.place` gains a required `id` field and is emitted for every human whose place changed. With one human, consumers that ignore the field are unaffected; phase 3 makes the engine's consumers (`audio/adapter.ts`, `fx/event-effects.ts`, `view/racer-moments.ts`) react only to the local racer's.
- The lint rule lands on this branch, not in its own PR: it is scoped to this game's logic and touches nothing under `packages/`.

Error model: logic stays total over valid state and throws only for programmer errors, as today.

- `createWorld` throws `Error` naming the bad value when `humans` is empty, repeats a slot, or names a slot not in `RACER_IDS`; when `characters` names a slot not in `RACER_IDS` or gives two slots the same character; when both `character` and `characters.player` are given and differ; and when `difficulty` is `'easy'` with `humans` other than exactly `['player']` (the Easy guide is single-player).
- `stepRace` ignores an entry in `inputs` for a racer the AI drives (that is how `playerBot` works today) and for a finished racer. A missing entry for a human-driven racer is the takeover signal, never an error.
- `hashWorld` never throws for a world built by `createWorld`. It throws `TypeError` naming the path if it meets a value it has no rule for (a function, a symbol, a `Map`), so a new kind of state cannot be silently left out of the hash.
- A `?local=` race is a debug race: it is never saved (treated like a staged race), and when the save's level is Easy it runs on Normal with one logged warning, because Easy is single-player in slot 1.
- The engine's `?local=` is ignored without `?debug=1` or the test harness, and an unknown slot logs one warning naming it and falls back to `player`, like `?course=`.

## Contracts (scaffold commit)

Each phase's scaffold adds that phase's declarations and failing tests. New and changed modules, with their single responsibilities:

    src/logic/
      hash.ts                  hashWorld: a 32-bit hash of a world's mutable state; reads only (phase 1, new)
      types.ts                 World.humans; Racer.tookOverAt (phase 2, declarations in the scaffold)
      events.ts                player.place gains `id` (phase 2 scaffold, which also adds `id: 'player'` to the emit in race/standings.ts and the events in engine/view/racer-moments.test.ts so the scaffold typechecks; lane a then owns both files)
      hash.ts                  `humans` joins the skip list in the phase 2 scaffold: fixed for the race, so the pinned hash does not move
      racers.ts                isHuman, isRival, activeHumans: who counts as human for rules and who the AI drives (phase 2, implemented in the scaffold)
      world.ts                 WorldOptions.humans/characters, stepRace, takeover; still only orders the tick (phase 2)
      race/standings.ts        race end, the grace timer and place events for several humans (phase 2)
      race/catch-up.ts         catchUpTarget: the racer AI rivals measure catch-up against (phase 2, new)
      difficulty-level.ts, modifiers.ts, pickups/clams.ts, ai/rival.ts, ai/items.ts
                               the per-racer rules, reading isHuman or isRival in place of `id === 'player'` (phase 2)
    src/engine/
      debug.ts                 debugState().worldHash (phase 1)
      runtime.ts               runtime.localRacer: which slot this screen follows (phase 3; a field, as in the RFC, so audio and effects that see only events can read it)
    tools/biome/
      no-inexact-math.grit     bans `**`, Math.pow, sin, cos, tan, atan2, hypot, exp, log in a lockstep game's logic (phase 1, new)

Signatures:

```ts
// logic/hash.ts
/** A 32-bit unsigned hash of every part of `world` that a race can change. */
export function hashWorld(world: World): number;

// logic/types.ts (WorldOptions is in logic/world.ts)
interface World { /** Slots a person started the race in, in RACER_IDS order. Fixed for the race. */ humans: readonly RacerId[] }
interface Racer { /** World tick on which the AI took this racer over from its player. Absent until then. */ tookOverAt?: number }
interface WorldOptions { humans?: readonly RacerId[]; characters?: Partial<Record<RacerId, CharacterId>> }

// logic/racers.ts
/** Whether a person started the race in this slot. Never changes during a race. */
export function isHuman(world: World, id: RacerId): boolean;
/** Whether the game treats this racer as an AI opponent: not a human slot, or a human slot the AI took over. A test bot driving a human slot is not a rival. */
export function isRival(world: World, racer: Racer): boolean;
/** Humans still driven by their own input: not taken over. In RACER_IDS order. */
export function activeHumans(world: World): Racer[];

// logic/world.ts
export function stepRace(world: World, inputs: Partial<Record<RacerId, TickInput>>, dt: number): void;
export function stepWorld(world: World, input: TickInput, dt: number): void; // unchanged signature; calls stepRace with { player: input }

// logic/race/catch-up.ts
export function catchUpTarget(world: World): Racer;

// logic/events.ts
| { type: 'player.place'; id: RacerId; place: number }

// engine/runtime.ts
/** The slot this screen follows. 'player' except in a `?local=` debug race. */
readonly localRacer: RacerId;
```

The invariant every phase is held to: a world created without `humans` or `characters` behaves bit-for-bit as it does at the start of this run. The pinned top-route hash from phase 1 is the check (`world.humans` is left out of the hash for this reason), along with `top-route.test.ts`, `sanity/bars.test.ts` and the difficulty project, none of which may be edited to pass.

## Phases

### Phase 1: a hash that proves two engines ran the same race (MVP)

Demo: `pnpm arcade test reef-rush src/logic/hash.test.ts src/logic/top-route.test.ts`, then `pnpm arcade smoke reef-rush`, whose "finished race" test asserts one committed hash on desktop Chromium, the phone project and WebKit.

Test cases (`src/logic/hash.test.ts`, written in the scaffold):

- Two worlds from the same course, seed and inputs have equal hashes after 0, 1 and 400 ticks.
- The hash is an integer from 0 to 2^32 - 1.
- It changes when one tick's input differs (one world holds right for a tick, the other idles).
- It is equal for two Sets holding the same elements added in a different order, and for an object with a key set to `undefined` and one without the key.
- It changes for each of these single edits to an otherwise equal world: a racer's `body.x` by 1e-9; a racer's `status.stunned`; a held item's charges; a racer's `kickCharges`; one draw taken from `rngs.pickups`; a clam's `closedFor`; an index added to `pearlsTaken`; a tile index added to `broken`; a loose pearl appended; `race.raceTick`; `tick`; a rival's `ai.sinceBest`.
- `+0` and `-0` in a velocity hash differently (bit patterns, not values).
- It does not change when an event is emitted to the sink, or when `recentEvents` differs.
- Worlds on different seeds hash differently at tick 0 (the roster draw and rng states differ).
- A world holding a function where state belongs throws `TypeError` naming the path.

Inline at landing (the orchestrator, after both lanes merge): record the top-route hash on lane a's branch alone and again after lane b merges, and confirm they are equal, so the `**` replacement is shown not to move the simulation; add the pin to `src/logic/top-route.test.ts`; add the smoke assertion to `tests/smoke.spec.ts` with its own constant, read on the results screen, because the two replays are different races (Node feeds diagonals as (1,1) and stops at the finish; the browser feeds `Math.SQRT1_2` and steps on through the results delay). The smoke constant is what compares Chromium, the phone project and WebKit; update `DESIGN.md` ("Rules worth knowing") and the RFC status line.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/hash.ts, games/reef-rush/src/engine/debug.ts | contracts, games/reef-rush/src/logic/types.ts, games/reef-rush/src/logic/media/types.ts | games/reef-rush/src/logic/hash.test.ts | sonnet | pending | | hash tests pass |
| b | S | games/reef-rush/src/logic/abilities.ts, games/reef-rush/src/logic/hazards/squid-target.ts, games/reef-rush/src/logic/hazards/squids.ts, games/reef-rush/src/logic/hazards/enemies/test-arena.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/pickups/pearls.ts, tools/biome/no-inexact-math.grit, biome.json, docs/repo-map.md | contracts, tools/biome/no-nondeterminism.grit | | sonnet | pending | | lint bans the operators and passes on the tree |

#### Lane a brief

- Goal: implement `hashWorld` in `src/logic/hash.ts` and expose it as `worldHash` on the engine's `debugState()` while a race exists.
- Interface: `export function hashWorld(world: World): number` as in the contracts. In `src/engine/debug.ts`, `debugState` gains `worldHash: hashWorld(world)` when `rt.world` is set, and omits the key otherwise. `debugSummary` does not change.
- Behavior:
  - 32-bit FNV-1a (offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul`, result `>>> 0`), fed bytes.
  - A generic walk over the world, so state added later is hashed without anyone remembering to list it. Rules by value kind: number, the 8 bytes of its IEEE 754 double through a `Float64Array`/`Uint8Array` view, so `+0` and `-0` hash differently, with every NaN written as one fixed bit pattern (engines may canonicalise NaN payloads); boolean, one byte; string, its UTF-16 code units; `null` and `undefined`, distinct one-byte tags; array, its length then each element in order; `Set`, its size then each element in sorted order (elements must all be numbers or all be strings, else `TypeError`), so two worlds with the same content hash equal however they got there; plain object, its own enumerable keys sorted by code unit, skipping keys whose value is `undefined`, each key's code units then its value. Every kind writes a distinct tag byte before its content so `[1]` and `{0: 1}` and `"1"` cannot collide by construction.
  - Top-level keys of `World` left out, by name, in one exported-nowhere constant with a comment on each saying why: `level`, `progress`, `nav` (static for a race or derived from `broken`, which is hashed), `events` (a sink), `recentEvents` (a per-tick buffer the engine does not see consistently). That is the whole skip list; `course`, `medium` and `difficulty` are hashed.
  - `rngs` is hashed as each stream's `state()` in sorted stream-name order, not by walking the rng objects (they are closures).
  - Anything else (a function, symbol, bigint, `Map`, class instance that is not a plain object, array or `Set`) throws `TypeError` whose message gives the dotted path, for example `hashWorld: no rule for a function at racers.0.ai.pilot.replan`.
  - `racer.ai.pilot` is medium-owned memory; walk it like any object. If the swim pilot holds a value the rules reject, report it instead of special-casing it.
  - Reads only. It must not draw from an rng or write any field.
- Decisions already made: one generic walker, no per-field list. No caching. No options. The hash is 32 bits because it travels in a 4-byte message field (RFC 5.4).
- Out of scope: a hex or string form, hashing the level, an incremental hash, any change to `summarize` or `debugSummary`, any use of the hash by tests other than the ones given.
- Done when: `pnpm arcade test reef-rush src/logic/hash.test.ts` passes, `pnpm arcade check reef-rush --skip-tests` passes, and the file stays under about 150 lines.

#### Lane b brief

- Goal: remove `**` from this game's non-test logic and add a lint rule so it and the inexact `Math` functions cannot come back.
- Interface: a new Biome GritQL plugin `tools/biome/no-inexact-math.grit`, registered in `biome.json` in a new override whose `includes` is `games/reef-rush/src/logic/**` with test files (`**/*.test.ts`) excluded. It reports an error for the `**` operator, the `**=` operator, and calls to `Math.pow`, `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan2`, `Math.hypot`, `Math.exp`, `Math.log`. Message for `**` and `Math.pow`: "Exponentiation may round differently between JavaScript engines, and a lockstep race must match bit for bit. Multiply instead." Message for the rest: "This Math function may round differently between JavaScript engines. Use src/logic/num.ts." Model the file on `tools/biome/no-nondeterminism.grit`.
- Behavior:
  - Replace each `x ** 2` with a multiplication of the same operand, binding the operand to a `const` first when it is not a plain identifier, so nothing is evaluated twice. Sites: `abilities.ts:195`, `hazards/squid-target.ts:13,48,59`, `hazards/squids.ts:115,205`, `ai/items.ts:182`, `pickups/pearls.ts:45`, `hazards/enemies/test-arena.ts:53`. Change nothing else in those files.
  - `src/logic/num.ts` implements sin and cos itself and must pass the rule unchanged; if it does not, report it instead of editing it.
  - Check the rule the way `AGENTS.md` asks for tests: add a temporary line using `2 ** 3` and one using `Math.hypot(1, 2)` to a logic file, run `pnpm arcade check reef-rush --skip-tests`, see both errors with the messages above. Add `Math.random()` too and see the existing `no-nondeterminism` error still fire, which shows the new override adds a plugin for these paths instead of replacing the existing one. Remove the lines. Say in the report that you saw them fail.
  - If Biome 2.6's GritQL cannot match the `**` operator, do not approximate with a regex: report it and stop.
  - `docs/repo-map.md`: add the new file's row next to `no-nondeterminism.grit`, and mention it in the "Change a lint rule" row. The repo-map test only checks that paths the map names exist, so nothing fails if you forget the row.
- Decisions already made: the rule is for this game only, not `games/**` or templates, because only a lockstep game needs engines to agree bit for bit and `templates/three-3d` uses `Math.hypot` in logic. Test files are exempt, since they compare against `Math.sin` on purpose.
- Out of scope: `src/net/` (it does not exist yet), other games and templates, `tools/biome/no-nondeterminism.grit`, any behaviour change in the files you touch, any edit to a test.
- Done when: `pnpm arcade check reef-rush --skip-tests` passes, and `pnpm arcade test reef-rush src/logic/hazards src/logic/abilities.test.ts src/logic/pickups src/logic/ai` passes unchanged.

### Phase 2: races with more than one human, and AI takeover

Demo: `pnpm arcade test reef-rush src/logic/humans.test.ts src/logic/human-rules.test.ts`: two scripted humans race the default course and a slot whose input stops is finished by the AI.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/world.ts, games/reef-rush/src/logic/race/standings.ts, games/reef-rush/src/logic/characters.ts, games/reef-rush/src/engine/view/racer-moments.test.ts | contracts, games/reef-rush/src/logic/racers.ts, games/reef-rush/src/logic/ai/rival.ts | games/reef-rush/src/logic/humans.test.ts | opus | pending | | humans tests pass, top-route hash unmoved |
| b | M | games/reef-rush/src/logic/difficulty-level.ts, games/reef-rush/src/logic/modifiers.ts, games/reef-rush/src/logic/pickups/clams.ts, games/reef-rush/src/logic/ai/rival.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/race/catch-up.ts | contracts, games/reef-rush/src/logic/racers.ts | games/reef-rush/src/logic/human-rules.test.ts | opus | pending | | rule tests pass, top-route hash unmoved |

(Test cases and briefs written during phase 1. The scaffold declares the types, implements `isHuman`, `isRival` and `activeHumans` in `racers.ts`, makes `createWorld` store `humans`, and stubs `stepRace` and `catchUpTarget`.)

### Phase 3: the screen follows any slot

Demo: `pnpm arcade see reef-rush --query "debug=1&local=tess" --input "_*200 right*120"`: the camera, HUD and sounds follow slot 2, which the keyboard drives, while the AI swims slot 1.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/engine/, games/reef-rush/tests/local-racer.spec.ts, games/reef-rush/DESIGN.md | contracts, games/reef-rush/src/logic/racers.ts | games/reef-rush/src/engine/local-racer.test.ts | opus | pending | | local racer tests pass |

(Test cases and brief written during phase 2.)

## Log

- 2026-11-23: plan critiqued (devils-advocate, opus). Applied: `humans` left out of the hash; separate Node and smoke hash constants; `catchUpTarget` fallback and takeover rules written into assumptions; phase 2 scaffold edits named; `runtime.localRacer` in place of a WeakMap; `?local` races unsaved and never Easy; Set elements sorted and `undefined` keys skipped in the hash; lanes 2/b and 3/a moved to opus.
