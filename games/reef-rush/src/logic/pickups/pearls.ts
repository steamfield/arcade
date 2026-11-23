/**
 * Pearls: each one can be collected once per race, by the first racer to touch it,
 * for a short boost. A Glow Lantern holder collects them from a distance: "within
 * 3 tiles" is the straight-line distance from the racer's centre to the pearl's
 * tile centre, inclusive. When several racers reach a pearl on the same tick,
 * by touch or by lantern alike, the first in RACER_IDS order gets it.
 */
import { overlapsTile } from '../level/query.ts';
import { selectedItem } from '../powerups/inventory.ts';
import { PASSIVE, PEARL } from '../powerups/tuning.ts';
import { centreOf, hitbox } from '../racers.ts';
import { type Racer, TILE, type Vec, type World } from '../types.ts';

/**
 * The pickups slot for pearls. A pearl not in `world.pearlsTaken` is collected by the first racer
 * (in `racers` order) whose hitbox overlaps its tile, or, holding a Glow Lantern, whose centre is
 * within PASSIVE.lanternPearlTiles tiles of the pearl's tile centre. Collecting adds its index to
 * `pearlsTaken`, 1 to `racer.pearls`, sets `status.boost = PEARL.boostTicks` and emits
 * `pearl.collected {id, index, total}`.
 */
export function collectPearls(world: World, racers: readonly Racer[]): void {
  world.level.pearls.forEach((tile, index) => {
    if (world.pearlsTaken.has(index)) return;
    const collector = racers.find((racer) => reaches(racer, tile));
    if (!collector) return;
    world.pearlsTaken.add(index);
    collector.pearls += 1;
    collector.status.boost = PEARL.boostTicks;
    world.events.emit({ type: 'pearl.collected', id: collector.id, index, total: collector.pearls });
  });
}

/** Whether `racer` collects the pearl on `tile`: by touch, or by Glow Lantern range. */
function reaches(racer: Racer, tile: Vec): boolean {
  if (overlapsTile(hitbox(racer), tile.x, tile.y)) return true;
  if (selectedItem(racer)?.kind !== 'glowLantern') return false;
  const centre = centreOf(racer);
  const dx = (tile.x + 0.5) * TILE - centre.x;
  const dy = (tile.y + 0.5) * TILE - centre.y;
  // Squared, because logic avoids Math.hypot (engines may round it differently).
  return dx * dx + dy * dy <= (PASSIVE.lanternPearlTiles * TILE) ** 2;
}

/** The swim-force multiplier `racer`'s pearl count gives it. Phase 2 scaffold: lane b fills it in. */
export function pearlSpeedMul(_racer: Racer): number {
  return 1;
}

/**
 * Knocks some of `racer`'s pearls loose after a hit lands, into `world.loosePearls`, emitting
 * `pearls.dropped`. Phase 2 scaffold: lane b fills it in.
 */
export function dropPearls(_world: World, _racer: Racer): void {}

/**
 * The pickups slot for loose pearls: drifts them, ages them out, and gives each to the first racer
 * that reaches it, emitting `loosePearl.collected`. Phase 2 scaffold: lane b fills it in.
 */
export function collectLoosePearls(_world: World, _racers: readonly Racer[]): void {}
