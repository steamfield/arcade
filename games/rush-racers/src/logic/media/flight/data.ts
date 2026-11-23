/**
 * Flight's shapes of the per-racer state and surroundings it keeps in the world, each extending the
 * opaque base in `media/types.ts` with `kind: 'flight'`, and the accessors flight reads them through.
 * An accessor throws on another medium's data. Navigation and pilot shapes live in `way-data.ts`.
 */
import type { Vec } from '../../types.ts';
import type { MediumEnv, RacerMotion } from '../types.ts';

/** A flyer's movement state. */
export interface FlightMotion extends RacerMotion {
  readonly kind: 'flight';
  /** Up was held last tick, so holding it doesn't flap again: a flap needs a fresh press. */
  upWasHeld: boolean;
  /** Ticks until a flap is allowed again; 0 when ready. A press while above 0 is dropped. */
  flapCooldown: number;
  /** Down was held last tick: the flyer is diving, and letting go carries its fall into forward speed. */
  diving: boolean;
  /** Ticks left in which the last dash pops puff clouds it touches (`flightRamsCoral`); 0 with none. */
  dashWindow: number;
  /**
   * Top-left of the last spot the flyer was at with rock below it, under its own columns and every
   * column within 2 tiles either side (`fall.ts`); a fall brings it back here.
   */
  lastSafe: Vec;
  /** Top-left of where a fallen flyer waits, out of the level, until it respawns (`../fall-out.ts`). */
  parkedAt: Vec;
}

/** What the surroundings do to a flyer this tick. */
export interface FlightEnv extends MediumEnv {
  readonly kind: 'flight';
  /**
   * The wind on the flyer: a wind cell's unit direction (a gust, updraft or downdraft), or a Jet
   * Stream lane's direction scaled by how much stronger it is. Null when there is none.
   */
  wind: Vec | null;
  /** The flyer's centre is in a fog bank (a kelp cell), which lowers its cruise. */
  inFog: boolean;
}

/**
 * A racer's motion as flight's.
 *
 * @throws {Error} When the motion was created by another medium.
 */
export function flightMotion(motion: RacerMotion): FlightMotion {
  if (motion.kind !== 'flight') throw wrongKind('motion', motion.kind);
  return motion as FlightMotion;
}

/**
 * Sampled surroundings as flight's.
 *
 * @throws {Error} When the environment was sampled by another medium.
 */
export function flightEnv(env: MediumEnv): FlightEnv {
  if (env.kind !== 'flight') throw wrongKind('environment', env.kind);
  return env as FlightEnv;
}

/** The error an accessor throws on another medium's data. */
export function wrongKind(what: string, kind: string): Error {
  return new Error(`Flight read ${what} of kind '${kind}'; it can only read its own ('flight') data`);
}
