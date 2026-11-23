/**
 * Run's shapes of the per-racer state and surroundings it keeps in the world, each extending the
 * opaque base in `media/types.ts` with `kind: 'run'`, and the accessors run reads them through. An
 * accessor throws on another medium's data. Navigation and pilot shapes live in `way-data.ts`.
 */

import type { Vec } from '../../types.ts';
import type { MediumEnv, RacerMotion } from '../types.ts';

/** A runner's movement state. */
export interface RunMotion extends RacerMotion {
  readonly kind: 'run';
  /** Standing on a floor, ledge or crate after this tick's move. Set by `afterRunMove`. */
  grounded: boolean;
  /** Ticks left in which a jump still works after leaving the ground. */
  coyote: number;
  /** Ticks left in which a jump press is remembered until the runner lands. */
  buffer: number;
  /** Up was held last tick, so holding it doesn't jump again: a jump needs a fresh press. */
  upWasHeld: boolean;
  /** True from a jump until the runner lands, while Up still decides how high it goes. */
  jumping: boolean;
  /** The air dash is spent; it comes back on landing. */
  airDashUsed: boolean;
  /** Top-left of the last spot the runner stood on with ground under both feet; a fall returns it here. */
  lastSafe: Vec;
}

/** What the surroundings do to a runner this tick. */
export interface RunEnv extends MediumEnv {
  readonly kind: 'run';
  /** Standing on something this tick (from last tick's contacts). */
  grounded: boolean;
}

/**
 * A racer's motion as run's.
 *
 * @throws {Error} When the motion was created by another medium.
 */
export function runMotion(motion: RacerMotion): RunMotion {
  if (motion.kind !== 'run') throw wrongKind('motion', motion.kind);
  return motion as RunMotion;
}

/**
 * Sampled surroundings as run's.
 *
 * @throws {Error} When the environment was sampled by another medium.
 */
export function runEnv(env: MediumEnv): RunEnv {
  if (env.kind !== 'run') throw wrongKind('environment', env.kind);
  return env as RunEnv;
}

/** The error an accessor throws on another medium's data. */
export function wrongKind(what: string, kind: string): Error {
  return new Error(`Run read ${what} of kind '${kind}'; it can only read its own ('run') data`);
}
