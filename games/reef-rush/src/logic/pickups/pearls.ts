/**
 * Pearls work like coins: each one collected adds to the racer's count, which raises
 * its swim force up to a cap (`pearlSpeedMul`), and gives a short boost. A course
 * pearl can be collected once per race, by the first racer to touch it. A landed hit
 * knocks some of a racer's pearls loose (`dropPearls`) for anyone to collect.
 * A Glow Lantern holder collects course pearls from a distance: "within 3 tiles" is the straight-line distance from the racer's centre to the pearl's
 * tile centre, inclusive. When several racers reach a pearl on the same tick,
 * by touch or by lantern alike, the first in RACER_IDS order gets it.
 */
import { TICK_DT } from '@arcade/core';
import { overlapsTile } from '../level/query.ts';
import { selectedItem } from '../powerups/inventory.ts';
import { PASSIVE, PEARL } from '../powerups/tuning.ts';
import { centreOf, hitbox } from '../racers.ts';
import { type LoosePearl, type Racer, TILE, type Vec, type World } from '../types.ts';
import { driftPearl, scatterPearls } from './pearl-drift.ts';

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

/** The swim-force multiplier `racer`'s pearl count gives it: 1 + PEARL.speedPerPearl per pearl, up to PEARL.cap pearls. */
export function pearlSpeedMul(racer: Racer): number {
  return 1 + PEARL.speedPerPearl * Math.min(racer.pearls, PEARL.cap);
}

/**
 * Knocks `min(PEARL.dropOnHit, racer.pearls)` of `racer`'s pearls loose after a hit lands: takes them
 * off its count, scatters them from its centre into `world.loosePearls` (`scatterPearls`) and emits
 * `pearls.dropped {id, count}`. A racer with no pearls drops nothing and nothing is emitted.
 */
export function dropPearls(world: World, racer: Racer): void {
  const count = Math.min(PEARL.dropOnHit, racer.pearls);
  if (count === 0) return;
  racer.pearls -= count;
  world.loosePearls.push(...scatterPearls(centreOf(racer), racer.facing, count, racer.id));
  world.events.emit({ type: 'pearls.dropped', id: racer.id, count });
}

/**
 * The pickups slot for loose pearls. Each call, every loose pearl drifts one tick (`driftPearl`) and
 * ages by one; at PEARL.lifeTicks it is gone before anyone can collect it that tick. Otherwise the
 * first racer in `racers` whose hitbox overlaps its PEARL.size square collects it, except the racer
 * that dropped it while its age is at most PEARL.ownGraceTicks: removed, 1 added to `racer.pearls`,
 * `status.boost = PEARL.boostTicks`, and `loosePearl.collected {id, total}`.
 */
export function collectLoosePearls(world: World, racers: readonly Racer[]): void {
  world.loosePearls = world.loosePearls.filter((pearl) => {
    driftPearl(world, pearl, TICK_DT);
    pearl.age += 1;
    if (pearl.age >= PEARL.lifeTicks) return false;
    const collector = racers.find((racer) => mayCollect(racer, pearl) && touches(racer, pearl));
    if (!collector) return true;
    collector.pearls += 1;
    collector.status.boost = PEARL.boostTicks;
    world.events.emit({ type: 'loosePearl.collected', id: collector.id, total: collector.pearls });
    return false;
  });
}

/** Whether `racer` may collect `pearl` yet: anyone at once, its dropper only after PEARL.ownGraceTicks. */
function mayCollect(racer: Racer, pearl: LoosePearl): boolean {
  return racer.id !== pearl.droppedBy || pearl.age > PEARL.ownGraceTicks;
}

/** True when `racer`'s hitbox shares some positive area with the pearl's PEARL.size square. */
function touches(racer: Racer, pearl: LoosePearl): boolean {
  const box = hitbox(racer);
  const half = PEARL.size / 2;
  return (
    box.x < pearl.at.x + half &&
    box.x + box.w > pearl.at.x - half &&
    box.y < pearl.at.y + half &&
    box.y + box.h > pearl.at.y - half
  );
}
