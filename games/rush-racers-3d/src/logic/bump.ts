/** Racers bumping into each other: run once per tick after every racer has moved. */
import type { World } from './types.ts';

/**
 * Pushes apart in `d` any two racing racers that overlap, swapping part of their `vd`, and emits
 * `racer.bumped` with `by` for each. Fallen and finished racers never bump.
 */
export function bumpRacers(world: World): void {
  void world;
  throw new Error('bumpRacers: not implemented (phase 2 lane a)');
}
