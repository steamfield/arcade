/**
 * Computer-driven swimming: a racer's Intent each tick from the steer field,
 * its profile, its memory and its own random stream.
 */
import type { Rng } from '@arcade/core';
import type { AiMemory, Intent, Racer, World } from '../types.ts';

/** Bounds of the catch-up multiplier on swim force, and its slope per tile of gap to the player. */
export const CATCH_UP = { perTile: 0.004, min: 0.9, max: 1.08 } as const;

/** Fresh memory for a racer at the start line. */
export function createAiMemory(): AiMemory {
  throw new Error('not implemented');
}

/**
 * Decides a racer's intent for this tick. Reads the world, mutates only `racer.ai`,
 * and consumes the same number of rng draws every tick so streams stay aligned.
 *
 * @throws {Error} When `racer.ai` is null.
 */
export function rivalIntent(world: World, racer: Racer, rng: Rng): Intent {
  void world;
  void racer;
  void rng;
  throw new Error('not implemented');
}

/**
 * Force multiplier that keeps races close: below 1 when the racer is ahead of the player,
 * above 1 when behind, clamped to CATCH_UP.
 */
export function catchUpMul(racer: Racer, player: Racer): number {
  void racer;
  void player;
  throw new Error('not implemented');
}
