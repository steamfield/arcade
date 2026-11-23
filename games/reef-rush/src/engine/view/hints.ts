/**
 * The in-race hints for young players, as pure functions of the world plus a small memory of what
 * the player has already learned this race. Nothing here draws: `hint-view.ts` shows what these
 * say, and the runtime keeps the latest answer so tests can read it.
 *
 * Five hints, each a picture-first prompt (see UI.md "Hints"), and never more than one at a time:
 * - PRESS FIRE: the first time an item lands in the inventory, until the player fires one. On Easy
 *   it stays up until then; on other levels (first race only) it gives up after 4 seconds. It shows
 *   the fire control (SPACE on a keyboard, A on touch).
 * - KICK: a Homing Squid is locked on and is inside the dodge window (plus a short lead) while the
 *   player's kick is ready with a dash charge to spend, since a kick only dodges in the last moments before contact. The
 *   player sees it as DASH! with the dash control.
 * - SWAP: the first time the player holds two items while no other hint wants the screen, the next
 *   item control (E on a keyboard, the swap button on touch) and SWAP!, once a race: it goes when
 *   the player swaps or once it has been on screen `SWAP_TICKS`. A hint that takes its spot pauses it.
 * - PULSE: items have sat unused for a while, so the fire glyph pulses on the HUD. It starts where
 *   PRESS FIRE gives up, so there is no silent gap.
 * - GUIDE: the player has pushed a while without getting closer to the finish (a wall in the way),
 *   on a level with the guide on (Easy): an arrow beside the player pointing the way on. KICK always
 *   outranks it, PRESS FIRE does for the first `GUIDE_OVER_PRESS_FIRE_TICKS` of being stuck and then
 *   gives way to it, so a child holding an item they never fire still finds out which way to swim.
 *   It never shows while a squid is latched, since the threat HUD's DASH! holds the spot.
 *
 * Hints run on the first race of a save and on every Easy race; otherwise they stay silent.
 */
import { TICK_DT } from '@arcade/core';
import { dodgeTicks, tuningOf } from '../../logic/difficulty-level.ts';
import { guideFor } from '../../logic/guide.ts';
import { canDash } from '../../logic/powerups/dash-meter.ts';
import { heldItems, selectedItem, selectedSlot, slotItems } from '../../logic/powerups/inventory.ts';
import { SQUID } from '../../logic/powerups/tuning.ts';
import { centreOf, playerOf } from '../../logic/racers.ts';
import type { Difficulty, PowerUpKind, Racer, Vec, World } from '../../logic/types.ts';
import { squidHuntingPlayer } from './threat-math.ts';

/** Ticks PRESS FIRE stays up after the first item lands when it times out (not on Easy), and when the HUD pulse takes over. */
export const PRESS_FIRE_TICKS = 240;
/** Ticks items may sit unused on Easy before the HUD's fire glyph starts to pulse (5 s), while PRESS FIRE is still up. */
export const UNUSED_PULSE_TICKS = 300;
/**
 * Ticks before the dodge window that KICK! appears, so there is time to read it and press. The
 * window itself is `dodgeTicks(world)` from logic (wider on easier levels).
 */
export const KICK_LEAD_TICKS = 8;

/** Ticks stuck after which the guide arrow takes the screen from PRESS FIRE (4.5 s; before that it waits its turn). */
export const GUIDE_OVER_PRESS_FIRE_TICKS = 270;

/** Ticks the SWAP prompt is shown at most, counting only ticks it is on screen (4 s). */
export const SWAP_TICKS = 240;

/** The selected item as last seen, so a move of the selection can be told from a swap. */
interface SeenSelection {
  slot: number;
  kind: PowerUpKind;
}

/** What the player has already shown they know, per race. */
export interface HintMemory {
  /** The tick the inventory first held an item this race, or null while it never has. */
  firstHeldAt: number | null;
  /** True once the player has used an item: they know what fire does, so PRESS FIRE is retired. */
  useLearned: boolean;
  /** The tick the inventory last became "held and unused": it holds something and nothing was used since. Null when it doesn't. */
  unusedSince: number | null;
  /** Ticks SWAP has been on screen this race; it retires at `SWAP_TICKS`. */
  swapShownTicks: number;
  /** True once the player has swapped items: SWAP is retired for the race. */
  swapLearned: boolean;
  /** The selected item last tick, or null when nothing was selected. */
  lastSelected: SeenSelection | null;
}

/** Which hints show right now. At most one is on. */
export interface HintState {
  /** PRESS (fire control)! beside the player. */
  pressFire: boolean;
  /** (dash control) DASH! beside the player: a squid is locked on and a kick dodges it. */
  kick: boolean;
  /** (next item control) SWAP! beside the player: they hold two items and haven't swapped yet. */
  swap: boolean;
  /** The fire glyph pulses beside the HUD's item well. */
  pulseItems: boolean;
  /** The way on as a tile offset (each of x and y in -1, 0, 1) for the guide arrow beside the player; null while no arrow shows. */
  guide: Vec | null;
}

/** No hint showing. */
export const NO_HINTS: HintState = { pressFire: false, kick: false, swap: false, pulseItems: false, guide: null };

/** An empty memory, for a race that is about to start. */
export function newHintMemory(): HintMemory {
  return {
    firstHeldAt: null,
    useLearned: false,
    unusedSince: null,
    swapShownTicks: 0,
    swapLearned: false,
    lastSelected: null,
  };
}

/** Which hints a race runs: none, or on Easy (PRESS FIRE waits for the first use) or on the first race of another level (it times out). */
export interface HintConfig {
  enabled: boolean;
  /** True when PRESS FIRE has no timeout and the pulse waits `UNUSED_PULSE_TICKS`. */
  easy: boolean;
}

/** Hints run for the first race of a save (nothing recorded yet) and for every Easy race. */
export function hintConfig(racesRun: number, difficulty: Difficulty): HintConfig {
  return { enabled: racesRun === 0 || difficulty === 'easy', easy: difficulty === 'easy' };
}

/**
 * Updates `memory` from this tick's world and returns the hints to show. Call it once per tick
 * after the world stepped. Hints stay off during the countdown, once the player has finished,
 * and always when the config has them off.
 */
export function updateHints(memory: HintMemory, world: World, config: HintConfig): HintState {
  const player = playerOf(world);
  if (player.useCooldown > 0) memory.useLearned = true;
  if (swappedSince(memory.lastSelected, player)) memory.swapLearned = true;
  memory.lastSelected = seenSelection(player);
  const held = heldItems(player).length;
  const holding = held > 0;
  const tick = world.tick;
  if (holding && memory.firstHeldAt === null) memory.firstHeldAt = tick;
  // "Unused" restarts whenever the inventory empties or an item has just been used.
  if (!holding || player.useCooldown > 0) memory.unusedSince = null;
  else memory.unusedSince ??= tick;

  if (!config.enabled || world.race.phase !== 'racing' || player.finished) return NO_HINTS;
  const firstHeldAt = memory.firstHeldAt;
  const heldFor = firstHeldAt === null ? 0 : tick - firstHeldAt;
  const pressFireOpen = config.easy || heldFor < PRESS_FIRE_TICKS;
  const pulseAfter = config.easy ? UNUSED_PULSE_TICKS : PRESS_FIRE_TICKS;
  const pressFire = holding && !memory.useLearned && firstHeldAt !== null && pressFireOpen;
  const kick = kickIsUseful(world);
  // A latched squid puts the threat HUD's own DASH! prompt in the hint spot.
  const latched = player.status.latched > 0;
  const guide = guideArrow(world, kick || latched, pressFire);
  const showPressFire = pressFire && guide === null && !kick && !latched;
  const spotTaken = latched || kick || showPressFire || guide !== null;
  const swap = !spotTaken && swapIsDue(memory, held);
  const pulse = memory.unusedSince !== null && tick - memory.unusedSince >= pulseAfter;
  return {
    pressFire: showPressFire,
    kick,
    swap,
    pulseItems: pulse && !spotTaken && !swap,
    guide,
  };
}

/**
 * True when SWAP should show this tick, given no other hint wants the screen: two or more items are
 * held, the player hasn't swapped yet, and it has been shown fewer than `SWAP_TICKS`. Counts this
 * tick as shown in `memory` when it is.
 */
function swapIsDue(memory: HintMemory, held: number): boolean {
  if (memory.swapLearned || held < 2 || memory.swapShownTicks >= SWAP_TICKS) return false;
  memory.swapShownTicks += 1;
  return true;
}

/** The racer's selected slot and its kind, or null with nothing selected. */
function seenSelection(racer: Racer): SeenSelection | null {
  const item = selectedItem(racer);
  return item ? { slot: selectedSlot(racer), kind: item.kind } : null;
}

/**
 * True when the selection moved off an item that is still in its slot: the player swapped. Using
 * up or losing the selected item also moves the selection, but empties the slot it left.
 */
function swappedSince(last: SeenSelection | null, racer: Racer): boolean {
  if (last === null || selectedSlot(racer) === last.slot) return false;
  return slotItems(racer)[last.slot]?.kind === last.kind;
}

/**
 * The way on to point at, or null: the guide is on for this level, the player has been stuck for the
 * level's `showTicks` (the arrow fades as soon as they get closer, which resets the count), and
 * neither a dash prompt (`dashPrompt`: KICK, or the threat HUD's DASH! while latched) nor a PRESS FIRE
 * that is still within its turn wants the spot.
 */
function guideArrow(world: World, dashPrompt: boolean, pressFire: boolean): Vec | null {
  const tuning = tuningOf(world).guide;
  if (!tuning.enabled || dashPrompt) return null;
  const { dir, stuckTicks } = guideFor(world, playerOf(world));
  if (stuckTicks < tuning.showTicks || (pressFire && stuckTicks < GUIDE_OVER_PRESS_FIRE_TICKS)) return null;
  return dir;
}

/** A squid locked on the player is inside the dodge window plus the lead, and the player can kick now (ready, with a dash charge). */
function kickIsUseful(world: World): boolean {
  const player = playerOf(world);
  if (player.status.latched > 0 || player.kickCooldown > 0 || !canDash(player)) return false;
  const squid = squidHuntingPlayer(world);
  if (squid === null) return false;
  const reach = (dodgeTicks(world) + KICK_LEAD_TICKS) * SQUID.speed * TICK_DT;
  const at = centreOf(player);
  return (squid.x - at.x) ** 2 + (squid.y - at.y) ** 2 <= reach * reach;
}
