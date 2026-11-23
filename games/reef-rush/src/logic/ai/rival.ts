/**
 * Computer-driven racing, the part every medium shares: a racer's Intent each tick from the
 * medium's steering (`Medium.steer`), item use, catch-up, and the progress backstop.
 *
 * Every call draws exactly four numbers from the racer's rng, in this order, whether or not they
 * are used: wobble, kick roll, recovery side, item roll (`AiDraws`). So one racer's choices, what it
 * holds and which medium it races in never shift the rest of its stream.
 *
 * The medium owns aim, avoidance, kicks and its own stuck rule. The backstop here catches what that
 * rule misses: a rival that keeps moving without getting any closer to the finish (`racer.progress`)
 * for PROGRESS_BACKSTOP_TICKS racing ticks is sent into the medium's recovery. Like the speed rule,
 * its count resets while the rival is stunned or trapped; it pauses while an Undertow pulls the
 * rival back, since that loss isn't the rival's steering. A recovering rival never bursts.
 */
import type { Rng } from '@arcade/core';
import type { CatchUpBounds } from '../difficulty-level.ts';
import { mediumOf } from '../media/index.ts';
import type { AiDraws, Medium } from '../media/types.ts';
import { modifiersFor } from '../modifiers.ts';
import type { AiMemory, Intent, Racer, World } from '../types.ts';
import { wantsBurst } from './items.ts';

/** Racing ticks without a new best progress before the backstop starts the medium's recovery. */
export const PROGRESS_BACKSTOP_TICKS = 240;

/** Fresh memory for a rival at the start line in `medium`. */
export function createAiMemory(medium: Medium): AiMemory {
  return { pilot: medium.createPilot(), bestProgress: Number.POSITIVE_INFINITY, sinceBest: 0 };
}

/**
 * Decides a racer's intent for this tick. Reads the world, mutates only `racer.ai`,
 * and consumes the same number of rng draws every tick so streams stay aligned.
 *
 * @throws {Error} When `racer.ai` is null.
 */
export function rivalIntent(world: World, racer: Racer, rng: Rng): Intent {
  const memory = racer.ai;
  if (!memory) throw new Error(`rivalIntent needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const draws: AiDraws = { wobble: rng.next(), kick: rng.next(), side: rng.next(), item: rng.next() };
  const forceRecover = progressStalled(world, racer, memory);
  const steering = mediumOf(world).steer(world, racer, modifiersFor(world, racer), draws, forceRecover);
  const burst = !steering.recovering && wantsBurst(world, racer, steering.aim, draws.item);
  return { move: steering.move, kick: steering.kick, burst, kickHeld: steering.kickHeld };
}

/**
 * Counts this tick toward the progress backstop. True on the tick the count reaches
 * PROGRESS_BACKSTOP_TICKS, which also starts it over.
 */
function progressStalled(world: World, racer: Racer, memory: AiMemory): boolean {
  if (world.race.phase !== 'racing') return false;
  if (racer.status.stunned > 0 || racer.status.trapped > 0) {
    memory.sinceBest = 0;
    return false;
  }
  if (racer.status.undertow > 0) return false;
  if (racer.progress < memory.bestProgress) {
    memory.bestProgress = racer.progress;
    memory.sinceBest = 0;
    return false;
  }
  memory.sinceBest++;
  if (memory.sinceBest < PROGRESS_BACKSTOP_TICKS) return false;
  memory.sinceBest = 0;
  return true;
}

/**
 * Force multiplier that keeps races close: below 1 when the racer is ahead of the player,
 * above 1 when behind, clamped to `bounds`.
 *
 * @param bounds The difficulty level's bounds (`DIFFICULTY[level].rivalCatchUp`).
 * @returns Exactly 1 while either racer's progress is unknown (Infinity before the first read).
 */
export function catchUpMul(racer: Racer, player: Racer, bounds: CatchUpBounds): number {
  if (!Number.isFinite(racer.progress) || !Number.isFinite(player.progress)) return 1;
  const gapTiles = racer.progress - player.progress;
  const boost = (gapTiles - bounds.lagTiles) * bounds.perTile;
  return 1 + Math.max(bounds.min - 1, Math.min(bounds.max - 1, boost));
}
