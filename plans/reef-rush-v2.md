# Reef Rush v2: product spec

Status: spec, not started. Written 2026-11-22 from a play session. Hand to `deliver` to turn into phases and lanes.

## Problem

Playtesting found that Reef Rush is won by pressing kick every 0.6 s. Power-ups are hard to read and impossible to control. The target is the feel of a Mario Kart and Super Mario hybrid: you hold forward to reach par speed, skill and items win races, each item press fires one item you chose, and enemies are things you beat for a reward.

What the playtest found, and why:

| Report | Cause |
| --- | --- |
| Space has to be pressed constantly | Rivals swim with about 1.5x the player's force and kick cools down in 36 ticks, so kick-spam is the dominant strategy. |
| Can't choose an attack; Cannonball never happens | Burst fires the whole stack. Combos need a specific pair the player is never told about. |
| Power-ups never run out | Bursting doesn't consume them (except Undertow). |
| The second HUD slot always looks like it's reloading | That slot is the Burst button icon with its cooldown ring, drawn in the same row as the items. |
| Pearls do nothing | A 0.5 s boost with no HUD count or feedback. |
| Rarely get the Squid | Its clam weight is 0 in 1st place, and kick-spam keeps the player in 1st. |
| Rivals rarely attack | `itemAggression` is tuned to about 3 bursts per race. |
| Only jellies to fight | Hazards are urchins and jellies; nothing can be beaten for a reward. |
| A stunned racer ahead blocks you, and you shove it forward | `separateRacers` (`race/collide.ts`) separates every pair whatever their status. |
| The racer turns white and stays white | Bug, fixed separately: the racer view timed its place-up flash from the runtime's step tick but compared it to the world tick. |

## Decisions (user, 2026-11-22)

- Pair combos are dropped. Cannonball becomes its own item.
- The player holds three items and picks which one to fire with a swap button.
- Items have a limited number of uses.

## Experience

Controls:

| Action | Keyboard | Touch |
| --- | --- | --- |
| swim | Arrows, WASD | d-pad |
| use selected item, confirm | Space, Z, Enter | A |
| dash, back | X, Shift | B |
| select next item | Q / E (prev / next), Tab | tap the item box |

Swimming. Rivals swim at about the player's force, so holding forward is competitive. The catch-up band does the balancing that kick-spam does today.

Dash. This is the old kick, moved to B with a visible charge meter: 2 charges that refill over a few seconds. It still dodges a squid and shakes off a latch, and dashing into a weak enemy defeats it. A dash is something you save for the right moment.

Items. There are three slots, and the selected one is highlighted. Use fires only the selected item and spends one charge. The slot empties at 0 charges and the selection moves to the next held item. A new item fills the first empty slot. With all three slots full, opening a clam does nothing, and the clam stays open for the next racer. Being hit knocks out the selected item's remaining charges as a loose pickup.

| Item | Charges | Use |
| --- | --- | --- |
| Jet Fins | 3 | dash boost (the mushroom role) |
| Homing Squid | 1 (1st-2nd) / 3 (3rd-4th) | as today |
| Ink Sac | 3 | ink cloud behind |
| Bubble Shield | 1 | absorbs a hit; Use fires the trap bubble instead |
| Puffer | 2 | inflate: break coral, hit racers |
| Glow Lantern | 2 | stun flash |
| Riptide | 2 | current lane |
| Mimic | 1 | decoy |
| Undertow | 1 | as today, 3rd-4th only |
| Cannonball | 1 | long inflated dash through coral and racers, invulnerable; mostly 3rd-4th |

Passives move to the selected item only, or go away. Lane briefs should pick one; a passive tied to the selected item is the smaller change to explain.

Downed racers pass through. A racer that is stunned, trapped in a bubble or wrapped by a squid has no collision with other racers until it recovers. You swim straight through it and take the place, like passing a spun-out kart.

Pearls work like coins. Each pearl adds 1% top speed, capped at 10. A hit drops 3 as loose pearls. The HUD shows the count, and grabbing one plays a chime.

Enemies:
- Shark. Patrols a lane and charges a racer that comes within range. A dash bonk staggers it; two hits or one Squid knock it away for a pearl burst.
- Eel. Lunges out of a wall hole on a timer, telegraphed.
- Crab. Walks the floor. One dash bonk defeats it and drops a pearl.

Rivals use items like players do. With a target in reach they fire after a short reaction delay. When leading, they hold a defensive item behind them. Target 6 to 10 uses per rival per race on Normal. Easy keeps its rule that no rival item lands on the player.

HUD. An item box with three slots, the selected slot framed, and a charge count on each. A dash meter that doesn't look like an item. A pearl counter. The Burst icon leaves the item row.

## Success criteria

Measured with the existing bot harness in `logic/difficulty/`:
- On Normal, a bot that swims well and never dashes places top 3 in at least 60% of seeds. This tests whether mashing is still required.
- An expert bot that uses items and dashes wins clearly more often than the no-dash bot, so skill still pays.
- On Normal, each rival uses at least 5 items per race, and every item kind fires in at least one race across the seed set.
- A player who takes a downed rival's place is never pushed by that rival during the downed window (logic test).

## Phases

1. Controls and items: item box, charges, use and swap, dash on a meter, Cannonball as an item, combos removed. Rivals at par force, downed racers pass through. Re-measure the difficulty bars and re-record `TOP_ROUTE`. This phase alone answers most of the reports.
2. Pearls as coins, Squid weights by place, rival item aggression.
3. Enemies (shark, eel, crab) and dash bonk, placed in the course sections.
4. How to Play pages, hints, DESIGN.md, UI.md.

## Costs and risks

- Every difficulty bar, `TOP_ROUTE`, the rival item AI, How to Play, the hints and the power-up scenarios (`clam-stack`, `hit-pops-newest`, `cannonball-combo`) assume kick-spam and full-stack bursts. Rebalancing is most of phase 1.
- Combo code (`powerups/combos.ts`) and its views are removed.
- The save shape doesn't change. Settings and bests carry over.
- Out of scope: remappable keys, a second course.
