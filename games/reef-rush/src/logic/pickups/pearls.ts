/**
 * Pearls: each one can be collected once per race, by the first racer to touch it,
 * for a short boost. A Glow Lantern holder collects them from a distance. Lane
 * 3/a implements it; the scaffold ships the signatures.
 */
import type { Racer, World } from '../types.ts';

/**
 * The pickups slot for pearls. A pearl not in `world.pearlsTaken` is collected by the first racer
 * (in `racers` order) whose hitbox overlaps its tile, or, holding a Glow Lantern, whose centre is
 * within PASSIVE.lanternPearlTiles tiles of the pearl's tile centre. Collecting adds its index to
 * `pearlsTaken`, 1 to `racer.pearls`, sets `status.boost = PEARL.boostTicks` and emits
 * `pearl.collected {id, index, total}`.
 *
 * Stub: does nothing until lane 3/a lands, so races on the current course keep running.
 */
export function collectPearls(world: World, racers: readonly Racer[]): void {
  void world;
  void racers;
}
