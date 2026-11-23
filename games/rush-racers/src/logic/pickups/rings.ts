/**
 * Boost rings (`@`): never used up, each boosts every racer once per race. Passing a ring the first
 * time sets `status.ringBoost` to `RING.boostTicks`, so a line of rings keeps a racer boosted, and
 * `withPassives` turns the boost into more force (`PASSIVE.ringBoostForceMul`).
 *
 * Scaffold stub: cloudreach phase 2 lane a fills it in. Until then rings do nothing.
 */
import type { Racer, World } from '../types.ts';

/**
 * The pickups slot for rings, beside the pearls. Each racer in `racers` whose hitbox overlaps a
 * ring's tile and isn't in `world.ringsPassed[racer.id]` yet passes it: the ring's index is added
 * there, `status.ringBoost = RING.boostTicks`, and `ring.passed {id, ring}` is emitted. `racers` is
 * the unfinished racers in RACER_IDS order; fallen ones pass nothing.
 */
export function passRings(_world: World, _racers: readonly Racer[]): void {}
