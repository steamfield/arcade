/**
 * The in-race hints for young players, as pure functions of the world plus a small memory of what
 * the player has already learned this race. Nothing here draws: `hint-view.ts` shows what these
 * say, and the runtime keeps the latest answer so tests can read it.
 *
 * Three hints, each a picture-first prompt (see UI.md "Hints"):
 * - PRESS B: the first time a power-up lands in the stack, until the player fires one. On Easy it
 *   stays up until then; on other levels (first race only) it gives up after 4 seconds.
 * - KICK: a Homing Squid is locked on and is inside the dodge window (plus a short lead) while the
 *   player's kick is ready, since a kick only dodges in the last moments before contact.
 * - PULSE: the stack has held something unused for a while, so the B glyph pulses on the HUD.
 *   It starts where PRESS B gives up, so there is no silent gap.
 *
 * Hints run on the first race of a save and on every Easy race; otherwise they stay silent.
 */
import { TICK_DT } from '@arcade/core';
import { SQUID } from '../../logic/powerups/tuning.ts';
import { centreOf, playerOf } from '../../logic/racers.ts';
import type { Difficulty, World } from '../../logic/types.ts';
import { squidHuntingPlayer } from './threat-math.ts';

/** Ticks PRESS B! stays up after the first power-up lands when it times out (not on Easy), and when the HUD pulse takes over. */
export const PRESS_B_TICKS = 240;
/** Ticks a stack may sit unused on Easy before the HUD's B glyph starts to pulse (5 s), while PRESS B! is still up. */
export const UNUSED_PULSE_TICKS = 300;
/**
 * Ticks before the dodge window that KICK! appears, so there is time to read it and press. The
 * window itself is `SQUID.dodgeTicks`, read from logic.
 */
export const KICK_LEAD_TICKS = 8;

/** What the player has already shown they know, per race. */
export interface HintMemory {
  /** The tick the stack first held a power-up this race, or null while it never has. */
  firstHeldAt: number | null;
  /** True once the player has fired a burst: they know what B does, so PRESS B! is retired. */
  burstLearned: boolean;
  /** The tick the stack last became "held and unused": it holds something and no burst fired since. Null when it doesn't. */
  unusedSince: number | null;
}

/** Which hints show right now. */
export interface HintState {
  /** PRESS B! beside the player. */
  pressB: boolean;
  /** KICK! beside the player: a squid is locked on and a kick dodges it. */
  kick: boolean;
  /** The B glyph pulses on the HUD stack. */
  pulseStack: boolean;
}

/** No hint showing. */
export const NO_HINTS: HintState = { pressB: false, kick: false, pulseStack: false };

/** An empty memory, for a race that is about to start. */
export function newHintMemory(): HintMemory {
  return { firstHeldAt: null, burstLearned: false, unusedSince: null };
}

/** Which hints a race runs: none, or on Easy (PRESS B! waits for the first burst) or on the first race of another level (it times out). */
export interface HintConfig {
  enabled: boolean;
  /** True when PRESS B! has no timeout and the pulse waits `UNUSED_PULSE_TICKS`. */
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
  if (player.burstCooldown > 0) memory.burstLearned = true;
  const holding = player.stack.length > 0;
  const tick = world.tick;
  if (holding && memory.firstHeldAt === null) memory.firstHeldAt = tick;
  // "Unused" restarts whenever the stack empties or a burst has just fired.
  if (!holding || player.burstCooldown > 0) memory.unusedSince = null;
  else memory.unusedSince ??= tick;

  if (!config.enabled || world.race.phase !== 'racing' || player.finished) return NO_HINTS;
  const firstHeldAt = memory.firstHeldAt;
  const heldFor = firstHeldAt === null ? 0 : tick - firstHeldAt;
  const pressBOpen = config.easy || heldFor < PRESS_B_TICKS;
  const pulseAfter = config.easy ? UNUSED_PULSE_TICKS : PRESS_B_TICKS;
  return {
    pressB: holding && !memory.burstLearned && firstHeldAt !== null && pressBOpen,
    kick: kickIsUseful(world),
    pulseStack: memory.unusedSince !== null && tick - memory.unusedSince >= pulseAfter,
  };
}

/**
 * Ticks before contact in which a kick still dodges a squid. This is the one place the hints read
 * it: once lane 7/c merges it becomes `dodgeTicks(world)` from `logic/difficulty-level.ts` (12 hard,
 * 18 normal, 24 easy) and this function goes away.
 */
function dodgeTicksFor(_world: World): number {
  return SQUID.dodgeTicks;
}

/** A squid locked on the player is inside the dodge window plus the lead, and the player can kick now. */
function kickIsUseful(world: World): boolean {
  const player = playerOf(world);
  if (player.status.latched > 0 || player.kickCooldown > 0) return false;
  const squid = squidHuntingPlayer(world);
  if (squid === null) return false;
  const reach = (dodgeTicksFor(world) + KICK_LEAD_TICKS) * SQUID.speed * TICK_DT;
  const at = centreOf(player);
  return (squid.x - at.x) ** 2 + (squid.y - at.y) ** 2 <= reach * reach;
}
