# Plan: Reef Rush v2

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-22. Timebox: none. Landing branch: main.
Gate: `pnpm arcade check reef-rush && pnpm arcade smoke reef-rush` (about 25 s: check 9 s, smoke 14 s). Phase 4 adds `pnpm --filter game-reef-rush test:difficulty` back to the gate. Filtered tests: `pnpm arcade test reef-rush <paths or @groups>`. Typecheck and lint: `pnpm arcade check reef-rush --skip-tests`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --offline`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, todo: true
Manifests: package.json, pnpm-lock.yaml, pnpm-workspace.yaml

## Spec

Product spec: `plans/reef-rush-v2.md`. A playtest found Reef Rush is won by mashing kick, and that power-ups are unreadable and uncontrollable: Burst fires the whole stack, combos are hidden, nothing runs out. v2 changes it to Mario Kart rules. You swim at par with the rivals, fire one item you chose, items have charges, the kick becomes a metered dash, pearls work like coins, and enemies are things you beat. The player of the game is the user; the user plays on desktop keyboard and touch.

In scope (user decisions 2026-11-22): pair combos are dropped and Cannonball becomes its own item; three held items (Nib's ability keeps four) with a swap control; items have charges; downed racers (stunned, trapped, latched) don't collide, so you swim through them; everything else in `plans/reef-rush-v2.md`.

Out of scope: remappable keys, a second course, changes under `packages/`, save shape changes.

Assumptions (defaulted, the user can override):
- Passives apply only for the selected item, except that a Bubble Shield absorbs a hit from any slot. One rule to explain, and swapping matters.
- Player-facing names: the kick is called "dash" in the UI and controls (logic keeps the name `kick`, since every medium and conformance test uses it), and Jet Fins' use is a "boost".
- Keys: Space, Z, Enter fire (and confirm in menus); X, Shift dash (and back); Q previous item; E and Tab next item. Touch: A fire, B dash, a third button labelled `⇄` for next item. `@arcade/input` already supports up to four touch buttons.
- The difficulty bars (the `difficulty` Vitest project) measure the old game and are rewritten to the spec's success criteria in phase 4. Until then the gate is check plus smoke, and those bars are allowed to fail. `src/logic/fingerprint/` pinned old behaviour and is deleted in phase 1, as its header asks.
- `TOP_ROUTE` (`scenarios/kit.ts`) is re-recorded by whichever lane changes what it replays, so `top-route.test.ts` stays green in every phase.

Error model: logic stays total over valid state and throws only for programmer errors, as today. Using an item with an empty inventory, a cooldown running, or a `useSlot` past the end of the inventory does nothing and emits nothing (the AI and the player both press freely). A `cycle` with nothing held does nothing. `rollClam` keeps its existing `Error` for an impossible held set. Course data errors (an unknown enemy glyph, an enemy inside rock) throw `LevelError` from parsing or `Medium.validateLevel` with row and col, like every other glyph error.

## Contracts (scaffold commit)

Each phase's scaffold adds that phase's types. Phase 1's item model changes the `Racer` shape that about 40 files read, so phase 1 is one lane that changes the types along with their consumers instead of scaffolding them separately (see Log).

New and changed modules, with their single responsibilities:

    src/logic/
      types.ts                 HeldItem; Racer.items/selected/useCooldown; Intent.use/cycle/useSlot (phase 1)
      powerups/inventory.ts    holding items: gain, select/cycle, spend a charge, remove; never fires anything (phase 1, replaces stack.ts)
      powerups/use.ts          firing one item's effect, and the per-tick dash/inflate effects (phase 1, replaces burst.ts)
      powerups/charges.ts      how many charges a kind comes with, by place (phase 1)
      powerups/combos.ts       deleted (phase 1)
      powerups/dash-meter.ts   kick charges: gate a kick, spend on racer.kicked, recharge (phase 2)
      pickups/pearls.ts        pearl count as a capped top-speed bonus; hits drop pearls (phase 2)
      hazards/enemies/         one file per enemy kind plus index.ts dispatching by kind (phase 3)
    src/engine/
      input.ts                 actions fire, dash, prev, next (phase 1)
      view/hud.ts              item box: three slots, selected frame, charge digits (phase 1); dash meter, pearl count (phase 2)
      view/enemy-view.ts       enemy sprites and telegraphs (phase 3)

## Phases

### Phase 1: fire the item you choose (MVP)

Scaffold: ed80dfb
Tag: reef-rush-v2-phase-1
Demo: `pnpm arcade dev reef-rush`, race, open clams: Space fires only the framed item and its charge digit drops, Q/E move the frame, a Cannonball smashes the coral gate. `pnpm arcade see reef-rush --scenario cannonball-item`.
Test cases:
- Slots are fixed: `items` always has `stackMaxFor(racer)` entries (3, Nib 4), each a `HeldItem` or null, so held items never slide in the HUD.
- Gaining a kind gives it `chargesFor(kind, place)` charges (`CHARGES[kind]`; Homing Squid 1 when gained in 1st-2nd, 3 in 3rd-4th) in the first empty slot and emits `powerup.gained {id, kind, slot, charges}`; a held kind is never gained twice. Gaining into an empty inventory selects that slot.
- A racer whose slots are all full doesn't open a ready clam: the clam goes to the next overlapping racer in RACER_IDS order that can take it that tick, or stays ready. A full racer doesn't grab a loose item, and a loose item of a kind already held stays loose.
- `use` fires only the selected item: one effect, one charge spent, `item.used {id, kind, slot, chargesLeft}`, `useCooldown = USE_COOLDOWN_TICKS`; a second `use` during the cooldown does nothing.
- The last charge empties the slot (null) and emits `powerup.lost {cause: 'used'}`; the selection moves to the next held slot to the right, wrapping, and stays put when nothing is held.
- `cycle` +1/-1 moves the selection to the next or previous held slot, skipping empty ones and wrapping, and emits `item.selected {id, slot, kind}`. Nothing happens with 0 or 1 items held.
- In one tick `cycle` applies before `use`, so pressing both fires the newly selected item. `cycle` still works while stunned or trapped (`controlledIntent` keeps it), but `use`, `kick` and `move` don't.
- `useSlot` (AI) selects that slot and fires it in the same tick; a `useSlot` that is out of range or empty does nothing.
- Dash conflicts: Jet Fins and Cannonball do nothing (no charge spent, no event) while `status.dashing > 0`. Puffer extends inflation with `max`, never shortens it. `Racer.dashSpeed` holds the running dash's speed (DASH.speed for Jet Fins, CANNONBALL.speed for Cannonball), and `driveDash` reads it. A hit ends a Jet Fins dash as today; a Cannonball is invulnerable, so nothing ends it early.
- Per-kind use: Jet Fins boost (the old dash); Bubble Shield fires the trap bubble; Puffer inflates; Ink Sac drops one cloud; Glow Lantern flashes; Squid launches; Riptide lays the plain lane; Undertow pulls; Mimic spawns a plain decoy; Cannonball dashes `CANNONBALL.ticks` at `CANNONBALL.speed`, inflated and invulnerable for its whole length, breaking coral and hitting racers it touches.
- Passives come from the selected item only: Jet Fins' force and kick cooldown, Puffer's bump mass, Glow Lantern's pearl pull and dark sight, Riptide's current push, Mimic's squid range. Holding them unselected changes nothing.
- A hit with a Bubble Shield in any slot empties that slot (`shield.popped`). Otherwise it knocks the selected item and all its charges loose (`powerup.lost {cause: 'hit'}`, `loose.spawned {kind, charges}`; `LoosePowerUp` gains `charges`, `spawnLoose(world, kind, charges, at)`). Grabbing it gives that many charges. With nothing held the racer is stunned. The selection then moves as for a used-up item.
- No combo exists: no `ComboName`, no `burst.fired`, a Jet Fins boost with a Puffer held doesn't inflate.
- Rivals fire through `useSlot`, gated by the same one aggression roll per tick (so per-tick rng draws don't change). Slot choice: a Puffer or Cannonball when coral is just ahead (`pufferHasCoral`) comes first, then the first held slot whose kind has a use this tick, using today's uses. Cannonball's use is coral ahead or the Jet Fins clear-path test. `ITEM_USE.jetChanceMul` scales the roll only when the chosen slot is Jet Fins or Cannonball without coral ahead. `media/swim/pilot.ts` steers through coral when a Puffer or Cannonball is held in any slot and `useCooldown` is 0 (today it reads the stack and the burst cooldown).
- `summarize()` reports `items` as `(string | null)[]` (`'jetFin:3'` or null per slot) and `selected`, in place of `stack`; scenarios and `debugSummary` assert on that.
- Engine: Space fires, X dashes, Q/E/Tab cycle; menus confirm on fire and go back on dash; How to Play pages turn on fire/dash and right/left. HUD item row shows only items (no Burst icon): selected slot framed, a charge digit on each held item. Touch shows A, B and `⇄`.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/, games/reef-rush/scenarios/, games/reef-rush/tests/, games/reef-rush/DESIGN.md, games/reef-rush/UI.md | plans/reef-rush-v2.md, this plan | | opus | merged | v2-1a | check, smoke and the new tests pass |

#### Lane a brief

- Goal: replace the burst-everything stack with an inventory of up to three items (Nib four) that each carry charges. The player picks one and fires it. Cannonball becomes an item and every pair combo is removed. Rewire the controls (fire, dash, prev, next) and make the HUD show the inventory, so the game plays the new way end to end.
- Interface:
  - `types.ts`: `PowerUpKind` gains `'cannonball'` (and `POWER_UP_KINDS`); `interface HeldItem { kind: PowerUpKind; charges: number }`; `Racer.stack` becomes `items: (HeldItem | null)[]` (fixed slots), plus `selected: number` and `dashSpeed: number`; `burstCooldown` becomes `useCooldown`; `dashCombos` and `ComboName` are removed; `LoosePowerUp` gains `charges`. `Intent.burst` becomes `use: boolean`, plus `cycle: -1 | 0 | 1` and `useSlot?: number`.
  - `events.ts`: `burst.fired` becomes `{ type: 'item.used'; id; kind; slot; chargesLeft }`; add `{ type: 'item.selected'; id; slot; kind }`; `powerup.gained` carries `slot` and `charges`, `loose.spawned` and `loose.grabbed` carry `charges`; `powerup.lost` causes are `'hit' | 'used'`.
  - `powerups/inventory.ts` (from `stack.ts`): `gainItem(world, racer, kind, charges): boolean`, `cycleSelection(world, racer, step)`, `spendCharge(world, racer, slot)`, `knockForHit(world, racer): HeldItem | null`, `selectedItem(racer): HeldItem | null`, `heldItems(racer): HeldItem[]`, `holds(racer, kind): boolean`, `inventoryFull(racer): boolean`. Other modules read the inventory only through these.
  - `powerups/charges.ts`: `CHARGES: Record<PowerUpKind, number>` and `chargesFor(kind, place): number`.
  - `powerups/use.ts` (from `burst.ts`): `useItems(world, racers, intents)`, `fireItem(world, racer, slot, move): boolean`, `driveDash`, `sustainItems`.
  - `powerups/tuning.ts`: `USE_COOLDOWN_TICKS = 20`; `CANNONBALL = { ticks: 75, speed }` (speed 1.25x `DASH.speed`); clam weights gain `cannonball` (first 0, last 2); `COMBO_PAIRS` removed.
- Behavior: the phase 1 test-case list above. Charges: jetFin 3, homingSquid 1 or 3 by place, inkSac 3, bubbleShield 1, puffer 2, glowLantern 2, riptide 2, mimic 1, undertow 1, cannonball 1. Remove every combo branch: seeking bubbles, inked squids, bubbled decoys, the surfline lane, ink trail, ink bomb, comet. In the engine, remove the combo caption, the combo sounds and the combo threat visuals.
- Engine: `input.ts` actions `fire` (Space, KeyZ, Enter; touch A), `dash` (KeyX, Shift; touch B), `prev` (KeyQ), `next` (KeyE, Tab; touch `⇄`). In `runtime.ts`, a fire press gives `use`, a dash press gives `kick`/`kickHeld`, and prev/next give `cycle`. Menus, select, course select and How to Play read fire where they read kick and dash where they read burst. HUD well: a dash icon (the old kick icon, dim while recharging), then one slot per inventory place. A held item shows its icon, a 1-digit charge count in the HUD font at the slot's lower right, and a 1 px gold frame on the selected slot; the Burst icon and its ring are gone. Hints: PRESS B! becomes the fire prompt (Space key cap on keyboard, A on touch). The touch fire button shows the selected item's icon (`burst-button.ts`). `debug-stage.ts`: replace any combo stage, add `cannonball`. Rename sounds and views that key on `burst.fired` to `item.used`. Update the How to Play burst page's text and art so it no longer claims everything fires at once (phase 4 redraws the pages; for now it just mustn't be wrong).
- Also owns `src/logic/media/swim/pilot.ts` (coral steering above) and `src/logic/ai/items.ts`.
- Tests: rewrite the logic tests for stack, burst, combos, passives, hits, loose, clams and AI to the new rules (combos.test.ts goes). Add tests for every case above through `createWorld`/`stepWorld` or the module functions. Rename the scenarios `cannonball-combo` to `cannonball-item` (staged through a `cannonball` debug stage and the scenario launch params, never a hunted seed, per `.claude/rules/game-tests.md`) and `hit-pops-newest` to `hit-drops-selected`. Update every scenario and spec that taps `kick`/`burst`. Re-record `TOP_ROUTE` if the replay breaks, and keep `top-route.test.ts` green. Keep the difficulty bars and bots (`src/logic/difficulty/`) compiling and adapted to `use`/`useSlot`, but don't tune to them.
- Decisions already made: see Spec assumptions (selected-only passives, shield from any slot, key map, names). Rival item uses and aggression numbers stay as today; phase 2 tunes them.
- Out of scope: the dash meter, par-speed rivals, pass-through, pearls as coins, squid weights and rival aggression (all phase 2), enemies, How to Play redraw, difficulty bar tuning. No change under `packages/`, no save change.
- Done when: `pnpm arcade check reef-rush` and `pnpm arcade smoke reef-rush` pass, `pnpm arcade see reef-rush --scenario cannonball-item` shows the gate breaking, and DESIGN.md's Controls and Power-ups sections describe the new rules (no combos).

### Phase 2: race at par, dash on a meter, pearls that matter

Demo: `pnpm arcade dev reef-rush`: holding forward keeps pace with the rivals. The HUD dash meter empties after two dashes and refills. Pearls count up and raise speed, a hit scatters them. A stunned rival ahead is swum through. Rivals fire items often. Results offers Character.
Depends on: phase 1
Scaffold: 1a026d9
Tag: reef-rush-v2-phase-2
Scaffold contents (me, on main after phase-1 tags): `Racer.kickCharges` and `Racer.kickRecharge` (createRacer sets `DASH_METER.charges`, 0); `LoosePearl { at: Vec; vel: Vec; age: number; droppedBy: RacerId }` and `World.loosePearls: LoosePearl[]`; events `{ type: 'pearls.dropped'; id; count }`, `{ type: 'loosePearl.collected'; id; total }` and `{ type: 'racer.dashRecharged'; id; charges }`; `summarize()` gains `dashCharges` and `toAscii` draws loose pearls as `o`; stubs `powerups/dash-meter.ts` (`DASH_METER = { charges: 2, rechargeTicks: 90 }`, `canDash(racer)`, `spendDash(world, racer)`, `rechargeDash(world, racer)`) and `pickups/pearls.ts` gains stubs `pearlSpeedMul(racer)`, `dropPearls(world, racer)`, `collectLoosePearls(world, racers)`, all no-ops with the final signatures, wired into stepWorld in their slots. The engine handles the new events where its unions are exhaustive. `TOP_ROUTE` is re-recorded by me at landing.
Test cases:
- Dash meter: a racer starts with 2 dash charges. A kick spends one; with 0 charges a kick intent does nothing (no `racer.kicked`, no impulse). One charge comes back every `DASH_METER.rechargeTicks` while below the cap, emitting `racer.dashRecharged`. The short gap between kicks (`kickCooldownTicks`) still applies. Rivals obey the same meter (the pilot never kicks with 0 charges). Kicks that shake off a latch still spend a charge.
- Pass-through: while either racer of a pair is stunned, trapped or latched, `separateRacers` neither pushes them apart nor reports a bump (no `racer.bumped`, no puffer/cannonball hit from that contact). The pair's contact key is cleared, so a contact that resumes after recovery counts as a new bump. Logic test: the player swims into a stunned rival ahead and passes it, taking the place, and the rival's position never moves from the contact during the stun.
- Par force: every rival's `forceMul` is within 0.95..1.10 of the player's (ordering between characters kept). With the player holding forward and never dashing on Normal, the swim catch-up band keeps the pack together (checked in phase 4's bars; here a logic test that a no-dash player on seed 1 finishes within 3 s of the winner).
- Pearls: each collected pearl (level or loose) adds 1, and `pearlSpeedMul(racer)` = 1 + 0.01 * min(pearls, 10) multiplies swim force. Collecting still gives the short `PEARL.boostTicks` boost. A hit that lands (not absorbed by a shield) drops `min(3, pearls)` pearls as `LoosePearl`s scattered from the racer, emits `pearls.dropped`, and lowers the count. The dropper can't collect its own loose pearls for 30 ticks; anyone else can at once. Loose pearls settle with drag, never enter rock, and vanish after 600 ticks.
- Squid weights: clam weights for `homingSquid` are 1 at 1st and 4 at last (from 0 and 3).
- Rival aggression: rivals fire on a usable target after `reactionTicks`, and a leading rival with an Ink Sac, Bubble Shield or Mimic fires it behind when a racer is within 4 tiles. On Normal, the median rival uses 6-10 items per race over seeds 1-20 (a `difficulty`-project measurement, run once by lane b and reported, not gated). Easy keeps `mayAttack`'s rule that no rival item targets the player.
- Results offers Race again, Character, Title. Character opens course select when it is shown, else select, with the cursor on the current pick; the next race runs as the new pick.
- HUD: a dash meter of two pips beside the item well, dim while spent, that fills back in as charges return; it never looks like an item slot. A pearl counter (pearl icon and a 2-digit count) in the HUD. Collecting a pearl plays a chime; a drop plays a scatter sound. Loose pearls render as pearls.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/powerups/dash-meter.ts, games/reef-rush/src/logic/powerups/dash-meter.test.ts, games/reef-rush/src/logic/status.ts, games/reef-rush/src/logic/status.test.ts, games/reef-rush/src/logic/race/collide.ts, games/reef-rush/src/logic/race/collide.test.ts, games/reef-rush/src/logic/hazards/contacts.ts, games/reef-rush/src/logic/hazards/contacts.test.ts, games/reef-rush/src/logic/media/swim/pilot.ts, games/reef-rush/src/logic/media/swim/physics.ts, games/reef-rush/src/logic/world.ts, games/reef-rush/src/logic/world.test.ts, games/reef-rush/src/logic/abilities.test.ts, games/reef-rush/src/logic/powerups/use.test.ts | | | opus | merged | v2-2a | dash meter and pass-through tests pass, check passes |
| b | M | games/reef-rush/src/logic/pickups/, games/reef-rush/src/logic/hazards/hits.ts, games/reef-rush/src/logic/hazards/hits.test.ts, games/reef-rush/src/logic/powerups/tuning.ts, games/reef-rush/src/logic/powerups/passives.ts, games/reef-rush/src/logic/powerups/passives.test.ts, games/reef-rush/src/logic/characters.ts, games/reef-rush/src/logic/characters.test.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/ai/rival.test.ts | | | opus | merged | v2-2b | pearl, squid weight, par force and aggression tests pass, check passes |
| c | M | games/reef-rush/src/engine/view/hud.ts, games/reef-rush/src/engine/view/hud-well.ts, games/reef-rush/src/engine/view/hint-view.ts, games/reef-rush/src/engine/scenes/race.ts, games/reef-rush/src/engine/view/hud.test.ts, games/reef-rush/src/engine/view/pickup-view.ts, games/reef-rush/src/engine/audio/sfx.ts, games/reef-rush/src/engine/audio/adapter.ts, games/reef-rush/src/engine/audio/sfx-pin.test.ts, games/reef-rush/src/engine/art/sprites/hud.ts, games/reef-rush/src/engine/art/ui/icons.ts, games/reef-rush/tests/hud.spec.ts | | | sonnet | merged | v2-2c | HUD capture shows meter and counter, check passes |
| d | S | games/reef-rush/src/engine/runtime.ts, games/reef-rush/src/engine/runtime.test.ts, games/reef-rush/src/engine/menu.ts, games/reef-rush/src/engine/scenes/results.ts, games/reef-rush/src/engine/scenes/results-layout.ts, games/reef-rush/scenarios/change-character.ts, games/reef-rush/src/engine/view/menu-view.ts, games/reef-rush/scenarios/results-to-title.ts, games/reef-rush/scenarios/results-after-finish.ts, games/reef-rush/scenarios/results-ignores-early-kick.ts, games/reef-rush/tests/smoke.spec.ts, games/reef-rush/UI.md, games/reef-rush/DESIGN.md | | | sonnet | merged | v2-2d | Results offers Character, which opens select on the current pick, so the next race runs as the new pick |

Shared for every phase 2 lane: read the Phase 2 test cases above and the Spec. Write tests for your cases through `createWorld`/`stepWorld` (logic) or the runtime and scenarios (engine), and watch each fail once. Touch only the files you own; if you need a change elsewhere, stop and report it. Don't tune to the `difficulty` project. Run `pnpm arcade test reef-rush <your paths>` and `pnpm arcade check reef-rush --skip-tests`, then `pnpm fix`, and commit on your branch.

#### Lane a brief

- Goal: the kick becomes a dash you save, and downed racers stop blocking.
- Behavior: implement `dash-meter.ts` (the stubs' signatures stay). `world.ts` gates `intent.kick` through `canDash` before the medium step for every medium, calls `spendDash` for each `racer.kicked` the tick emitted, and `rechargeDash` once per tick per racer in play. `pilot.ts` (swim AI) never kicks with 0 charges, and keeps one charge in reserve for a latch shake-off unless it is behind by more than 2 places. `status.ts` gains `isDowned(racer)` (stunned, trapped or latched > 0); `collide.ts` skips downed pairs as in the test cases, and `hazards/contacts.ts`'s puffer/cannonball overlap loop skips a pair when either racer is downed. `physics.ts` only as needed for the gate (keep `kickCooldownTicks`).
- Out of scope: pearls, characters, HUD.

#### Lane b brief

- Goal: pearls work like coins, the Squid shows up when you're behind, rivals swim at par and use items often.
- Behavior: fill the pearl stubs in `pickups/pearls.ts` (tuning in `PEARL`: `speedPerPearl: 0.01`, `cap: 10`, `dropOnHit: 3`, `ownGraceTicks: 30`, `lifeTicks: 600`). `passives.ts` multiplies `forceMul` by `pearlSpeedMul`. `applyHit` returns the hit's outcome after the phase 1 boundary fixes; call `dropPearls` there when it isn't `'absorbed'`. Clam weights in `tuning.ts`. `characters.ts`: rival `forceMul` into 0.95..1.10, keeping their order and personalities; raise `itemAggression` and change `ai/items.ts` (reaction delay from `reactionTicks`, defensive fire behind when leading) toward the 6-10 target, keeping the per-tick rng draw count fixed. Report the measured median uses per rival in your final message (run the difficulty bots once, read-only).
- Out of scope: dash meter, collide, HUD, the difficulty bars themselves.

#### Lane c brief

- Goal: the HUD shows the dash meter and pearl count, and pearls sound and look like they matter.
- Behavior: two dash pips after the dash icon in the well (or replace the icon's dim state with them), filled per `kickCharges`, with a short fill animation on `racer.dashRecharged` (none under reduced motion). A pearl counter (icon plus count, capped display at 99) placed per UI.md's HUD layout, updated from `racer.pearls`. A chime on the player's `pearl.collected` and `loosePearl.collected`, a scatter sound on the player's `pearls.dropped`; re-count `sfx-pin.test.ts`. `pickup-view.ts` draws `world.loosePearls` with the pearl sprite. Note new rects for phase 4 to put in UI.md (in your report).
- Out of scope: results screen, logic.

#### Lane d brief

- Goal: a player can change character after racing.
- Behavior: `MENU_OPTIONS.results` becomes Race again, Character, Title. Character goes to `course` when `courseSelectShown`, else `select`; the select screen's cursor starts on the current pick (today `entered('select')` resets it to the saved pick, which is the same thing after a race). Fit three buttons in the results layout without overlapping the ribbon (shrink the pitch or move the buttons; update UI.md's Results table and sketch). Scenario `change-character`: race, finish (use an existing short stage or debug finish), pick Character, move, confirm, and assert the next race's `character`. A runtime test for the menu path.
- Out of scope: HUD, logic.

### Phase 3: enemies you beat

Demo: `pnpm arcade see reef-rush --query scene=race --query stage=enemies`: a shark winds up and charges, a dash bonk staggers it and a second knocks it away in a burst of pearls; a crab is beaten with one bonk. `pnpm arcade see reef-rush --scenario enemy-bonk`.
Depends on: phase 2
Scaffold: 6c597c8
Tag: reef-rush-v2-phase-3
Scaffold contents (me): `EnemyKind` ('shark' | 'eel' | 'crab', `ENEMY_KINDS`), `EnemyMode`, `Enemy` (kind, home tile, `at` px centre, `vel`, facing, mode, modeTicks, hp, target), `Level.enemies` from glyphs `S` `E` `K` (water underneath), `World.enemies` built by `createEnemies` (`hazards/enemies/index.ts`, hp 1, patrolling), `HitCause` gains the enemy kinds, `RacerStatus.bonking` (set to `ENEMY.bonkTicks` = 12 on every kick, where the dash charge is spent), `LoosePearl.droppedBy` may be null (an enemy's burst), events `enemy.telegraphed {index, kind}`, `enemy.charged {index, kind, target}`, `enemy.bonked {index, kind, by, hpLeft}`, `enemy.defeated {index, kind, by}`, `pearls.burst {index, count}`; `stepEnemies(world, racers)` is a no-op stub in the stepWorld slot after the jellies; `toAscii` draws live enemies as `S` `E` `K`. `TOP_ROUTE` is re-recorded by me at landing.
Test cases:
- Bonk: a racer touching a live enemy while `status.bonking > 0`, `status.dashing > 0` (Jet Fins, Cannonball) or `status.inflated > 0` (Puffer) bonks it and takes no hit; otherwise a touching racer that is not invulnerable or downed takes `applyHit` with the enemy's kind as cause. One bonk per racer per contact (a long dash through a shark bonks it once). Hidden eels and defeated enemies touch nothing.
- Shark (hp 2): patrols left and right within `patrolTiles` of home. A racer (not downed, not invulnerable) within `sightTiles` ahead of it in its facing, with a clear sweep, starts a `windupTicks` wind-up (`enemy.telegraphed`), then it charges straight at that racer's position at wind-up end at `chargeSpeed` for `chargeTicks` (`enemy.charged`), stopped by rock, then patrols again after `recoverTicks`. A bonk staggers it (`stagger` for `staggerTicks`, knocked back along the bonk, can't hurt anyone) and costs 1 hp (`enemy.bonked`); at 0 hp it is defeated (`enemy.defeated`) and bursts `sharkPearls` (5) loose pearls (`pearls.burst`). A Homing Squid that touches a live shark defeats it outright (and is spent). On Easy a shark never winds up on the player.
- Eel (hp 1): placed on a water tile with rock on at least one orthogonal side (else `LevelError` with row and col from `createEnemies`); hides in that wall and every `cycleTicks` shows `telegraphTicks` of warning (`enemy.telegraphed`) and then lunges `lungeTiles` straight out of the wall and back. Only while it is out can it hit or be bonked. Defeated by one bonk: bursts 2 pearls.
- Crab (hp 1): placed with rock directly below (else `LevelError`); walks the floor back and forth at `walkSpeed`, turning at rock or a drop. Touching it hits (cause 'crab'). One bonk defeats it: bursts 1 pearl.
- Defeated enemies stay defeated for the race. All enemy motion is deterministic (no rng), and per-tick AI rng draws don't change.
- Rivals steer around live sharks, out eels and crabs as they do around jellies (`ai/avoid.ts`), and a rival with a dash charge about to touch a crab or an out eel dashes into it.
- Course: Sunlit Shallows gets 2 sharks, 3 eels and 4 crabs placed in its sections after column 60 (so start-area scenarios are unchanged), each where it fits the section; `toAscii` shows them.
- Engine: each enemy is drawn by kind and mode: the shark's wind-up has a clear tell (a flash and a `!` above it, 0.5 s), the eel's warning shows eyes and bubbles in the wall hole, the crab walks; a bonk squashes the enemy and plays a bonk sound; a defeat pops it with the pearls flying out (reduced motion: no squash or flight, just the pop). Enemy sounds through the audio adapter; sfx pin re-counted at landing by me. A debug stage `enemies` puts a shark and a crab just ahead of the player for the demo, and a scenario `enemy-bonk` beats the crab with a dash and asserts `enemy.defeated` and `pearls.burst`.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/logic/hazards/enemies/, games/reef-rush/src/logic/hazards/squids.ts, games/reef-rush/src/logic/hazards/squids.test.ts, games/reef-rush/src/logic/ai/avoid.ts, games/reef-rush/src/logic/ai/avoid.test.ts, games/reef-rush/src/logic/ai/rival.ts, games/reef-rush/src/logic/courses/sunlit-shallows.ts, games/reef-rush/src/logic/world.test.ts | | | opus | merged | v2-3a | every logic test case above passes, check passes |
| b | M | games/reef-rush/src/engine/view/enemy-view.ts, games/reef-rush/src/engine/view/enemy-view.test.ts, games/reef-rush/src/engine/view/enemy-look.ts, games/reef-rush/src/engine/view/enemy-look.test.ts, games/reef-rush/src/engine/runtime.ts, games/reef-rush/src/engine/audio/index.ts, games/reef-rush/src/engine/audio/adapter.test.ts, games/reef-rush/src/engine/art/sprites/enemies.ts, games/reef-rush/src/engine/art/sprites/index.ts, games/reef-rush/src/engine/art/sprites/sprites.test.ts, games/reef-rush/src/engine/art/keys.ts, games/reef-rush/src/engine/art/index.test.ts, games/reef-rush/src/engine/audio/sfx.ts, games/reef-rush/src/engine/audio/adapter.ts, games/reef-rush/src/engine/scenes/race.ts, games/reef-rush/src/engine/debug-stage.ts, games/reef-rush/src/engine/debug-stage.test.ts, games/reef-rush/scenarios/enemy-bonk.ts | | | opus | merged | v2-3b | captures show each enemy and mode, check passes |

Shared for every phase 3 lane: read the Spec, the scaffold contents and the Phase 3 test cases above. Touch only the files you own; if you need a change elsewhere, stop and report it. Lane a may also change the `Enemy`/`EnemyMode` declarations in `types.ts` if a kind needs a field (no other `types.ts` change); say so in the report. Logic stays deterministic. Don't tune to the `difficulty` project. If `TOP_ROUTE` breaks, report it. Run `pnpm arcade test reef-rush <your paths>` and `pnpm arcade check reef-rush --skip-tests`, then `pnpm fix`, and commit on your branch.

#### Lane a brief

- Goal: sharks, eels and crabs that a racer beats with a dash bonk, placed on the course.
- Behavior: the logic test cases above. One file per kind in `hazards/enemies/` (`shark.ts`, `eel.ts`, `crab.ts`), plus `contact.ts` for the shared touch/bonk/hit rule and `tuning.ts` for every number; `index.ts` dispatches by kind and keeps `createEnemies`' signature (it may now throw `LevelError` for a misplaced eel or crab). Pearl bursts use `scatterPearls` from `pickups/pearl-drift.ts` with `droppedBy: null` (read-only use; that file isn't yours). Squid contact with a shark in `squids.ts`. Rival avoidance and bonk-dash in `ai/avoid.ts` / `ai/rival.ts`, keeping the per-tick rng draw count. Place the course's enemies in `sunlit-shallows.ts`.
- Out of scope: drawing, sound, the debug stage.

#### Lane b brief

- Goal: enemies look and sound like Mario-style foes, and a demo stage shows them.
- Behavior: the Engine test case above. Draw from `world.enemies` and the enemy events; pool sprites (no per-frame create/destroy). Art in `art/sprites/enemies.ts` in the existing sprite style (read how `art/sprites/` builds the jelly and urchin). Sounds for `enemy.telegraphed` (shark and eel), `enemy.bonked`, `enemy.defeated` and an enemy hit on the player, through `adapter.ts`. `debug-stage.ts`: an `enemies` stage placing a shark about 6 tiles ahead of the player facing it and a crab on the floor 3 tiles ahead (build them with `createEnemies` on a level copy or push `Enemy` objects; the logic for their behavior lands with lane a in parallel, so verify the view with hand-set modes in `enemy-view.test.ts` and captures). `scenarios/enemy-bonk.ts` from the `enemies` stage: swim to the crab, dash into it, assert `enemy.defeated` and `pearls.burst` (it will pass only once lane a lands; I run it at landing).
- Out of scope: enemy behavior, course placement.

### Phase 4: balance and teach

Demo: `pnpm --filter game-reef-rush test:difficulty` passes the new bars; How to Play shows fire and swap, charges, the dash meter, pearls and enemies.
Depends on: phase 3
Scaffold: none (no shared types; the lanes' files don't overlap). After landing, the gate adds `pnpm --filter game-reef-rush test:difficulty` (about 42 s).
Test cases:
- The `difficulty` project measures v2 (spec success criteria): on Normal over a fixed seed set, a bot that swims well and never dashes or fires places top 3 in at least 60% of seeds; an expert bot that dashes and fires wins clearly more often than that no-dash bot (state the margin in the bar); each rival's median item uses per race on Normal is at least 5 and every item kind fires in at least one race across the set; the existing per-character Hard expert/novice bars and the Easy toddler bar are kept, re-banded to v2 (the expert-wins band, the novice bands and the par band), with each band's numbers measured and written in the test's doc comment.
- Par: Sunlit Shallows' `parTicks` is re-measured (a good expert race now runs about 105 s on Hard) and the sanity bar (`difficulty/sanity/bars.test.ts`, in the unit gate) gets its par-band check back.
- Rival item supply: reach the 5-per-race median through supply, not by clams reopening faster than 1.5 s: e.g. more clams in the course sections where the pack runs, or more charges per item for rivals, or a clam giving a rival two rolls. Clam camping stays impossible (a clam still shuts 90 ticks for everyone after opening).
- How to Play is accurate for v2 and fits on 320x180: swim, and dash on a meter of two (DASH pips refill); open clams, hold three, charge digits; fire the framed item and swap with Q/E (⇄ on touch); pearls count up and add speed, a hit scatters them; enemies: dash into them to bonk (shark twice), and what each one does. Pages turn as today; `HOW_TO_PLAY_PAGES` grows if needed, with the runtime test and how-to-play scenario updated.
- Hints: on the first race and every Easy race, a SWAP prompt (`[E]`/`⇄`) shows once when the player first holds two items; the existing fire prompt stays. Never more than one hint on screen at a time.
- UI.md: the HUD rects from phase 2 (dash meter, pearl counter, fire glyph at x 201, Nib's 217; confirm with a Nib capture that the Space keycap clears the back link, else move it), enemies' layering, and the new How to Play pages. DESIGN.md: balance numbers from lane a's report and the new pages.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/logic/difficulty/, games/reef-rush/src/logic/ai/profiles.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/ai/rival.test.ts, games/reef-rush/src/logic/difficulty-level.ts, games/reef-rush/src/logic/difficulty-level.test.ts, games/reef-rush/src/logic/characters.ts, games/reef-rush/src/logic/characters.test.ts, games/reef-rush/src/logic/courses/sunlit-shallows.ts, games/reef-rush/src/logic/courses/index.test.ts, games/reef-rush/src/logic/powerups/tuning.ts, games/reef-rush/src/logic/powerups/charges.ts, games/reef-rush/src/logic/powerups/charges.test.ts, games/reef-rush/src/logic/pickups/clams.ts, games/reef-rush/src/logic/pickups/clams.test.ts | | | opus | running | v2-4a | `test:difficulty` passes, check passes |
| b | M | games/reef-rush/src/engine/view/how-to-play/, games/reef-rush/src/engine/how-to-play.ts, games/reef-rush/src/engine/how-to-play.test.ts, games/reef-rush/src/engine/view/hints.ts, games/reef-rush/src/engine/view/hints.test.ts, games/reef-rush/src/engine/view/hint-view.ts, games/reef-rush/src/engine/view/control-glyphs.ts, games/reef-rush/src/engine/view/control-glyphs.test.ts, games/reef-rush/src/engine/art/font.ts, games/reef-rush/scenarios/how-to-play.ts, games/reef-rush/scenarios/first-race-hint.ts, games/reef-rush/tests/hints.spec.ts, games/reef-rush/DESIGN.md, games/reef-rush/UI.md | | | opus | merged | v2-4b | captures of every page and the swap hint, check and smoke pass |

Shared for every phase 4 lane: read the Spec, `plans/reef-rush-v2.md` and the Phase 4 test cases above, plus the Log for what earlier phases measured. Touch only the files you own; if you need a change elsewhere, stop and report it. Run `pnpm arcade test reef-rush <your paths>` and `pnpm arcade check reef-rush --skip-tests`, then `pnpm fix`, and commit on your branch.

#### Lane a brief

- Goal: the bars measure the v2 game, and the game passes them: holding forward competes, skill still pays, rivals use items a lot.
- Behavior: rewrite and re-band `src/logic/difficulty/` per the test cases (add the no-dash bot to `ai/profiles.ts` / the bot harness; add the item-use bar as its own test file so it runs in parallel). Tune only through rival profiles, difficulty-level knobs, clam supply and charges, and the course's clams and par; keep the per-tick AI rng draw count fixed and logic deterministic. If tuning moves clams or the course, `TOP_ROUTE` will break: report it, I re-record. Report every band and measured number in your final message for DESIGN.md.
- Out of scope: engine, docs.

#### Lane b brief

- Goal: a new player learns v2 from How to Play and the hints, and the docs match the game.
- Behavior: redraw the How to Play pages per the test case in the existing page style (`view/how-to-play/kit.ts`), reusing the game's sprites (HUD well, dash pips, pearl counter, enemies from `art/sprites/enemies.ts`). Add the SWAP hint. Update UI.md and DESIGN.md as in the test cases; take balance numbers for DESIGN.md from the plan Log (lane a's numbers are added at landing by me). Look at a capture of every page (`pnpm arcade see reef-rush --scenario how-to-play` or `--query scene=howToPlay` with input to turn pages) and of the swap hint, on desktop and `--mobile`.
- Out of scope: balance, logic.

## Log

- 2026-11-22: phase 1 runs as one lane, not scaffold plus parallel lanes. The item model replaces `Racer.stack`, which about 40 files under `src/logic` and `src/engine` read. A scaffold can't change that type and still typecheck without doing the migration itself. Splitting logic and engine across lanes would leave each lane's tests failing at runtime until the other merged. The lane writes its own tests from the phase 1 test-case list; the lane review checks them against it.
- 2026-11-22 plan critique (opus): all 8 findings accepted. Phase 1 gets `dashSpeed` and dash-conflict rules, AI slot choice and Cannonball use with `pilot.ts`, `LoosePowerUp.charges` and the `summarize()` shape, same-tick cycle/use order and stun handling, clam fall-through for full racers, a staged Cannonball scenario, and fixed slots (spec said slots empty in place). Phase 2: `characters.ts` (par force and aggression numbers) belongs to one lane, and I re-record `TOP_ROUTE` at phase landing rather than in a lane. Phase 3's scaffold wires `World.enemies`, the stepWorld slot, types, events and level glyphs, so its lanes own only behavior and views. Applied when those phases are briefed. Accepted risk: rivals never cycle, so selected-only passives depend on their pickup order; phase 4 measures it.
- 2026-11-22: the white-racer tick bug was fixed and committed on main before the run (4d82050).
- 2026-11-22 playtest: no way to change character once picked. Select only opens from Title > Race, and results offers Race again and Title, so the race-again loop never shows a way out. Phase 2 lane d adds a Character option to the results menu that opens select (course select first while it is shown).
- 2026-11-22 lane review 1/a: two rival slot-choice bugs fixed on the lane (dash items picked mid-dash; Jet Fins unscaled near coral). Phase 1 boundary review: 5 findings, all accepted. Pass-through needs `hazards/contacts.ts` in phase 2 lane a (plan changed); shield pop split from knock with a hit outcome; inventory accessors used everywhere; Cannonball gets its own status instead of `invulnerable`; one `canFire` and one coral-breaker list.
- 2026-11-22 lane 2/c: the fire hint glyph moved right of the pearl counter (x 201, Nib 217). With Nib on keyboard its Space keycap may reach the HTML back link (x 248, y 0-26); phase 4 lane b checks it when it redoes hints and UI.md.
- 2026-11-22 phase 2 landing (me): 2/b's median rival uses on Normal is 4 (target 6-10), limited by clam supply once clams shut for 1.5 s (2/b had cut it to 0.5 s, which allowed clam camping; review reverted to 90 ticks). Phase 4 lane a owns closing that gap (clam count/placement or charges), measured in the new bars. Integration fixes on main: Easy `rivalForceMul` 0.65 -> 0.85 (0.65 was tuned for 1.45x rivals); `HAZARD_AVOID.jellyReachPx` 16 -> 24 (par-speed rivals reached a bobbing jelly on 2 of 12 seeds; the test now runs 12 seeds); the sanity bar drops its par band until phase 4 sets the new par (races now run about 105 s on Hard, everyone within 1-2.5 s); `TOP_ROUTE` re-recorded by driving `Medium.aimFrom` snapped to 8 directions (579-tick margin); sfx pin re-counted; `hit-drops-selected` run-up 80 -> 95 ticks; DESIGN.md covers the dash meter, par rivals, pass-through, pearls and 1.5 s clams.
