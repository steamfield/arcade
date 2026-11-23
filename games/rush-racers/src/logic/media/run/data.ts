/**
 * Run's shapes of the per-racer state and surroundings it keeps in the world, each extending the
 * opaque base in `media/types.ts` with `kind: 'run'`, and the accessors run reads them through. An
 * accessor throws on another medium's data. Navigation and pilot shapes live in `way-data.ts`.
 */

import type { Vec } from '../../types.ts';
import type { ParkingMotion } from '../fall-out.ts';
import type { MediumEnv, RacerMotion } from '../types.ts';

/** A runner's movement state. It can fall out through a pit, so it keeps a park spot (`ParkingMotion`). */
export interface RunMotion extends ParkingMotion {
  readonly kind: 'run';
  /** Standing on a floor, ledge or crate after this tick's move. Set by `afterRunMove`. */
  grounded: boolean;
  /** Ticks after this one in which a jump still works after leaving the ground. */
  coyote: number;
  /** Ticks after this one in which an Up press is remembered until the runner lands. */
  buffer: number;
  /** Up was held last tick, so holding it doesn't jump again: a jump needs a fresh press. */
  upWasHeld: boolean;
  /** True from a jump until the runner lands, while Up still decides how high it goes. */
  jumping: boolean;
  /** The air dash is spent; it comes back on landing. */
  airDashUsed: boolean;
  /**
   * The speed, px/s, a dash glides down from: the dash's own speed when it fires, falling by
   * `dashDrag` a second after. Speed over running pace bleeds at `dashDrag` only while under this,
   * so a dash carries but mud, a dropped gust or a hit slow a runner at full friction. 0 with no dash.
   */
  dashGlide: number;
  /** Top-left of the last spot the runner stood on with rock or a ledge under both feet; a fall returns it here. */
  lastSafe: Vec;
}

/** What the surroundings do to a runner this tick. */
export interface RunEnv extends MediumEnv {
  readonly kind: 'run';
  /** Standing on something this tick (from last tick's contacts). */
  grounded: boolean;
  /**
   * The wind on the runner: a wind cell's unit direction (a gust, updraft or downdraft), or a Tailwind
   * lane's direction scaled by how much stronger it is. Null when there is none.
   */
  wind: Vec | null;
  /** The runner's centre is in mud (a kelp cell), which lowers its top speed. */
  inMud: boolean;
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
