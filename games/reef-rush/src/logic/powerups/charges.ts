/**
 * How many uses an item comes with when a racer gains it from a clam. Every kind has a fixed count
 * except the Homing Squid, which trailing racers get more of.
 */
import type { PowerUpKind } from '../types.ts';

/** Uses each kind comes with. The Homing Squid's is its count in 1st and 2nd place. */
export const CHARGES: Readonly<Record<PowerUpKind, number>> = {
  jetFin: 3,
  bubbleShield: 1,
  puffer: 2,
  inkSac: 3,
  glowLantern: 2,
  homingSquid: 1,
  riptide: 2,
  mimic: 1,
  undertow: 1,
  cannonball: 1,
};

/** A Homing Squid gained in this place or worse comes with `charges` uses instead of one. */
export const TRAILING_SQUID = { fromPlace: 3, charges: 3 } as const;

/** The uses `kind` comes with for a racer gaining it in `place` (1..4). */
export function chargesFor(kind: PowerUpKind, place: number): number {
  if (kind === 'homingSquid' && place >= TRAILING_SQUID.fromPlace) return TRAILING_SQUID.charges;
  return CHARGES[kind];
}
