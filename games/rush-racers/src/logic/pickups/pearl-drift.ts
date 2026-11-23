/**
 * How a loose pearl moves: scattered from a hit racer at a fixed fan of directions, then slowed by
 * drag each tick. It never enters a solid tile, and never leaves the water for the air above a
 * surface: an axis whose next step would do either loses its speed instead. A pearl scattered in the
 * air falls under gravity until it is back in the water. No randomness, so a drop never shifts any
 * rng stream.
 */
import { isAirAt, isSolid } from '../level/query.ts';
import { AIR_GRAVITY } from '../level/surface.ts';
import { PEARL } from '../powerups/tuning.ts';
import { type LoosePearl, type RacerId, TILE, type Vec, type World } from '../types.ts';

/**
 * Unit scatter directions for a racer facing right, in the order pearls take them: straight back,
 * back and up, back and down. Behind the racer, so whoever chases it gets the first chance at them.
 * 0.6 and 0.8 make a unit vector without running engine trig.
 */
const SCATTER: readonly Vec[] = [
  { x: -1, y: 0 },
  { x: -0.6, y: -0.8 },
  { x: -0.6, y: 0.8 },
];

/**
 * `count` new loose pearls at `at` (world px), moving away along SCATTER (mirrored for a racer
 * facing left) at PEARL.scatterSpeed. Directions repeat past the third pearl.
 *
 * @param droppedBy The racer that dropped them, who must wait before collecting one; null when nobody
 *   did (an enemy's burst), so anyone may collect them at once.
 */
export function scatterPearls(at: Vec, facing: 1 | -1, count: number, droppedBy: RacerId | null): LoosePearl[] {
  return Array.from({ length: count }, (_, index): LoosePearl => {
    const direction = SCATTER[index % SCATTER.length] as Vec;
    return {
      at: { ...at },
      vel: { x: direction.x * facing * PEARL.scatterSpeed, y: direction.y * PEARL.scatterSpeed },
      age: 0,
      droppedBy,
    };
  });
}

/**
 * Moves `pearl` one tick: its velocity keeps PEARL.dragPerTick (and gains AIR_GRAVITY while it is in
 * the air), then each axis moves by `vel * dt` unless that would put its centre in a solid tile or
 * carry it from water into air, in which case that axis stops.
 *
 * @param dt Tick length in seconds.
 */
export function driftPearl(world: World, pearl: LoosePearl, dt: number): void {
  pearl.vel.x *= PEARL.dragPerTick;
  pearl.vel.y *= PEARL.dragPerTick;
  if (isAirAt(world.level, pearl.at.x, pearl.at.y)) pearl.vel.y += AIR_GRAVITY * dt;
  const nextX = pearl.at.x + pearl.vel.x * dt;
  if (blocked(world, pearl.at, { x: nextX, y: pearl.at.y })) pearl.vel.x = 0;
  else pearl.at.x = nextX;
  const nextY = pearl.at.y + pearl.vel.y * dt;
  if (blocked(world, pearl.at, { x: pearl.at.x, y: nextY })) pearl.vel.y = 0;
  else pearl.at.y = nextY;
}

/** True when a pearl may not step from `from` to `to`: into a solid tile, or out of the water into air. */
function blocked(world: World, from: Vec, to: Vec): boolean {
  if (isSolid(world.level, world.broken, Math.floor(to.x / TILE), Math.floor(to.y / TILE))) return true;
  return isAirAt(world.level, to.x, to.y) && !isAirAt(world.level, from.x, from.y);
}
