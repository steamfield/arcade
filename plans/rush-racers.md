# Plan: Rush Racers, worlds and the Thornwood land world

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-23. Timebox: none. Landing branch: deliver/rush-racers (worktree `/Users/riley/Projects/games/.claude/worktrees/rush-racers`).
Gate: `pnpm arcade check rush-racers && pnpm --filter game-rush-racers test:difficulty && pnpm arcade smoke rush-racers` (89 s on main before the rename). Filtered tests: `pnpm arcade test rush-racers <paths or @groups> [-t name]`. Typecheck: `pnpm arcade check rush-racers --skip-tests`.
Runner: plain commands (`rr suite -- rush-racers` only if this machine is busy).
Worktree setup: `pnpm install --frozen-lockfile --offline`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, todo: true
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Reef Rush becomes Rush Racers: one racer with several worlds. A world is a movement style (medium), a cast of eight, the names and art of the shared items, pickups, enemies and hazards, and its courses. Reef (swim) is world one and plays exactly as today. Thornwood is world two: a forest race run on foot, Mario style, with jumps, stomps, crates hit from below, jump-through branches and pits, against three rivals, on the course Bramble Run. The next world (air or space) should be "add a world": a medium folder, a world data file, a skin, a theme, a course.

In scope (user decisions, 2026-11-23):
- Full rename to Rush Racers: folder, slug, id, package, title, logo, docs. No redirect and no save carry-over (nobody plays it yet; the new id starts a fresh save store).
- Per-world casts on shared ability slots: eight new land critters, each taking one existing ability and rival profile. Item ids and balance stay shared.
- Jump is Up (Up arrow, W, d-pad up), held for a higher jump. No new button.
- Pits: a racer who falls out reappears on the last safe ground about 1 s later with a short invulnerability; the lost time is the penalty.
- Platformer verbs in Thornwood: stomp enemies, hit `?` crates from below, jump-through branches. No wall jump.
- Thornwood is a forest: forest floor, treetop branches for the high route, a root cave for the dark zone.
- Bramble Run is listed in course select once it passes the same difficulty bars as Sunlit Shallows, which turns course select on.

Out of scope: wall jump, moving platforms, drop-through ledges, an air or space world, changes under `packages/`, new items, remappable keys, per-world character picks in the save.

Assumptions (defaulted; the user can override):
- `CharacterId` values (`rudy`, `gil`, ...) stay as stable slot ids, so the save, scenarios, difficulty files and the ability dispatch in `abilities.ts` don't change. A world's cast gives each slot its name, look and ability wording. The saved pick is a slot, so picking Gil in Reef puts the cursor on Skip the hare in Thornwood.
- Thornwood cast, slot by slot: rudy Grit (badger in a miner's lamp helmet, shake it off), gil Skip (lanky hare, spring jump), streak Blaze (red fox, wind-up), onyx Shade (black panther cub, ambush), nib Cheeks (chipmunk in goggles, deep pockets), baron Duke Mossback (huge tortoise with a mossy crown, bulldozer through cracked stone), selene Dusk (little owl in a scarf, sees in the root cave, wasp-proof), rook Fang (grey wolf, frenzy).
- Gil's slot in a jumping medium: `abilities.ts` gains one hook, `jumpMulFor(racer)` (1.12 for the gil slot, else 1), which the run medium multiplies into its jump speed. Swim never calls it, and Gil's spring kick is unchanged. That is the only ability change.
- Thornwood names for shared things: clam = `?` crate, pearl = acorn, urchin = thorn bush, jelly = wasp, shark = boar, eel = snake, crab = beetle. Items: Jet Fins = Rocket Boots, Bubble Shield = Sap Shield, Puffer = Burr Ball, Ink Sac = Mud Pie, Glow Lantern = Firefly Jar, Cannonball = Boulder, Homing Squid = Homing Bee, Riptide = Tailwind, Undertow = Snare Vine, Mimic = Copycat. Cells: water = air, rock = earth, coral = cracked stone, kelp = mud, currents left/right = wind gusts, current up = updraft, current down = downdraft, new `ledge` (`=`) = branch.
- Run medium numbers start from the ground spike (`spike/ground` ab5abac, `logic/ground/physics.ts`): gravity 800, cut-jump gravity 3.5x, max fall 320, run 100, ground accel 700, friction 900, air accel 450, air friction 120, jump 290 (about 3.3 tiles held, 1.1 tapped), coyote 6, buffer 6. Tuned in phase 2. Unlike the spike, every `MoveModifiers` field has a visible effect: `forceMul` scales run accel and top run speed by `1 + (forceMul - 1) * 0.5`, `kickMul` scales dash speed, `kickCooldownTicks` gates the dash, `dragMul` scales ground friction.
- A jump reads `move.y < -0.5` and never emits `racer.kicked`, so it never spends a dash charge. Dash is the B/X button in every world; in Thornwood it is a horizontal burst that also works once in the air. Run's `aimFrom` is horizontal only, so the Easy steering assist (`guide.ts` `assistedIntent`) can never add an Up and make the player jump.
- Racers in the run medium push each other sideways only (`racerCollision: 'horizontal'`): a racer landing on another passes through vertically, while side bumps, Onyx's ambush and Duke's bump mass still work.
- No new sound effects except jump, fall and stomp; other sfx stay global. The sfx pin over Sunlit must not change.
- Rush Racers' landing page footage (`attract.mp4`, `cover.png`) is re-recorded at the end, on whichever course reads best.

Error model: logic stays total over valid state and throws only for programmer errors and bad course data, as today. Course data errors (a ledge in a medium that doesn't allow ledges, a start with no route to the finish) throw `LevelError` with row and col from `parseLevel` or `Medium.validateLevel`. A course naming an unknown world throws `Error` naming course and world. An engine world skin missing art for a character, item, pickup, enemy or hazard fails `engine/worlds/skins.test.ts`, and boot throws naming the world and the missing key, like `assertCourseAssets`.

## Contracts (scaffold commit)

Paths are under `games/rush-racers/src/` (after the rename). The scaffold also does the rename itself and keeps typecheck green.

Logic:

    logic/worlds/types.ts       WorldDef: id, name, medium, cast names per CharacterId, display names of items, pickups, enemies and hazards
    logic/worlds/reef.ts        Reef's WorldDef: today's names; data only
    logic/worlds/index.ts       WORLDS registry, registerWorld (tests), worldById, worldOf(course), castName(world, character); the only importer of world files
    logic/courses/types.ts      Course: `world` replaces `medium` (the medium comes from the world)
    logic/test-world.ts         courseFromLevel(level, medium) races in a registered test world for that medium
    logic/characters.ts         Character loses `name`
    logic/types.ts              Cell gains 'ledge'; MoveContacts, MoveRules
    logic/events.ts             racer.jumped, racer.fell, racer.respawned, enemy.bonked gains `how: 'dash' | 'stomp'`
    logic/media/types.ts        Medium gains afterMove; MediumEffects gains stompBounce, solidClams, pitBelow, allowsLedges; racerCollision gains 'horizontal'
    logic/race/collide.ts       stub signatures: moveBody(..., rules) returns MoveContacts; moveRulesFor(world)

Engine:

    engine/worlds/types.ts      WorldSkin = CastSkin + ObjectSkin + registerTextures
    engine/worlds/reef.ts       assembles Reef's skin from reef/cast.ts and reef/objects.ts; wiring only
    engine/worlds/reef/cast.ts  Reef cast skin: racer, portrait and head keys and ability text per slot
    engine/worlds/reef/objects.ts  Reef object skin: item icons and art, attack art, pickups, enemies, glints, item and enemy text
    engine/worlds/index.ts      SKINS registry, skinFor(course), assertSkinAssets
    engine/view/how-to-play/kit.ts  the kit carries the skin, so pages read art through it
    engine/view/race-text.ts    racerName and racerShortName read the world cast

## Phases

### Phase 1: Rush Racers with world seams (MVP)

Scaffold: f40b824
Tag: rush-racers-phase-1
Demo: `pnpm arcade dev rush-racers`, open `/games/rush-racers/`: the title says RUSH RACERS and Reef plays exactly as before. `pnpm arcade test rush-racers @behavior @courses @media @seams` green with the sfx pin unchanged.
Test cases:
- Rename: `game.json` id and slug `rush-racers`, title `Rush Racers`; smoke loads `/games/rush-racers/`; the unknown-course warning is tagged `[rush-racers]`; the title draws the new logo frame.
- `WORLDS.reef` has medium `swim` and a cast name for every `CharacterId` equal to today's names; `worldOf(course)` returns the course's world; a course naming an unknown world throws `Error` naming course and world; `courseFromLevel(level, 'glide')` races in glide.
- `racerName(character, course)` and `racerShortName(character, course)` read the course's world cast (Reef: unchanged strings).
- `skinFor(course)` returns Reef's skin for Sunlit; `assertSkinAssets` passes for every shipped skin and throws naming world and key when a character, item, pickup, enemy or hazard key is missing.
- Select, title, results, HUD, fire button, racer view, attack view, pickup view, enemy views, bursts and How to Play read textures and text from the skin; every existing scenario and spec passes unchanged.
- `moveBody` returns contacts: landing sets `floor`; a head bump sets `ceiling` and lists the bumped tile indices; walls set `wallLeft`/`wallRight`. The Mimic decoy moves under the same rules.
- Ledge `=`: a body falling onto it from above lands; a body rising through it passes; a body standing on it and holding down stays on it; horizontal motion passes through; `pushOutOfSolids` never pushes out of a ledge; swim's `validateLevel` rejects a ledge with row and col.
- `pitBelow`: with it set, a body below the last row is not pushed back and `progressAt` reads the last row's value for it (never Infinity); with it unset, the bottom edge stays solid (swim unchanged).
- `afterMove` runs once per unfinished racer per tick right after `moveBody`, in RACER_IDS order; swim's is a no-op.
- Stomp: with `stompBounce` set, a falling racer (`vy > 0`) whose overlap with the enemy from above is at most `vy * dt + 2` px bonks it (`enemy.bonked` with `how: 'stomp'`) and leaves with `vy = -stompBounce`; a racer meeting it from the side or rising into it is hit as before; with it null, behaviour is today's.
- Solid crates: with `solidClams` set, a ready clam's tile blocks movement, a head bump opens it for that racer (`clam.opened`), a full inventory leaves it shut and solid; with it unset, clams open on touch as today.
- `racerCollision: 'horizontal'`: two racers overlapping are pushed apart along x only; a racer dropping onto another passes through.
- Sunlit fingerprint: `top-route.test.ts`, the sfx pin and every scenario unchanged.
- Groups: `@platform` holds the six seam test files above, `@worlds` the world and skin tests.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/reef/cast.ts, games/rush-racers/src/engine/scenes/select.ts, games/rush-racers/src/engine/scenes/title.ts, games/rush-racers/src/engine/scenes/results.ts, games/rush-racers/src/engine/view/hud.ts, games/rush-racers/src/engine/view/racer-view.ts, games/rush-racers/src/engine/view/race-text.ts, games/rush-racers/src/engine/character-select.ts, games/rush-racers/src/engine/character-select.test.ts | contracts, games/rush-racers/src/engine/themes/course-assets.ts | games/rush-racers/src/engine/worlds/skins.test.ts | sonnet | merged | deliver/rush-racers-1a | skin cast tests, scenarios pass |
| b | M | games/rush-racers/src/engine/worlds/reef/objects.ts, games/rush-racers/src/engine/view/hud-well.ts, games/rush-racers/src/engine/view/hud.test.ts, games/rush-racers/src/engine/view/fire-button.ts, games/rush-racers/src/engine/view/powerup-view.ts, games/rush-racers/src/engine/view/attack-view.ts, games/rush-racers/src/engine/view/pickup-view.ts, games/rush-racers/src/engine/view/level-view.ts, games/rush-racers/src/engine/view/enemy-look.ts, games/rush-racers/src/engine/view/enemy-view.ts, games/rush-racers/src/engine/view/hazard-view.ts, games/rush-racers/src/engine/view/dark-view.ts, games/rush-racers/src/engine/fx/bursts.ts, games/rush-racers/src/engine/art/sprites/sprites.test.ts, games/rush-racers/src/engine/view/how-to-play/attacks-page.ts, games/rush-racers/src/engine/view/how-to-play/enemies-page.ts, games/rush-racers/src/engine/view/how-to-play/clams-page.ts, games/rush-racers/src/engine/view/how-to-play/pearls-page.ts, games/rush-racers/src/engine/view/how-to-play/fire-page.ts, games/rush-racers/src/engine/view/how-to-play/dodge-page.ts, games/rush-racers/src/engine/view/how-to-play/index.ts | contracts, games/rush-racers/src/engine/themes/course-assets.ts | games/rush-racers/src/engine/worlds/skins.test.ts | sonnet | merged | deliver/rush-racers-1b | skin object tests, scenarios pass |
| c | L | games/rush-racers/src/logic/race/collide.ts, games/rush-racers/src/logic/race/flowfield.ts, games/rush-racers/src/logic/level/query.ts, games/rush-racers/src/logic/level/parse.ts, games/rush-racers/src/logic/world.ts, games/rush-racers/src/logic/powerups/decoys.ts, games/rush-racers/src/logic/hazards/enemies/contact.ts, games/rush-racers/src/logic/pickups/clams.ts, games/rush-racers/src/logic/media/swim/, games/rush-racers/src/logic/conformance/glide.ts, games/rush-racers/src/logic/conformance/glide-nav.ts | contracts, games/rush-racers/src/logic/world.ts header | games/rush-racers/src/logic/race/move-contacts.test.ts, games/rush-racers/src/logic/race/ledge.test.ts, games/rush-racers/src/logic/race/pit.test.ts, games/rush-racers/src/logic/hazards/enemies/stomp.test.ts, games/rush-racers/src/logic/pickups/crates.test.ts, games/rush-racers/src/logic/conformance/seams.test.ts | opus | merged | deliver/rush-racers-1c | seam tests, top-route, sfx pin pass |

#### Lane a brief

- Goal: every cast-facing view reads racer art, portraits, heads, names and ability text from the course's world skin and world cast, with Reef's skin holding today's keys and words, so a second world's cast drops in without view edits.
- Interface: fill `REEF_CAST` in `engine/worlds/reef/cast.ts` (type `CastSkin` from `engine/worlds/types.ts`) with today's `Tex.<character>`, `PortraitFrame`, head frames and the ability wording now in `ABILITY_TEXT`. Views get the skin with `skinFor(course)` from `engine/worlds/index.ts` (the runtime's current course, or the menu course on the title) and names with `racerName(character, course)` / `racerShortName(character, course)` from `view/race-text.ts`. `abilityTextFor(character, skin)` reads the skin; `ABILITY_TEXT` is deleted.
- Behavior: select grid, card and preview racer (the highlighted character, not hard-coded rudy), title lane racers (the first four of `CHARACTER_IDS`, drawn from the menu course's skin), the title best card, the results podium and head, the HUD place portrait and strip heads, and the racer view texture, all from the skin. Results and standings names come from the world cast. On Reef, every string and texture key is what it is today.
- Decisions already made: CharacterId values are slot ids and don't change. Ability wording lives in the skin, so Thornwood can say SPRING JUMP where Reef says SPRING KICK.
- Out of scope: new art, item/pickup/enemy views and How to Play pages (lane b), logic changes, the logo (scaffold).
- Done when: `pnpm arcade test rush-racers src/engine/worlds src/engine/character-select.test.ts tests/hud.spec.ts` and `@behavior` pass, `pnpm arcade check rush-racers --skip-tests` passes, and a `pnpm arcade see rush-racers --scenario pick-character` capture looks as before.

#### Lane b brief

- Goal: item icons and art, attack art, pickups, enemies, hazard dark glints, item-flavoured HUD strings and How to Play captions and headings come from the course's world skin, with Reef's skin holding today's keys and words.
- Interface: fill `REEF_OBJECTS` in `engine/worlds/reef/objects.ts` (type `ObjectSkin`): `itemIcons` and `itemTextures` per `PowerUpKind` (today's `POWER_UP_ICON` and `POWER_UP_TEX`), `attack` (squid, bubble, ink cloud, riptide and undertow streaks, loose glow, and the bubble and ink burst frames `fx/bursts.ts` uses), `pickups` (pearl, clam), `enemies` per `EnemyKind` (today's sheets and frames), `glints` (urchin, jelly), `text` (`slowedBy`, the trapped-arrow word, attack captions, enemy captions, the crates and acorns page headings). Views take the skin from `skinFor(course)`; How to Play pages read it from `kit.skin`. Delete `POWER_UP_ICON` and `POWER_UP_TEX` and move their tests in `hud.test.ts` and `sprites.test.ts` onto the skin.
- Behavior: Reef renders and reads exactly as today. The shared page headings in `how-to-play/index.ts` become functions of the skin while `MOVE_PAGES` stays keyed by medium. The dash pip (`Tex.kickPip`) stays global.
- Decisions already made: the theme keeps the urchin and jelly sprites; only their dark glints move to the world skin. Sfx stay global.
- Out of scope: cast views (lane a), new art, logic.
- Done when: `pnpm arcade test rush-racers src/engine/worlds src/engine/view/hud.test.ts src/engine/art/sprites/sprites.test.ts tests/attack-warning.spec.ts tests/hints.spec.ts` and `@behavior` pass, `--skip-tests` check passes, and `see --scenario enemy-bonk` and `--scenario how-to-play` captures look as before.

#### Lane c brief

- Goal: the generic movement and contact seams a platformer needs, with swim's answers keeping Sunlit identical: collision reports contacts, a one-way ledge cell, an open-bottom pit option, a per-racer post-move hook, stomping, solid crates opened from below, and sideways-only racer collision.
- Interface (types and stubs in the scaffold): `moveBody(body, level, broken, dt, rules: MoveRules): MoveContacts` with `MoveRules { pitBelow: boolean; solidTiles: ReadonlySet<number> }` and `moveRulesFor(world)` (ready clam tiles when the medium's `solidClams` is set); `Medium.afterMove(world, racer, contacts, events)`. The scaffold's `moveBody` takes `rules` (default `NO_MOVE_RULES`) but ignores them and returns empty contacts, so old callers keep working; the scaffold's `conformance/platform-medium.ts` is a test-only medium with every seam on, built on glide, that the seam tests use. Import swim through `mediumById('swim')` in tests: importing `media/swim/index.ts` first hits an import cycle that leaves swim unregistered. `MediumEffects.stompBounce`, `solidClams`, `pitBelow`, `allowsLedges`; `racerCollision: 'solid' | 'ghost' | 'horizontal'`; `openClamsFromBelow(world, racer, contacts)` in `pickups/clams.ts` (it emits on `world.events`); events `racer.jumped`, `racer.fell`, `racer.respawned`, `enemy.bonked.how`.
- Behavior: the phase 1 test cases from "moveBody returns contacts" to "racerCollision". Swim answers `stompBounce: null`, `solidClams: false`, `pitBelow: false`, `allowsLedges: false`, `racerCollision: 'solid'`, a no-op `afterMove`, and its `validateLevel` reports any ledge tile. Glide answers the opposite on each, so `conformance/seams.test.ts` sees every seam go through the medium. A ledge blocks only a body moving down whose bottom, before this tick's move, was at or above the tile's top. World tick order: `afterMove` right after `moveBody` in `moveRacer`, then crates from below; update the header comment. Stomp needs no stored positions: it uses the overlap-depth rule in the test cases.
- Decisions already made: no drop-through ledges; in a solid-crate medium crates open only from below; the stomp bounce is the medium's number.
- Out of scope: the run medium itself (phase 2), any change to Sunlit's level, retuning.
- Done when: the six test files above pass, plus `src/logic/top-route.test.ts`, `src/engine/audio/sfx-pin.test.ts`, `@media @seams @courses @behavior`, and the `--skip-tests` check.

### Phase 2: the run medium on a test course

Demo: `pnpm arcade dev rush-racers`, open `/games/rush-racers/?course=run-test&debug=1`: run, jump with Up, dash, land on branches, stomp a beetle, bump a crate from below, fall in a pit and respawn; rivals run and hop the simple test course (placeholder Reef art with Thornwood words).
Depends on: phase 1

Scaffold: 6c1e0e0
Tag: rush-racers-phase-2
Scaffold contents: `ShippedMediumId` and `MEDIA` gain `run`; `ShippedWorldId`, `WORLDS` gain `thornwood` (`logic/worlds/thornwood.ts`, names from Assumptions); `media/run/` holds a working baseline ported from the ground spike: `data.ts` (`RunMotion`, `RunEnv`, accessors), `way-data.ts` (`RunNav`, `RunPilot`), `tuning.ts` (`RUN_TUNING`, `RUN_EFFECTS`, `RUN_STOMP_BOUNCE` 220, `RUN_KICK_RULES`), `physics.ts` (`createRunMotion`, `applyRunIntent`, `runExtra`: run, a jump on a fresh Up press with coyote and buffer emitting `racer.jumped`, the short-hop cut, gravity), `env.ts` (`sampleRunEnvironment`: grounded), `respawn.ts` (`afterRunMove`: grounded from `contacts.floor`, last safe spot, instant return from a pit), `simple-way.ts` (uniform distance field, horizontal-only `runAimFrom`, start-reach check), `simple-pilot.ts` (run along the way, hold Up 14 ticks at a wall or a climb), `index.ts` (`RUN_MEDIUM`, `racerCollision: 'horizontal'`). `abilities.ts` has a `jumpMulFor` stub returning 1. `engine/worlds/thornwood.ts` is Reef's skin under id `thornwood`; `MOVE_PAGES.run` points at the swim page. Run's conformance cases fail until lanes a and b land.

Test cases:
- Run: holding right on flat ground reaches `RUN_TUNING.maxSpeed` (100 px/s) within 0.3 s and never passes it; releasing stops within 0.2 s; `forceMul` 1.4 raises the top speed by 20 % (half the deviation); `dragMul` scales ground friction.
- Jump: pressing Up on the ground emits `racer.jumped` and no `racer.kicked`, and a held jump clears a 3-tile wall; a tapped jump (Up for 2 ticks) peaks at least 1.5 tiles lower than a held one; holding Up does not jump again on landing (a new press is needed); a press up to 6 ticks before landing jumps on landing (buffer); a press up to 6 ticks after walking off a ledge still jumps (coyote); Gil jumps `jumpMulFor` higher (1.12x speed), every other slot 1x; in swim `jumpMulFor` changes nothing.
- Dash: the dash button gives a horizontal burst along facing, spends a dash charge as in swim, works once in the air until the racer lands, and never changes `vy`.
- Grounded: a racer on a floor, a ledge or a solid crate reports grounded through `afterRunMove` contacts; walking off an edge clears it; a head bump zeroes rising speed.
- Fall and respawn: a racer that drops below the last row emits `racer.fell` once, is parked (no input, no gravity, no progress loss beyond the last row's value) for 60 ticks, then appears at its last safe spot (the last tile it stood on with ground under both feet, never a crate or mid-pit lip) with `vy = 0`, `status.invulnerable` 60 and `racer.respawned {id, x, y}`. A rival falls and respawns the same way.
- Medium: `RUN_MEDIUM` is in `MEDIA`, its `aimFrom` has `y = 0` always, its `validateLevel` reports a start tile with no ground below within 4 rows and a `F` column unreachable along the floor, and it passes the conformance cases that apply to it (deterministic, speed cap, kick cooldown, every MoveModifiers field visible, progress rightward and leftward on open ground, backstop recovery); the free-movement cases (shaft with a lip, eight-way open space, mid-air start) are skipped for run by listing per-medium geometries.
- Course `run-test` (world `thornwood`, unlisted, ocean theme and race song for now): about 60 tiles, with a pit, a branch run, a `?` crate over a jump, a beetle (`K`) on flat ground and a cracked-stone block; `conformance/course.test.ts` passes for it; every rival finishes it within par from each start using the simple pilot.
- How to Play: the backdrop draws the current course's level and theme; `MOVE_PAGES` becomes `MEDIUM_PAGES: Record<ShippedMediumId, { move; crates?; enemies? }>`, and run overrides the crates page (hit from below) and the enemies page (stomp).
- Engine: `?course=run-test` boots with no console errors; ledges draw as a one-tile branch strip in the ocean terrain for now; the run How to Play page says Up jumps and shows a jump; a fallen racer (`status.fallen > 0`) is parked by the medium and its sprite hides from `racer.fell` until `racer.respawned`; `assertSkinAssets` passes for the thornwood skin.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/media/run/physics.ts, games/rush-racers/src/logic/media/run/env.ts, games/rush-racers/src/logic/media/run/respawn.ts, games/rush-racers/src/logic/media/run/tuning.ts, games/rush-racers/src/logic/media/run/data.ts, games/rush-racers/src/logic/abilities.ts | contracts | games/rush-racers/src/logic/media/run/physics.test.ts, games/rush-racers/src/logic/media/run/respawn.test.ts | opus | merged | deliver/rush-racers-2a | run physics tests pass |
| b | M | games/rush-racers/src/logic/media/run/index.ts, games/rush-racers/src/logic/media/run/simple-way.ts, games/rush-racers/src/logic/media/run/simple-pilot.ts, games/rush-racers/src/logic/media/run/way-data.ts, games/rush-racers/src/logic/courses/run-test.ts, games/rush-racers/src/logic/courses/index.ts, games/rush-racers/src/logic/courses/types.ts, games/rush-racers/src/logic/conformance/medium.test.ts, games/rush-racers/src/logic/conformance/geometries.ts | contracts | games/rush-racers/src/logic/conformance/course.test.ts, games/rush-racers/src/logic/media/run/way.test.ts | opus | merged | deliver/rush-racers-2b | run-test conformance passes |
| c | S | games/rush-racers/src/engine/worlds/thornwood.ts, games/rush-racers/src/engine/view/how-to-play/run-page.ts, games/rush-racers/src/engine/view/how-to-play/index.ts, games/rush-racers/src/engine/themes/ocean/sprites/terrain.ts, games/rush-racers/src/engine/themes/ocean.ts, games/rush-racers/src/engine/view/racer-view.ts, games/rush-racers/src/engine/scenes/how-to-play.ts | contracts | games/rush-racers/src/engine/worlds/skins.test.ts | sonnet | merged | deliver/rush-racers-2c | placeholder skin, run pages, ledge tile, fall hide |

#### Lane a brief

- Goal: the run medium's physics, surroundings and falls to the phase 2 test cases "Run" through "Fall and respawn", on top of the scaffold baseline.
- Interface: keep the signatures in `physics.ts`, `env.ts` and `respawn.ts` (they are `Medium` members). You may add fields to `RunMotion` and `RunEnv` in `data.ts` and extras to `RUN_TUNING`; don't rename or remove any (lane b's pilot reads `RunMotion.grounded`). Set `jumpMulFor` in `abilities.ts` (Gil 1.12, everyone else 1) and use it in the jump.
- Behavior: every `MoveModifiers` field has a visible effect (conformance checks it): `forceMul` scales ground accel and top speed by `1 + (f - 1) * 0.5`; `kickMul` scales dash speed; `kickCooldownTicks` gates the dash; `dragMul` scales ground friction. Dash: `intent.kick` with the cooldown at 0 sets `vx` to `tuning.kick * kickMul` along facing (Gil's kickImpulse rules say no spring kick in run), emits `racer.kicked` (so it spends a dash charge as in swim), never changes `vy`, and works once in the air until landing. A jump never emits `racer.kicked`. `maxSpeed` caps running speed only; never cap vertical speed beyond `maxFall`, so a stomp bounce or jump survives. Currents (`<`, `>`, `^`, `v`) are wind: they push a runner along their direction (`currentForce`-style extra), and kelp is mud (slower top speed). Falls: when a runner's top passes below the last row, emit `racer.fell` once, set `status.fallen = respawnTicks` (generic code then blocks its input and treats it downed), park it (velocity 0, no gravity) and count `fallen` down in `afterRunMove`; at 0 put it at `lastSafe` with `vy = 0`, `status.invulnerable = respawnInvulnTicks`, and emit `racer.respawned {id, x, y}`. `lastSafe` updates only when grounded with solid or ledge tiles under both bottom corners and no crate under either. A head bump (`contacts.ceiling`) zeroes rising speed.
- Decisions already made: Up is jump (`move.y < -0.5`), a fresh press needed; held for height. The dash button is the dash in every world. No wall jump.
- Out of scope: the way, pilot, course and conformance files (lane b), the engine (lane c).
- Done when: you write `media/run/physics.test.ts` and `media/run/respawn.test.ts` with one test per case in "Run" through "Fall and respawn" (drive `applyRunIntent`/`afterRunMove` on bare racers, or `createWorld` on small inline levels via `courseFromLevel(ascii, 'run')`), they pass, and `pnpm arcade test rush-racers @platform @seams @behavior src/logic/top-route.test.ts` and `--skip-tests` check pass.

#### Lane b brief

- Goal: run's way, rival pilot, the `run-test` course and the conformance suite's per-medium cases, so every rival finishes `run-test` and run passes the conformance cases that apply to it.
- Interface: keep `RUN_MEDIUM`'s members; `simple-way.ts` and `simple-pilot.ts` keep their exported names. You may add fields to `RunNav` and `RunPilot` in `way-data.ts`. Read `RunMotion` (lane a's `data.ts`) read-only: `grounded`, `jumping`. Add `'run-test'` to `ShippedCourseId` and `COURSES` (unlisted).
- Behavior: the "Medium" and "Course `run-test`" test cases. `validateRunLevel` also reports a start with no ground within 4 rows below and a finish column unreachable. The pilot jumps gaps (a pit ahead within 2 tiles), walls, climbs and ledges above on the way, holding Up long enough for the height needed, dashes on flat ground when the dash is ready and `kickSkill` allows (via the `kick` draw), and on `forceRecover` backs off and jumps. Conformance: make `medium.test.ts` and `geometries.ts` per-medium: each medium lists the geometries and open-space directions that apply; run skips the shaft with a lip, eight-way open space and mid-air start and gets a flat run, a step up, a pit and a ledge hop instead; the speed cap check reads horizontal speed for media whose `dashAxes` is horizontal.
- Course `run-test`: world `thornwood`, theme `ocean`, song `race`, `listed: false`, about 60 tiles wide and 12 high, with a pit, a ledge (`=`) run, a `?` crate over a jump, a beetle (`K`) on flat ground, a cracked-stone (`C`) block, pearls (`o`), and par ticks set from a measured rival run plus 30 %. Lanes a and b run in parallel; lane a will change the physics, so leave margin: no jump that needs more than 2.5 tiles of height or 4 tiles of gap.
- Out of scope: physics and respawn (lane a), engine (lane c), the jump-link nav (phase 4).
- Done when: `pnpm arcade test rush-racers @media @courses @seams src/logic/conformance` passes for every medium including run, `src/logic/media/run/way.test.ts` (yours, one test per way/validate rule) passes, and the `--skip-tests` check passes.

#### Lane c brief

- Goal: a Thornwood course boots and reads in Thornwood's words, ledges draw, How to Play teaches running, and a fallen racer disappears until it respawns.
- Interface: `engine/worlds/thornwood.ts` keeps Reef's art (`REEF_CAST`'s textures and `REEF_OBJECTS`' textures) but its own `abilities` text and `objects.text` in Thornwood's words (SPRING JUMP for gil, etc.; captions with BEE, TAILWIND, SNARE VINE, COPYCAT, BEETLE WALKS, BOAR CHARGES, SNAKE LUNGES, HIT CRATES, GRAB ACORNS, SLOWED BY MUD, SAP). In `how-to-play/index.ts`, replace `MOVE_PAGES` with `MEDIUM_PAGES: Record<ShippedMediumId, { move: MovePage; crates?: PageSpec; enemies?: PageSpec }>`, add `run-page.ts` (run, Up to jump, hold for height, dash) and run's crates (hit from below) and enemies (stomp) pages; `scenes/how-to-play.ts` draws the current course's level and theme as the backdrop. The ocean terrain draws a ledge tile (`=`) as a one-tile branch strip. `racer-view.ts` hides a racer from `racer.fell` until `racer.respawned`.
- Decisions already made: Thornwood art is phase 3; this phase uses Reef art under Thornwood words.
- Out of scope: logic (lanes a and b), the course (lane b).
- Done when: `pnpm arcade test rush-racers src/engine @worlds tests/how-to-play.spec.ts` (or the how-to-play scenario) and `@behavior` pass, the `--skip-tests` check passes, Reef's `see --scenario how-to-play` capture is unchanged, and a `see --query course=run-test --input "right*60 up*20 right*60"` capture shows a racer running with no console errors once lanes a and b have landed (before then, check the how-to-play run pages with a course from `courseFromLevel`-style test data or by reading the page builders' tests).


### Phase 3: Thornwood art, theme and song

Demo: `/games/rush-racers/?course=run-test` in the forest theme with the Thornwood cast, items, crates, acorns, enemies and song; `?stage=enemy-modes&course=run-test` shows the forest enemies.
Depends on: phase 2

Scaffold: a14dda6

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/worlds/thornwood/cast.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/racers.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/portraits.ts, games/rush-racers/src/engine/art/sprites/sprites.test.ts | contracts | games/rush-racers/src/engine/worlds/thornwood/cast.test.ts | opus | running | deliver/rush-racers-3a | cast art covers every slot, contrast holds |
| b | M | games/rush-racers/src/engine/worlds/thornwood/objects.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/items.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/pickups.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/enemies.ts, games/rush-racers/src/engine/worlds/thornwood/sprites/attack.ts | contracts | games/rush-racers/src/engine/worlds/thornwood/objects.test.ts | opus | running | deliver/rush-racers-3b | object art covers every key |
| c | M | games/rush-racers/src/engine/themes/forest.ts, games/rush-racers/src/engine/themes/forest/, games/rush-racers/src/engine/audio/songs/thornwood.ts | contracts, games/rush-racers/src/engine/themes/ocean.ts | games/rush-racers/src/engine/themes/forest.test.ts | opus | running | deliver/rush-racers-3c | theme and song resolve, contrast holds |

Scaffold contents: `ThemeId` gains `forest` and `SongId` `thornwood`; `THEMES.forest` is a placeholder (ocean's look under id `forest`) and `songs.thornwood` the race song renamed; `run-test` names both. `themes/forest/palettes.ts` fixes the forest's colours as a contract: dusky canopy greens (`WOOD_BANDS`, seven bands about as dark as `WATER_BANDS`), far and near tree silhouettes, terrain (earth, cracked stone, branch, mud), hazards (thorn bush, wasp), so every racer and all global art keep 3:1 against them. `engine/worlds/thornwood/keys.ts` names every Thornwood texture and frame (`ThornTex`, `ThornIconFrame`, `ThornPortraitFrame`); `worlds/thornwood/cast.ts` and `objects.ts` hold today's placeholder skins (Reef textures, Thornwood words) and export `registerThornwoodCast(scene)` and `registerThornwoodObjects(scene)` as no-ops; `worlds/thornwood.ts` is wiring only. `worlds/index.ts` gains `assertSkinTextures(textures, skin)`, called at boot after textures register, which throws naming the world and key for any texture or frame the skin names that doesn't exist (the check deferred from phase 1).

Test cases:
- Cast art: every Thornwood slot has a 16x12 racer texture facing right with run-stride frames `a` and `b` drawn around the same 12x10 body as Reef's racers, a 16x16 portrait and a 7x7 head in the same palette; each main colour holds 3:1 against every theme's contrast bands (`sprites.test.ts`'s rule, applied to every skin's cast); the look matches the cast list in Assumptions (badger in a lamp helmet, lanky hare, red fox, black panther cub, chipmunk in goggles, mossy-crowned tortoise, owl in a scarf, grey wolf).
- Object art: a 9x9 icon and an in-world sprite for each of the ten items in Thornwood's form (Rocket Boots, Sap Shield, Burr Ball, Mud Pie, Firefly Jar, Boulder, Homing Bee, Tailwind, Snare Vine, Copycat); attack art (bee in flight with `a`, `b`, `latched`, tailwind streak, snare streak, mud cloud, sap bubble, loose glow); the `?` crate with `closed` and `open` frames and the acorn; beetle, boar (with `bite` and `stagger` frames like the shark) and snake head and body; marks; glints for thorn bush and wasp.
- `assertSkinTextures` passes at boot for both skins and throws naming world and key when a texture or frame is missing.
- Forest theme: tiles for rock (earth with a grass top), coral (cracked stone), ledge (a branch you jump up through); mud and wind cells flow (mud bubbles, gust streaks, rising and falling leaves); a finish gate; debris chips; backdrop bands from `WOOD_BANDS` with far and near tree layers and light shafts through the canopy; drifting pollen motes; air particles (rise slowly, fall faster than in water, no heavy drag); thorn bush and wasp hazard sprites (the wasp animated); a root-cave dark tint; a dust trail. `assertCourseAssets(run-test)` passes; the urchin body and every racer hold 3:1 against the forest bands.
- Song `thornwood`: parses, loops, its own key, tempo and hook (a woodsy, bouncy chase, not a reharmonised race theme); `songs.test.ts` passes; the sfx pin over Sunlit is unchanged.
- Reef is untouched: the Sunlit how-to-play and race captures compare equal to the phase 2 baseline.

#### Lane a brief

- Goal: Thornwood's cast drawn: eight land critters with run strides, portraits and heads.
- Interface: `worlds/thornwood/cast.ts` exports `THORNWOOD_CAST: CastSkin` (keep the ability text the scaffold moved there) and `registerThornwoodCast(scene)`, which draws every texture its keys in `worlds/thornwood/keys.ts` name for the cast (racers, portraits, heads) through `drawSheets` the way `art/sprites/racers.ts` and `art/ui/portraits.ts` do. Put the pixel art in `worlds/thornwood/sprites/racers.ts` and `sprites/portraits.ts`, with a `ThornwoodPalette` per slot like `CharacterPalette`.
- Behavior: the "Cast art" test case. Each critter reads at 16x12 by silhouette (the hare's ears, the tortoise's shell, the owl's round head, the wolf's snout); frames `a` and `b` are a two-step run cycle, not a swim stroke; light from the top left, dark outline, thin limbs as 1 px lines, as in `racers.ts`'s header.
- Out of scope: objects (lane b), theme and song (lane c), any change to Reef's art.
- Done when: `pnpm arcade test rush-racers src/engine/worlds src/engine/art` passes with the cast contrast and size tests extended to Thornwood, `--skip-tests` check passes, and a `see --query course=run-test` capture shows the eight critters (look at it; check the select card and results too).

#### Lane b brief

- Goal: Thornwood's objects drawn: items, attacks, crate and acorn, enemies, marks, glints.
- Interface: `worlds/thornwood/objects.ts` exports `THORNWOOD_OBJECTS: ObjectSkin` (keep the scaffold's Thornwood text) and `registerThornwoodObjects(scene)`, drawing every object texture and icon frame `worlds/thornwood/keys.ts` names. Pixel art in `worlds/thornwood/sprites/items.ts` (icons and in-world items), `sprites/pickups.ts` (crate, acorn), `sprites/enemies.ts` (beetle, boar, snake, marks) and attack art where it fits; frames follow `Frame` in `art/keys.ts` exactly as Reef's do, since the views ask for them by those names.
- Behavior: the "Object art" test case. Icons stay legible at 9x9 on the HUD well; the `?` crate reads as a block you hit from below (a `?` on its face, a pop-open frame); the acorn is as bright as the pearl so it reads on the forest bands; enemies hold 3:1 against the forest bands.
- Out of scope: cast (lane a), theme and song (lane c), Reef's art.
- Done when: `pnpm arcade test rush-racers src/engine/worlds src/engine/art` passes, the `--skip-tests` check passes, and `see --query course=run-test` plus `see --query stage=enemy-modes&course=run-test` (or the nearest enemy stage) captures show the new objects.

#### Lane c brief

- Goal: the forest theme and Thornwood's song.
- Interface: `themes/forest.ts` exports `FOREST_THEME` via `defineTheme`, replacing the scaffold placeholder, with its art under `themes/forest/` (keys, sprites, palettes; the scaffold's `palettes.ts` colours are the contract and may only change if every contrast test still passes). `audio/songs/thornwood.ts` exports `thornwood` in the game's notation, replacing the placeholder.
- Behavior: the "Forest theme" and "Song" test cases. Terrain stays mid-value so racers pop; the branch tile is visibly thin so it reads as jump-through; mud and wind tiles read without hiding racers; the root-cave dark tint is near-black green.
- Out of scope: cast and objects (lanes a and b), Reef's ocean theme, sfx.
- Done when: `pnpm arcade test rush-racers src/engine/themes src/engine/audio src/engine/art` passes, the `--skip-tests` check passes, the Sunlit captures are unchanged, and a `see --query course=run-test` capture shows the forest (look at it).

### Phase 4: rivals that platform

Demo: rivals finish `run-test` and the run conformance geometries without stalling, take a high route when it is shorter, and never aim at ground they can't reach; Easy's guide arrow points up at the next jump; Easy's assist never jumps for the player.
Depends on: phase 2

Scaffold: a14dda6

One lane: the jump-aware nav and the pilot that follows it are one contract (the pilot executes the nav's links), so splitting them would make one lane test against a fake of the other. No scaffold: the lane owns every file it changes, and `Medium`'s members don't change.

Test cases:
- Stand tiles: an open tile with rock, unbroken coral, a ledge or a shut crate (solid in run) under it is a stand tile; breaking the coral under one removes it.
- Links: from each stand tile, `walk` to the next stand tile on the same row; `drop` off an edge to the stand tile it lands on (falling at `maxFall` while moving at `runSpeed`); `jump` to every stand tile a held jump of some length reaches without its arc (a few samples of body-sized boxes along the parabola) crossing a solid tile, each with the hold ticks that reach it (from `jumpPeak`). A ledge is landable from below; a shut crate is not passed through. A 3-tile pit is jumped; a 5-tile pit isn't linked.
- Nav: the distance from each stand tile is the least time to the finish over links (Dijkstra on ticks: walk and drop at `runSpeed`, jump by its air time), so a high route that is shorter in time wins and a route that needs an impossible jump is Infinity; every open tile above a stand tile (air, a pit's mouth) reads the distance of the stand tile it falls to, or the nearest stand tile's distance on its row plus a penalty, so progress and the guide keep working mid-jump. `nextTile` from a stand tile follows its best link's first step (up or diagonal for a jump), so Easy's guide arrow points up at a jump. Building nav for a 300x20 level takes under 50 ms in Vitest.
- `validateLevel`: a start whose distance is Infinity reports the start's row and col (replaces phase 2's start-reach and finish checks with the link graph's answer).
- Pilot: a rival follows its stand tile's best link: runs toward a walk or a drop, starts a jump from within a tile of the take-off with Up held for the link's hold ticks, lets go to land, and re-plans on landing; it dashes on flat runs as today; on `forceRecover` it backs off and re-jumps as today. It never holds Up across a landing.
- Conformance: run gets a "high route" geometry (a ledge staircase to a shorter upper path) and a "dead-end jump" geometry (an unjumpable gap beside a longer ground path); rivals finish both; every rival finishes `run-test` from every start under par across seeds 1-5 and all characters; `media/run/simple-way.ts` and `simple-pilot.ts` are removed, with their tests moved to `nav.test.ts` and `pilot.test.ts`.
- Easy: `assistedIntent` in run never sets `move.y < -0.5` (aimFrom stays horizontal), checked on a level where the guide points up.

#### Lane a brief

- Goal: rivals in run that plan jumps from a link graph, so any course whose route needs jumps, drops and ledges is raced well, and the Easy guide points at the jump.
- Interface: `Medium`'s members are unchanged. `media/run/links.ts` (`standTiles`, `buildLinks`), `media/run/nav.ts` (`buildRunNav` over links), `media/run/way.ts` (`runDistanceAt`, `runNextTile`, `runAimFrom` horizontal only, `validateRunLevel`), `media/run/pilot.ts` (`createRunPilot`, `steerRunner`); `RunNav` and `RunPilot` in `way-data.ts` grow what they need (links per stand tile, best link, distances in ticks); `index.ts` wires them. `physics.ts`'s `jumpPeak` is read-only; ask before changing physics.
- Behavior: the phase 4 test cases above. Distances are in ticks, so a racer's progress and `top-route.test.ts` keep comparing the same way; check that `progressAt` and the race standings still rank racers sensibly mid-air (a rival over a pit isn't shown as last).
- Decisions already made: no wall jump; the dash is not planned as a jump extender (the pilot may dash on flat ground only); a crate is a platform once shut, never a route through.
- Out of scope: art, Bramble Run itself (phase 5 uses this nav and must not need changes to it), tuning the physics.
- Done when: `pnpm arcade test rush-racers @media @courses @seams @platform src/logic/conformance src/logic/media/run src/logic/guide.test.ts src/logic/difficulty/easy-guide.test.ts src/logic/top-route.test.ts` passes, the `--skip-tests` check passes, `pnpm --filter game-rush-racers test:difficulty` still passes, and a `see --query course=run-test` capture after 600 ticks shows rivals past the plateau.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/media/run/links.ts, games/rush-racers/src/logic/media/run/nav.ts, games/rush-racers/src/logic/media/run/way.ts, games/rush-racers/src/logic/media/run/pilot.ts, games/rush-racers/src/logic/media/run/index.ts, games/rush-racers/src/logic/media/run/way-data.ts, games/rush-racers/src/logic/media/run/simple-way.ts, games/rush-racers/src/logic/media/run/simple-pilot.ts, games/rush-racers/src/logic/media/run/way.test.ts, games/rush-racers/src/logic/conformance/medium.test.ts, games/rush-racers/src/logic/conformance/geometries.ts, games/rush-racers/src/logic/courses/run-test.ts | contracts, games/rush-racers/src/logic/media/run/physics.ts | games/rush-racers/src/logic/media/run/nav.test.ts, games/rush-racers/src/logic/media/run/pilot.test.ts | opus | running | deliver/rush-racers-4a | rivals plan jumps, run conformance and par pass |

### Phase 5: Bramble Run

Demo: course select lists Sunlit Shallows and Bramble Run; pick Bramble Run, see the Thornwood cast on select, race it in the forest on each level; the bars pass.
Depends on: phase 3, phase 4

Scaffold (inline, by the orchestrator, after phases 3 and 4 tag): `'bramble-run'` in `ShippedCourseId`; `logic/courses/bramble-run.ts` registered in `COURSES` after Sunlit, `listed: true`, world thornwood, theme forest, song thornwood, with a first-draft level (run-test's ideas stretched to Sunlit's length) and a guessed `parTicks`; `TITLE_TO_RACE` in `scenarios/kit.ts` gains the course select step (fire on the course the cursor starts on, which is the course in force), and every spec or scenario that walks the menus by hand gets the same step. The gate passes on the scaffold. Listing the course in the scaffold, not at the end, is deliberate: course select turning on changes every menu walk, and lane b needs it on to test.

Test cases:
- Bramble Run's level (lane a): Thornwood's three zones left to right: forest floor (pits, mud, thorn bushes, beetles and boars, crates hit from below), the treetop high route (a ledge climb to a branch path above the floor path that is shorter in time and harder: gaps, wasps, wind gusts), and the root cave (a `dark` column range, snakes, cracked stone to break or jump), then a finish straight. Every enemy kind and cell the run medium supports appears at least once. About Sunlit's race length (par within 4500-6000 ticks).
- `course.test.ts` conformance passes for Bramble Run with no edit: the level parses, `validateLevel` finds nothing, four racers finish within 1.6x par on seeds 1-5 on Hard with no 600-tick stall; the forest theme has a tile for every legend art key (`engine/themes` course-assets test).
- Par measured per COURSES.md "parTicks" (expert bot, seeds 1-200, all eight characters), with a comment saying so.
- Bars per COURSES.md "Difficulty bars": `bramble-run-<character>.test.ts` (`describeDifficulty`), `-novice` (`describeNovice`), `-normal` (`describeNormal`) for all eight, plus Easy files modelled on `easy-level.test.ts` and `easy-toddler.test.ts`, all passing with profiles unchanged. Tune the level first; a `catchUp` override on one level only if the level can't get there.
- Course select (lane b): title, Race, course select lists Sunlit Shallows then Bramble Run with each best on the level in force; down and fire picks Bramble Run; select shows the Thornwood cast's names; the race runs with `course: 'bramble-run'`, `medium: 'run'`; dash on select goes back to course select; `lastCourse` is saved as bramble-run after a finish, and the title's best line follows it.
- Mechanics scenarios on `run-test` (lane b), so they don't depend on lane a's layout: a stomp (`enemy.bonked` with `how: 'stomp'` and the racer bounced), a crate opened from below (`clam.opened` with the racer under it), and a ledge jumped up through and stood on. `pit-respawn` stays.
- Smoke (lane b): a Bramble Run race starts from the menus and runs 600 ticks with no console error on desktop Chromium, the phone and WebKit; on the phone the touch controls jump on Up.

#### Lane a brief

- Goal: Bramble Run, Thornwood's real course, designed and tuned until it passes Sunlit's bars.
- Interface: `logic/courses/bramble-run.ts` is data only (the scaffold's draft is yours to replace); its `listed`, id, world, theme and song stay as the scaffold set them. Difficulty files are new files in `logic/difficulty/` named `bramble-run-*.test.ts`. If the level needs a legend art key the forest theme lacks, or the run nav or physics need a change, report it rather than editing.
- Behavior: the level, conformance, par and bars cases above.
- Out of scope: engine art, scenarios, docs (lane b), physics and nav tuning.
- Done when: `pnpm arcade test rush-racers @courses @behavior` passes, each new bars file passes on its own (`pnpm arcade test rush-racers src/logic/difficulty/bramble-run-<x>.test.ts`), `pnpm --filter game-rush-racers test:difficulty` passes once at the end, the `--skip-tests` check passes, and a `see --query course=bramble-run --query scene=play` capture at the high route and in the root cave looks right.

#### Lane b brief

- Goal: Bramble Run and the Thornwood world are reachable, tested and documented.
- Interface: new scenarios `scenarios/course-select.ts`, `scenarios/stomp.ts`, `scenarios/crate-from-below.ts`, `scenarios/ledge-jump.ts`; `tests/smoke.spec.ts` and `tests/course.spec.ts` gain the Bramble cases. Docs: DESIGN.md (worlds, Thornwood, the run medium's controls and rules, Bramble Run's section, launch params), COURSES.md (a new "Add a world" section: the medium folder, the logic world file, the engine skin, theme, song and course, in the order this run built Thornwood, so the next world is a recipe), UI.md (course select with two courses, Thornwood's names in the HUD and How to Play).
- Behavior: the course select, mechanics and smoke cases above.
- Out of scope: the level itself (lane a, in parallel: describe Bramble Run in DESIGN.md from this plan's zone list and leave exact columns out), engine and logic code.
- Done when: `pnpm arcade test rush-racers` with the new scenario files passes (run them through `pnpm arcade see --scenario <name>` too and look), `pnpm arcade smoke rush-racers` passes once at the end, and the `--skip-tests` check passes.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/rush-racers/src/logic/courses/bramble-run.ts, games/rush-racers/src/logic/difficulty/ | contracts, games/rush-racers/COURSES.md | games/rush-racers/src/logic/conformance/course.test.ts | opus | pending | | Bramble Run bars pass |
| b | M | games/rush-racers/scenarios/course-select.ts, games/rush-racers/scenarios/stomp.ts, games/rush-racers/scenarios/crate-from-below.ts, games/rush-racers/scenarios/ledge-jump.ts, games/rush-racers/tests/smoke.spec.ts, games/rush-racers/tests/course.spec.ts, games/rush-racers/DESIGN.md, games/rush-racers/COURSES.md, games/rush-racers/UI.md | contracts | games/rush-racers/tests/smoke.spec.ts | opus | pending | | scenarios and smoke pass |

## Log

- 2026-11-23: baseline gate on main green in 89 s (check, difficulty bars, smoke).
- 2026-11-23 plan critique (devils-advocate, opus), applied: (1) phase 2 had no lane registering the run medium, a world or `run-test`, so lane 2/b now owns those registrations and 2/c a placeholder Thornwood skin; (2) the conformance suite assumes free movement and runs every geometry for every medium, so 2/b gives it per-medium cases and 4/b adds run's geometries; (3) stomp needed last-tick positions, replaced by an overlap-depth rule; (4) `decoys.ts` calls `moveBody` and `progressAt` goes Infinity below the grid, both now lane 1/c's; (5) lanes 1/a and 1/b missed `kit.ts`, `fire-button.ts`, `dodge-page.ts` and three tests, so `kit.ts` and `race-text.ts` plumbing moved to the scaffold and the rest are assigned; (6) the Easy assist could press Up, prevented by run's horizontal `aimFrom`; (7) Gil's spring kick does nothing in run, so a stated `jumpMulFor` hook replaces the silent `abilities.ts` edit; (8) racers landing on racers, handled by `racerCollision: 'horizontal'`, and `Course.medium` dropped in favour of the world's. Rejected: making run racers ghosts as the spike did, since it would switch off Onyx's ambush and Duke's bump mass in Thornwood.
- Inline before phase 1 lanes (scaffold commit, by the orchestrator): the rename (`git mv games/reef-rush games/rush-racers`, ids, package name, lockfile importer, `.claude/launch.json`, CI, `docs/repo-map.md`, smoke and course specs, logger tag, a new RUSH RACERS logo frame), the logic world registry with Reef's data, `Course.world`, test worlds, and the engine skin types, registry, Reef skin stubs, kit and race-text plumbing.
- 2026-11-23 phase 1 landing: `scenes/race.ts` was in no lane's Owns list though both 1/a and 1/b changed signatures it calls, so the merger made those call-site edits (plus `race-text.test.ts`, `hud.ts` captions, `fx/index.ts` bursts). Lane 1/b's optional Reef defaults on `enemyLook` and `createBursts` were made required so a missing skin can't silently draw Reef art. Later phases: list the scene that constructs a view in the lane that changes the view's signature.
- 2026-11-23 lane 1/c review, applied: stomp bounce applied after the enemy pass so landing on two enemies stomps both; `progressAt` clamps the sample, not the body top, so in-level readings are unchanged; crates opened from below stay shut as long as touch-opened clams; a falling racer stomps even while dashing (stomp checked before dash bonk when the medium has a bounce); `collide.ts` split into `race/move.ts` and `race/separate.ts` with `rules` required. Also fixed three seam test setups the lane found wrong (ledge run length, swim ledge course without starts 2-4, stomp clipped by glide's speed cap on a second tick).
- 2026-11-23 phase 1 boundary review, applied as `phase 1: boundary fixes`: a generic `status.fallen` that blocks input, counts as downed and is skipped by homing targets (the run medium owns its countdown); `buildNav` takes the effective tuning so jump links match course overrides; crates stay solid while shut, so a racer standing on one never drops through when another bumps it; the ledge check moved from swim into `createWorld`, driven by `allowsLedges`; `assertSkinAssets` checks the hazard glints. Moved to lane 2/c: How to Play backdrop from the current course and per-medium crate and enemy pages. Deferred to phase 3: checking skin texture keys exist at boot, once Thornwood's art exists. Rejected: removing `WorldDef`'s item, pickup, enemy and hazard names as unread; they are the logic-side names for anything that names things outside the engine skin, and cost nothing.
- 2026-11-23 main merged into the landing branch (a6b2d19) before phases 3 and 4 started: main had gained the reef-online lockstep groundwork and the reef-difficulty sprint (seats, local racer, world hash, catch-up, the no-inexact-math lint rule, now pointed at rush-racers logic). World-hash pins moved only because racers carry `status.fallen`; with it stripped they match main's. Phase 3 and 4 lanes start from a6b2d19 (`check-lane` base a6b2d19). `ce:builder` always runs in its own worktree cut from main, so lane setup renames that branch and hard-resets it to the landing branch.
- 2026-11-23 phase 5 briefs written: the scaffold lists Bramble Run and adds the course select step to `TITLE_TO_RACE`, since turning course select on changes every menu walk.
