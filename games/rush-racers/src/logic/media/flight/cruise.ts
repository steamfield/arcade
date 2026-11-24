/**
 * The horizontal speeds a flyer settles at, shared by flight's physics and its rival pilot so the
 * pilot aims for the speed the physics will give it: the cruise its share of `forceMul` and any fog
 * allow, and the drift a gust adds. Holding a direction settles at `±cruise + drift`; letting go of
 * the stick settles at the drift alone.
 */
import type { MoveModifiers } from '../../types.ts';
import type { FlightEnv } from './data.ts';
import type { FlightExtra } from './physics.ts';

/** How much of forceMul's deviation from 1 reaches a flyer's acceleration, cruise, dash and dive carry: 1.4 flies 20 % faster. */
const FORCE_SHARE = 0.5;

/** The share of `forceMul` a flyer feels: 1 at forceMul 1, 1.2 at 1.4, 0.8 at 0.6. */
export function forceScale(mods: MoveModifiers): number {
  return 1 + (mods.forceMul - 1) * FORCE_SHARE;
}

/** Px/s a flyer holding a direction settles at in still air: `cruise` times its force share, lowered in fog. */
export function cruiseSpeed(extra: FlightExtra, mods: MoveModifiers, air: FlightEnv): number {
  return extra.cruise * forceScale(mods) * (air.inFog ? extra.fogCruiseMul : 1);
}

/** Px/s a gust adds to the speed a flyer settles at, signed along x; 0 out of the wind. */
export function windDrift(extra: FlightExtra, air: FlightEnv): number {
  return (air.wind?.x ?? 0) * extra.windSpeed;
}
