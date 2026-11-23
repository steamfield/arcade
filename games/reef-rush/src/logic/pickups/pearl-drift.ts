/**
 * How a loose pearl moves: scattered from a hit racer at a fixed fan of directions, then slowed by
 * drag each tick. It never enters a solid tile: an axis whose next step would land in rock (or
 * unbroken coral) loses its speed instead. No randomness, so a drop never shifts any rng stream.
 */
import { isSolid } from '../level/query.ts';
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
 * Moves `pearl` one tick: its velocity keeps PEARL.dragPerTick, then each axis moves by `vel * dt`
 * unless that would put its centre in a solid tile, in which case that axis stops.
 *
 * @param dt Tick length in seconds.
 */
export function driftPearl(world: World, pearl: LoosePearl, dt: number): void {
  pearl.vel.x *= PEARL.dragPerTick;
  pearl.vel.y *= PEARL.dragPerTick;
  const nextX = pearl.at.x + pearl.vel.x * dt;
  if (solidAt(world, nextX, pearl.at.y)) pearl.vel.x = 0;
  else pearl.at.x = nextX;
  const nextY = pearl.at.y + pearl.vel.y * dt;
  if (solidAt(world, pearl.at.x, nextY)) pearl.vel.y = 0;
  else pearl.at.y = nextY;
}

function solidAt(world: World, x: number, y: number): boolean {
  return isSolid(world.level, world.broken, Math.floor(x / TILE), Math.floor(y / TILE));
}
