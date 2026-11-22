/**
 * The in-race hints for young players, as pure functions of the world plus a small memory of what
 * the player has already learned this race. Nothing here draws: `hint-view.ts` shows what these
 * say, and the runtime keeps the latest answer so tests can read it.
 *
 * Three hints, each a picture-first prompt (see UI.md "Hints"):
 * - PRESS B: the first time a power-up lands in the stack, until the player fires one.
 * - KICK: a Homing Squid has locked on, and kicking just before it arrives dodges it.
 * - PULSE: the stack has held something unused for 5 seconds, so the B glyph pulses on the HUD.
 *
 * Hints run on the first race of a save and on every Easy race; otherwise they stay silent.
 */
import { playerOf } from '../../logic/racers.ts';
import type { Difficulty, World } from '../../logic/types.ts';
import { squidHuntingPlayer } from './threat-math.ts';

/** Ticks PRESS B! stays up after the first power-up lands, if the player doesn't fire it. */
export const PRESS_B_TICKS = 240;
/** Ticks a stack may sit unused before the HUD's B glyph starts to pulse (5 s at 60 ticks a second). */
export const UNUSED_PULSE_TICKS = 300;

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

/** Hints run for the first race of a save (nothing recorded yet) and for every Easy race. */
export function hintsEnabled(racesRun: number, difficulty: Difficulty): boolean {
  return racesRun === 0 || difficulty === 'easy';
}

/**
 * Updates `memory` from this tick's world and returns the hints to show. Call it once per tick
 * after the world stepped. Hints stay off during the countdown, once the player has finished,
 * and always when `enabled` is false.
 */
export function updateHints(memory: HintMemory, world: World, enabled: boolean): HintState {
  const player = playerOf(world);
  if (player.burstCooldown > 0) memory.burstLearned = true;
  const holding = player.stack.length > 0;
  const tick = world.tick;
  if (holding && memory.firstHeldAt === null) memory.firstHeldAt = tick;
  // "Unused" restarts whenever the stack empties or a burst has just fired.
  if (!holding || player.burstCooldown > 0) memory.unusedSince = null;
  else memory.unusedSince ??= tick;

  if (!enabled || world.race.phase !== 'racing' || player.finished) return NO_HINTS;
  const firstHeldAt = memory.firstHeldAt;
  return {
    pressB: holding && !memory.burstLearned && firstHeldAt !== null && tick - firstHeldAt < PRESS_B_TICKS,
    kick: player.status.latched === 0 && squidHuntingPlayer(world) !== null,
    pulseStack: memory.unusedSince !== null && tick - memory.unusedSince >= UNUSED_PULSE_TICKS,
  };
}
