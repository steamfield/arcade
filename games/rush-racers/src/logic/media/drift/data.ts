/**
 * Drift's shapes of the per-racer state and surroundings it keeps in the world, each extending the
 * opaque base in `media/types.ts` with `kind: 'drift'`, and the accessors drift reads them through.
 * An accessor throws on another medium's data. Navigation and pilot shapes live in `way-data.ts`.
 */
import type { Vec } from '../../types.ts';
import type { ParkingMotion } from '../fall-out.ts';
import type { MediumEnv, RacerMotion } from '../types.ts';

/** A drifter's movement state. */
export interface DriftMotion extends ParkingMotion {
  readonly kind: 'drift';
  /** Top-left of the last spot where the drifter's centre was outside every black hole's reach: where it comes back after one swallows it. */
  lastFree: Vec;
}

/** What the surroundings do to a drifter this tick. */
export interface DriftEnv extends MediumEnv {
  readonly kind: 'drift';
  /**
   * The solar wind on the drifter: a wind cell's unit direction, or an Ion Stream lane's direction
   * scaled by how much stronger it is. Null when there is none.
   */
  wind: Vec | null;
  /** The drifter's centre is in nebula dust (a kelp cell), which lowers its cruise and drags on it. */
  inDust: boolean;
  /** The pull of the gravity wells on the drifter's centre, px/s², already times the tuning's `wellPull`; zero outside every reach. */
  pull: Vec;
}

/**
 * A racer's motion as drift's.
 *
 * @throws {Error} When the motion was created by another medium.
 */
export function driftMotion(motion: RacerMotion): DriftMotion {
  if (motion.kind !== 'drift') throw wrongKind('motion', motion.kind);
  return motion as DriftMotion;
}

/**
 * Sampled surroundings as drift's.
 *
 * @throws {Error} When the environment was sampled by another medium.
 */
export function driftEnv(env: MediumEnv): DriftEnv {
  if (env.kind !== 'drift') throw wrongKind('environment', env.kind);
  return env as DriftEnv;
}

/** The error an accessor throws on another medium's data. */
export function wrongKind(what: string, kind: string): Error {
  return new Error(`Drift read ${what} of kind '${kind}'; it can only read its own ('drift') data`);
}
