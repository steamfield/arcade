/**
 * Boost rings (`@`): never used up, each boosts every racer once per race. Passing a ring the first
 * time sets `status.ringBoost` to `RING.boostTicks`, so a line of rings keeps a racer boosted, and
 * `withPassives` turns the boost into more force (`PASSIVE.ringBoostForceMul`).
 */
import { overlapsTile } from '../level/query.ts';
import { RING } from '../powerups/tuning.ts';
import { hitbox } from '../racers.ts';
import type { Racer, World } from '../types.ts';

/**
 * The pickups slot for rings, beside the pearls. Each racer in `racers` whose hitbox overlaps a
 * ring's tile and isn't in `world.ringsPassed[racer.id]` yet passes it: the ring's index is added
 * there, `status.ringBoost = RING.boostTicks`, and `ring.passed {id, ring}` is emitted. `racers` is
 * the unfinished racers in RACER_IDS order; fallen ones pass nothing.
 */
export function passRings(world: World, racers: readonly Racer[]): void {
  for (const racer of racers) {
    if (racer.status.fallen > 0) continue;
    world.level.rings.forEach((tile, ring) => {
      const passed = world.ringsPassed[racer.id];
      if (passed.includes(ring) || !overlapsTile(hitbox(racer), tile.x, tile.y)) return;
      passed.push(ring);
      racer.status.ringBoost = RING.boostTicks;
      world.events.emit({ type: 'ring.passed', id: racer.id, ring });
    });
  }
}
