/**
 * The in-race hints for young players, as pure functions of the world plus a small memory of what
 * the player has already learned this race. Nothing here draws: `hint-view.ts` shows what these
 * say, and the runtime keeps the latest answer so tests can read it.
 *
 * Four hints, each a picture-first prompt (see UI.md "Hints"):
 * - PRESS FIRE: the first time an item lands in the inventory, until the player fires one. On Easy
 *   it stays up until then; on other levels (first race only) it gives up after 4 seconds. It shows
 *   the fire control (SPACE on a keyboard, A on touch).
 * - KICK: a Homing Squid is locked on and is inside the dodge window (plus a short lead) while the
 *   player's kick is ready, since a kick only dodges in the last moments before contact. The
 *   player sees it as DASH! with the dash control.
 * - PULSE: items have sat unused for a while, so the fire glyph pulses on the HUD. It starts where
 *   PRESS FIRE gives up, so there is no silent gap.
 * - GUIDE: the player has pushed a while without getting closer to the finish (a wall in the way),
 *   on a level with the guide on (Easy): an arrow beside the player pointing the way on. KICK always
 *   outranks it, PRESS FIRE does for the first `GUIDE_OVER_PRESS_FIRE_TICKS` of being stuck and then
 *   gives way to it, so a child holding an item they never fire still finds out which way to swim.
 *
 * Hints run on the first race of a save and on every Easy race; otherwise they stay silent.
 */
import { TICK_DT } from '@arcade/core';
import { dodgeTicks, tuningOf } from '../../logic/difficulty-level.ts';
import { guideFor } from '../../logic/guide.ts';
import { heldItems } from '../../logic/powerups/inventory.ts';
import { SQUID } from '../../logic/powerups/tuning.ts';
import { centreOf, playerOf } from '../../logic/racers.ts';
import type { Difficulty, Vec, World } from '../../logic/types.ts';
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

/** What the player has already shown they know, per race. */
export interface HintMemory {
  /** The tick the inventory first held an item this race, or null while it never has. */
  firstHeldAt: number | null;
  /** True once the player has used an item: they know what fire does, so PRESS FIRE is retired. */
  useLearned: boolean;
  /** The tick the inventory last became "held and unused": it holds something and nothing was used since. Null when it doesn't. */
  unusedSince: number | null;
}

/** Which hints show right now. */
export interface HintState {
  /** PRESS (fire control)! beside the player. */
  pressFire: boolean;
  /** (dash control) DASH! beside the player: a squid is locked on and a kick dodges it. */
  kick: boolean;
  /** The fire glyph pulses beside the HUD's item well. */
  pulseItems: boolean;
  /** The way on as a tile offset (each of x and y in -1, 0, 1) for the guide arrow beside the player; null while no arrow shows. */
  guide: Vec | null;
}

/** No hint showing. */
export const NO_HINTS: HintState = { pressFire: false, kick: false, pulseItems: false, guide: null };

/** An empty memory, for a race that is about to start. */
export function newHintMemory(): HintMemory {
  return { firstHeldAt: null, useLearned: false, unusedSince: null };
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
  const holding = heldItems(player).length > 0;
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
  const guide = guideArrow(world, kick, pressFire);
  return {
    pressFire: pressFire && guide === null,
    kick,
    pulseItems: memory.unusedSince !== null && tick - memory.unusedSince >= pulseAfter,
    guide,
  };
}

/**
 * The way on to point at, or null: the guide is on for this level, the player has been stuck for the
 * level's `showTicks` (the arrow fades as soon as they get closer, which resets the count), and
 * neither KICK nor a PRESS FIRE that is still within its turn wants the spot.
 */
function guideArrow(world: World, kick: boolean, pressFire: boolean): Vec | null {
  const tuning = tuningOf(world).guide;
  if (!tuning.enabled || kick) return null;
  const { dir, stuckTicks } = guideFor(world, playerOf(world));
  if (stuckTicks < tuning.showTicks || (pressFire && stuckTicks < GUIDE_OVER_PRESS_FIRE_TICKS)) return null;
  return dir;
}

/** A squid locked on the player is inside the dodge window plus the lead, and the player can kick now. */
function kickIsUseful(world: World): boolean {
  const player = playerOf(world);
  if (player.status.latched > 0 || player.kickCooldown > 0) return false;
  const squid = squidHuntingPlayer(world);
  if (squid === null) return false;
  const reach = (dodgeTicks(world) + KICK_LEAD_TICKS) * SQUID.speed * TICK_DT;
  const at = centreOf(player);
  return (squid.x - at.x) ** 2 + (squid.y - at.y) ** 2 <= reach * reach;
}
