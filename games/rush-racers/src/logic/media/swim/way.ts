/**
 * The way to the finish as swim answers it, from the steer field: an aim from a body, the next tile
 * from a tile, the distance left, and whether coral lies just ahead on the smash field (the one swim
 * question the rivals' item choice asks).
 */
import { downhillPath, openTiles, steerDirection } from '../../ai/steer.ts';
import { cellAt, isSolid } from '../../level/query.ts';
import { fieldAt } from '../../race/flowfield.ts';
import type { Box, Vec, World } from '../../types.ts';
import { swimNav } from './data.ts';
import { swimStepPrice } from './nav.ts';

/**
 * Unit aim from `body` toward the tile `lookaheadTiles` steps down the steer field; zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function swimAimFrom(world: World, body: Box, lookaheadTiles: number): Vec {
  const nav = swimNav(world.nav);
  return steerDirection(
    nav.steer,
    nav,
    world.level,
    world.broken,
    body,
    lookaheadTiles,
    false,
    swimStepPrice(world, 'steer'),
  );
}

/**
 * Offset of the steer field's lowest open neighbour of `tile`; null at the finish or when boxed in.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function swimNextTile(world: World, tile: Vec): Vec | null {
  const nav = swimNav(world.nav);
  const next = downhillPath(
    nav.steer,
    nav,
    openTiles(world.level, world.broken, false),
    tile,
    1,
    swimStepPrice(world, 'steer'),
  )[0];
  return next ? { x: next.x - tile.x, y: next.y - tile.y } : null;
}

/**
 * The steer field at `tile`; Infinity off the grid or where the finish can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function swimDistanceAt(world: World, tile: Vec): number {
  const nav = swimNav(world.nav);
  return fieldAt(nav.steer, nav, tile);
}

/**
 * True when unbroken coral lies within `steps` tiles down the smash field from `tile`, so a Puffer or Cannonball would open the way.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function coralOnSmashPath(world: World, tile: Vec, steps: number): boolean {
  const { level, broken } = world;
  const nav = swimNav(world.nav);
  const path = downhillPath(nav.smash, nav, openTiles(level, broken, true), tile, steps, swimStepPrice(world, 'smash'));
  return path.some((step) => cellAt(level, step.x, step.y) === 'coral' && isSolid(level, broken, step.x, step.y));
}
