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
| a | L | games/reef-rush/src/, games/reef-rush/scenarios/, games/reef-rush/tests/, games/reef-rush/DESIGN.md, games/reef-rush/UI.md | plans/reef-rush-v2.md, this plan | | opus | running | v2-1a | check, smoke and the new tests pass |

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
Scaffold (me, on main after phase-1 tags): `Racer.kickCharges` and `Racer.kickRecharge` (createRacer sets `DASH_METER.charges`, 0); `LoosePearl { at: Vec; vel: Vec; age: number; droppedBy: RacerId }` and `World.loosePearls: LoosePearl[]`; events `{ type: 'pearls.dropped'; id; count }`, `{ type: 'loosePearl.collected'; id; total }` and `{ type: 'racer.dashRecharged'; id; charges }`; `summarize()` gains `dashCharges` and `toAscii` draws loose pearls as `o`; stubs `powerups/dash-meter.ts` (`DASH_METER = { charges: 2, rechargeTicks: 90 }`, `canDash(racer)`, `spendDash(world, racer)`, `rechargeDash(world, racer)`) and `pickups/pearls.ts` gains stubs `pearlSpeedMul(racer)`, `dropPearls(world, racer)`, `collectLoosePearls(world, racers)`, all no-ops with the final signatures, wired into stepWorld in their slots. The engine handles the new events where its unions are exhaustive. `TOP_ROUTE` is re-recorded by me at landing.
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
| a | M | games/reef-rush/src/logic/powerups/dash-meter.ts, games/reef-rush/src/logic/powerups/dash-meter.test.ts, games/reef-rush/src/logic/status.ts, games/reef-rush/src/logic/status.test.ts, games/reef-rush/src/logic/race/collide.ts, games/reef-rush/src/logic/race/collide.test.ts, games/reef-rush/src/logic/media/swim/pilot.ts, games/reef-rush/src/logic/media/swim/physics.ts, games/reef-rush/src/logic/world.ts, games/reef-rush/src/logic/world.test.ts | | | opus | pending | | dash meter and pass-through tests pass, check passes |
| b | M | games/reef-rush/src/logic/pickups/, games/reef-rush/src/logic/hazards/hits.ts, games/reef-rush/src/logic/hazards/hits.test.ts, games/reef-rush/src/logic/powerups/tuning.ts, games/reef-rush/src/logic/powerups/passives.ts, games/reef-rush/src/logic/powerups/passives.test.ts, games/reef-rush/src/logic/characters.ts, games/reef-rush/src/logic/characters.test.ts, games/reef-rush/src/logic/ai/items.ts, games/reef-rush/src/logic/ai/rival.test.ts | | | opus | pending | | pearl, squid weight, par force and aggression tests pass, check passes |
| c | M | games/reef-rush/src/engine/view/hud.ts, games/reef-rush/src/engine/view/hud-well.ts, games/reef-rush/src/engine/view/hud.test.ts, games/reef-rush/src/engine/view/pickup-view.ts, games/reef-rush/src/engine/audio/sfx.ts, games/reef-rush/src/engine/audio/sfx-pin.test.ts, games/reef-rush/src/engine/art/sprites/hud.ts, games/reef-rush/src/engine/art/ui/icons.ts, games/reef-rush/tests/hud.spec.ts | | | sonnet | pending | | HUD capture shows meter and counter, check passes |
| d | S | games/reef-rush/src/engine/runtime.ts, games/reef-rush/src/engine/runtime.test.ts, games/reef-rush/src/engine/menu.ts, games/reef-rush/src/engine/scenes/results.ts, games/reef-rush/src/engine/scenes/results-layout.ts, games/reef-rush/scenarios/change-character.ts, games/reef-rush/UI.md | | | sonnet | pending | | Results offers Character, which opens select on the current pick, so the next race runs as the new pick |

Shared for every phase 2 lane: read the Phase 2 test cases above and the Spec. Write tests for your cases through `createWorld`/`stepWorld` (logic) or the runtime and scenarios (engine), and watch each fail once. Touch only the files you own; if you need a change elsewhere, stop and report it. Don't tune to the `difficulty` project. Run `pnpm arcade test reef-rush <your paths>` and `pnpm arcade check reef-rush --skip-tests`, then `pnpm fix`, and commit on your branch.

#### Lane a brief

- Goal: the kick becomes a dash you save, and downed racers stop blocking.
- Behavior: implement `dash-meter.ts` (the stubs' signatures stay). `world.ts` gates `intent.kick` through `canDash` before the medium step for every medium, calls `spendDash` for each `racer.kicked` the tick emitted, and `rechargeDash` once per tick per racer in play. `pilot.ts` (swim AI) never kicks with 0 charges, and keeps one charge in reserve for a latch shake-off unless it is behind by more than 2 places. `status.ts` gains `isDowned(racer)` (stunned, trapped or latched > 0); `collide.ts` skips downed pairs as in the test cases. `physics.ts` only as needed for the gate (keep `kickCooldownTicks`).
- Out of scope: pearls, characters, HUD.

#### Lane b brief

- Goal: pearls work like coins, the Squid shows up when you're behind, rivals swim at par and use items often.
- Behavior: fill the pearl stubs in `pickups/pearls.ts` (tuning in `PEARL`: `speedPerPearl: 0.01`, `cap: 10`, `dropOnHit: 3`, `ownGraceTicks: 30`, `lifeTicks: 600`). `passives.ts` multiplies `forceMul` by `pearlSpeedMul`. `hits.ts` calls `dropPearls` when a hit lands. Clam weights in `tuning.ts`. `characters.ts`: rival `forceMul` into 0.95..1.10, keeping their order and personalities; raise `itemAggression` and change `ai/items.ts` (reaction delay from `reactionTicks`, defensive fire behind when leading) toward the 6-10 target, keeping the per-tick rng draw count fixed. Report the measured median uses per rival in your final message (run the difficulty bots once, read-only).
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

Demo: `pnpm arcade see reef-rush --query stage=enemies --query debug=1`: a shark charges, two dash bonks knock it away, and pearls burst out.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/reef-rush/src/logic/hazards/enemies/, games/reef-rush/src/logic/courses/sunlit-shallows.ts | | | opus | pending | | |
| b | M | games/reef-rush/src/engine/view/enemy-view.ts, games/reef-rush/src/engine/art/sprites/enemies.ts, games/reef-rush/src/engine/audio/enemy-sfx.ts | | | sonnet | pending | | |

(Briefs written while phase 2 runs.)

### Phase 4: balance and teach

Demo: `pnpm --filter game-reef-rush test:difficulty` passes the new bars; How to Play shows fire, swap, dash, charges and enemies.
Depends on: phase 3

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | games/reef-rush/src/logic/difficulty/, games/reef-rush/src/logic/ai/profiles.ts, games/reef-rush/src/logic/difficulty-level.ts, games/reef-rush/src/logic/difficulty-level.test.ts | | | opus | pending | | |
| b | M | games/reef-rush/src/engine/view/how-to-play/, games/reef-rush/src/engine/view/hints.ts, games/reef-rush/src/engine/view/hints.test.ts, games/reef-rush/DESIGN.md, games/reef-rush/UI.md | | | sonnet | pending | | |

(Briefs written while phase 3 runs.)

## Log

- 2026-11-22: phase 1 runs as one lane, not scaffold plus parallel lanes. The item model replaces `Racer.stack`, which about 40 files under `src/logic` and `src/engine` read. A scaffold can't change that type and still typecheck without doing the migration itself. Splitting logic and engine across lanes would leave each lane's tests failing at runtime until the other merged. The lane writes its own tests from the phase 1 test-case list; the lane review checks them against it.
- 2026-11-22 plan critique (opus): all 8 findings accepted. Phase 1 gets `dashSpeed` and dash-conflict rules, AI slot choice and Cannonball use with `pilot.ts`, `LoosePowerUp.charges` and the `summarize()` shape, same-tick cycle/use order and stun handling, clam fall-through for full racers, a staged Cannonball scenario, and fixed slots (spec said slots empty in place). Phase 2: `characters.ts` (par force and aggression numbers) belongs to one lane, and I re-record `TOP_ROUTE` at phase landing rather than in a lane. Phase 3's scaffold wires `World.enemies`, the stepWorld slot, types, events and level glyphs, so its lanes own only behavior and views. Applied when those phases are briefed. Accepted risk: rivals never cycle, so selected-only passives depend on their pickup order; phase 4 measures it.
- 2026-11-22: the white-racer tick bug was fixed and committed on main before the run (4d82050).
- 2026-11-22 playtest: no way to change character once picked. Select only opens from Title > Race, and results offers Race again and Title, so the race-again loop never shows a way out. Phase 2 lane d adds a Character option to the results menu that opens select (course select first while it is shown).
