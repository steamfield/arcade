/**
 * Clams: power-up boxes on the course. A racer touching a ready clam opens it,
 * gets a place-weighted roll from the `pickups` stream, and the clam stays shut
 * for a while. Lane 3/a implements it; the scaffold ships the signatures.
 */
import type { Rng } from '@arcade/core';
import type { PowerUpKind, Racer, World } from '../types.ts';

/**
 * The pickups slot for clams. Each call, a clam with `closedFor > 0` counts it down by one instead
 * of opening. A ready clam whose tile the hitbox of a racer overlaps (first in `racers` order) opens:
 * `rollClam(world.rngs.pickups, racer.place, racer.stack)`, `clam.opened {id, index, kind}`, then
 * `gainPowerUp`, and `closedFor = CLAM.closedTicks`. So a racer parked on a clam opens it on one
 * call and again CLAM.closedTicks + 1 calls later.
 *
 * Stub: does nothing until lane 3/a lands, so races on the current course keep running.
 */
export function openClams(world: World, racers: readonly Racer[]): void {
  void world;
  void racers;
}

/**
 * Roll weights for a racer in `place` (1..4): CLAM.firstWeights at 1st, CLAM.lastWeights at 4th,
 * linear in between.
 */
export function clamWeights(place: number): Record<PowerUpKind, number> {
  void place;
  throw new Error('not implemented');
}

/**
 * Picks a power-up the racer doesn't hold, weighted by `clamWeights(place)`, with one draw from `rng`.
 * The stack holds at most 3 of the 5 kinds, so there is always something to roll.
 */
export function rollClam(rng: Rng, place: number, held: readonly PowerUpKind[]): PowerUpKind {
  void rng;
  void place;
  void held;
  throw new Error('not implemented');
}
