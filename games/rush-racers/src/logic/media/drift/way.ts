/**
 * The way to the finish as drift answers it, from its steer field: an aim from a body, the next
 * tile from a tile, the distance left, and whether ice lies just ahead.
 */
import { downhillPath, openTiles, steerDirection } from '../../ai/steer.ts';
import { fieldAt } from '../../race/flowfield.ts';
import type { Box, Vec, World } from '../../types.ts';
import { driftNav } from './way-data.ts';

/**
 * Unit aim from `body` toward the tile `lookaheadTiles` steps down the steer field; zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftAimFrom(world: World, body: Box, lookaheadTiles: number): Vec {
  const nav = driftNav(world.nav);
  return steerDirection(nav.steer, nav, world.level, world.broken, body, lookaheadTiles);
}

/**
 * Offset of the steer field's lowest open neighbour of `tile`; null at the finish or when boxed in.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftNextTile(world: World, tile: Vec): Vec | null {
  const nav = driftNav(world.nav);
  const next = downhillPath(nav.steer, nav, openTiles(world.level, world.broken, false), tile, 1)[0];
  return next ? { x: next.x - tile.x, y: next.y - tile.y } : null;
}

/**
 * The steer field at `tile`; Infinity off the grid or where the finish can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftDistanceAt(world: World, tile: Vec): number {
  const nav = driftNav(world.nav);
  return fieldAt(nav.steer, nav, tile);
}

/** Whether unbroken ice lies within `steps` tiles along the way a racer able to break it would take. */
export function driftIceAhead(_world: World, _tile: Vec, _steps: number): boolean {
  return false;
}
