/**
 * Glide's navigation, its own and deliberately simpler than swim's: one uniform-cost distance to the
 * finish with rock and unbroken coral closed, a one-tile-ahead way over it, and a level check that
 * every start can reach the finish. Glide can't break coral on purpose, so it never sees coral ahead.
 *
 * `MediumNav` is FlowFields-shaped until a second shipped medium makes it a union, so glide stores
 * its one field in all three slots (`steer`, `smash`, `ram`) and reads only `steer`. Test-only.
 */

import { isSolid } from '../level/query.ts';
import type { LevelProblem } from '../media/types.ts';
import { length } from '../num.ts';
import { cornerIsClear, distancesToFinish, type EntryCost, fieldAt, NEIGHBOURS } from '../race/flowfield.ts';
import { type Box, type FlowFields, type Level, TILE, type Vec, type World } from '../types.ts';

/** Every open tile costs the same; rock and unbroken coral are closed. */
export const glideCost: EntryCost = (cell, isBroken) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/** Glide's nav for `level` with `broken` coral open: its one distance field in every slot. */
export function buildGlideNav(level: Level, broken: ReadonlySet<number>): FlowFields {
  const distance = distancesToFinish(level, broken, glideCost);
  return { width: level.width, height: level.height, steer: distance, smash: distance, ram: distance };
}

/** The distance to the finish from `tile`; Infinity off the grid or where it can't be reached. */
export function glideDistanceAt(world: World, tile: Vec): number {
  return fieldAt(world.nav.steer, world.nav, tile);
}

/** Offset of the open neighbour of `tile` nearest the finish, never across a closed corner; null at the finish or boxed in. */
export function glideNextTile(world: World, tile: Vec): Vec | null {
  const open = (tx: number, ty: number) => !isSolid(world.level, world.broken, tx, ty);
  let best: Vec | null = null;
  let bestDistance = glideDistanceAt(world, tile);
  for (const offset of NEIGHBOURS) {
    const distance = glideDistanceAt(world, { x: tile.x + offset.x, y: tile.y + offset.y });
    if (distance >= bestDistance || !open(tile.x + offset.x, tile.y + offset.y) || !cornerIsClear(tile, offset, open)) {
      continue;
    }
    best = offset;
    bestDistance = distance;
  }
  return best ? { ...best } : null;
}

/** Unit aim from the body's centre to the centre of the next tile on the way; zero at the finish. Looks one tile ahead whatever `lookaheadTiles` asks. */
export function glideAimFrom(world: World, body: Box, _lookaheadTiles: number): Vec {
  const centre = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
  const tile = { x: Math.floor(centre.x / TILE), y: Math.floor(centre.y / TILE) };
  const step = glideNextTile(world, tile);
  if (!step) return { x: 0, y: 0 };
  const target = { x: (tile.x + step.x + 0.5) * TILE, y: (tile.y + step.y + 0.5) * TILE };
  const distance = length(target.x - centre.x, target.y - centre.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (target.x - centre.x) / distance, y: (target.y - centre.y) / distance };
}

/** One problem for each start that can't reach the finish, located at that start. */
export function validateGlideLevel(level: Level, nav: FlowFields): LevelProblem[] {
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(nav.steer, nav, start))
      ? []
      : [{ message: `Start ${index + 1} cannot reach the finish gliding`, row: start.y, col: start.x }],
  );
}
