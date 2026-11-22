/**
 * Clams: power-up boxes on the course. A racer touching a ready clam opens it,
 * gets a place-weighted roll from the `pickups` stream, and the clam stays shut
 * for a while. A roll walks POWER_UP_KINDS in order over the cumulative weights
 * of the kinds the racer doesn't hold, so one draw maps to one kind.
 */
import type { Rng } from '@arcade/core';
import { overlapsTile } from '../level/query.ts';
import { gainPowerUp } from '../powerups/stack.ts';
import { CLAM } from '../powerups/tuning.ts';
import { hitbox } from '../racers.ts';
import { POWER_UP_KINDS, type PowerUpKind, RACER_IDS, type Racer, type World } from '../types.ts';

const LAST_PLACE = RACER_IDS.length;

/**
 * The pickups slot for clams. Each call, a clam with `closedFor > 0` counts it down by one instead
 * of opening. A ready clam whose tile the hitbox of a racer overlaps (first in `racers` order) opens:
 * `rollClam(world.rngs.pickups, racer.place, racer.stack)`, `clam.opened {id, index, kind}`, then
 * `gainPowerUp`, and `closedFor = CLAM.closedTicks`. So a racer parked on a clam opens it on one
 * call and again CLAM.closedTicks + 1 calls later.
 */
export function openClams(world: World, racers: readonly Racer[]): void {
  world.clams.forEach((clam, index) => {
    if (clam.closedFor > 0) {
      clam.closedFor -= 1;
      return;
    }
    const opener = racers.find((racer) => overlapsTile(hitbox(racer), clam.tile.x, clam.tile.y));
    if (!opener) return;
    const kind = rollClam(world.rngs.pickups, opener.place, opener.stack);
    world.events.emit({ type: 'clam.opened', id: opener.id, index, kind });
    gainPowerUp(world, opener, kind);
    clam.closedFor = CLAM.closedTicks;
  });
}

/**
 * Roll weights for a racer in `place` (1..4): CLAM.firstWeights at 1st, CLAM.lastWeights at 4th,
 * linear in between.
 *
 * @throws {RangeError} When `place` is not an integer from 1 to 4.
 */
export function clamWeights(place: number): Record<PowerUpKind, number> {
  if (!Number.isInteger(place) || place < 1 || place > LAST_PLACE) {
    throw new RangeError(`Clam roll for place ${place}: places run 1 to ${LAST_PLACE}`);
  }
  const t = (place - 1) / (LAST_PLACE - 1);
  const weights = POWER_UP_KINDS.map((kind): [PowerUpKind, number] => {
    const first = CLAM.firstWeights[kind];
    return [kind, first + (CLAM.lastWeights[kind] - first) * t];
  });
  return Object.fromEntries(weights) as Record<PowerUpKind, number>;
}

/**
 * Picks a power-up the racer doesn't hold, weighted by `clamWeights(place)`, with one draw from `rng`.
 * The stack holds at most 3 of the 5 kinds, so there is always something to roll.
 *
 * @throws {Error} When `held` already covers every kind, which a valid stack never does.
 */
export function rollClam(rng: Rng, place: number, held: readonly PowerUpKind[]): PowerUpKind {
  const weights = clamWeights(place);
  const candidates = POWER_UP_KINDS.filter((kind) => !held.includes(kind));
  const last = candidates.at(-1);
  if (last === undefined) {
    throw new Error(`Clam roll with every kind held (${held.join(', ')}); a stack holds at most 3 kinds`);
  }
  const total = candidates.reduce((sum, kind) => sum + weights[kind], 0);
  let left = rng.next() * total;
  for (const kind of candidates) {
    left -= weights[kind];
    if (left < 0) return kind;
  }
  // Float rounding can leave a sliver past the last weight; it belongs to the last kind.
  return last;
}
