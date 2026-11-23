/**
 * Reading flight's nav: the distance at a tile, the next tile on the way (8-way, so the Easy guide
 * points up and down), a full 2D aim along it, the tiles ahead on either field for the pilot (all
 * of them, or up to the next turn), and the puff cloud ahead for a flyer that would dash through it.
 */
import { downhillPath, openTiles, steerDirection } from '../../ai/steer.ts';
import { cellAt, isSolid } from '../../level/query.ts';
import { fieldAt } from '../../race/flowfield.ts';
import type { Box, Vec, World } from '../../types.ts';
import { type FlightRoute, flightNav } from './way-data.ts';

/**
 * The steer field at `tile`; Infinity off the grid or where the finish can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightDistanceAt(world: World, tile: Vec): number {
  const nav = flightNav(world.nav);
  return fieldAt(nav.steer, nav, tile);
}

/**
 * The `route` field at `tile`; Infinity off the grid or where the finish can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightRouteDistanceAt(world: World, tile: Vec, route: FlightRoute): number {
  const nav = flightNav(world.nav);
  return fieldAt(nav[route], nav, tile);
}

/**
 * Up to `steps` tiles from `tile` down the `route` field, never across a closed corner. The ram
 * field's walk may enter unbroken puff clouds.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightWayAhead(world: World, tile: Vec, steps: number, route: FlightRoute): Vec[] {
  const nav = flightNav(world.nav);
  const open = openTiles(world.level, world.broken, route === 'ram');
  return downhillPath(nav[route], nav, open, tile, steps);
}

/**
 * Offset of the steer field's lowest open neighbour of `tile`; null at the finish or boxed in.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightNextTile(world: World, tile: Vec): Vec | null {
  const next = flightWayAhead(world, tile, 1, 'steer')[0];
  return next ? { x: next.x - tile.x, y: next.y - tile.y } : null;
}

/**
 * Unit aim from `body` toward the tile `lookaheadTiles` steps down the steer field, up and down as
 * well as across; zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightAimFrom(world: World, body: Box, lookaheadTiles: number): Vec {
  const nav = flightNav(world.nav);
  return steerDirection(nav.steer, nav, world.level, world.broken, body, lookaheadTiles);
}

/**
 * The tile up to `steps` along the `route` field from `tile`, stopping at the first turn, so a
 * flyer lines up with a shaft or a gap before it heads in rather than cutting the corner into the wall.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightCornerAhead(world: World, tile: Vec, steps: number, route: FlightRoute): Vec {
  let at = tile;
  let heading: Vec | null = null;
  for (const next of flightWayAhead(world, tile, steps, route)) {
    const step = { x: next.x - at.x, y: next.y - at.y };
    if (heading && (step.x !== heading.x || step.y !== heading.y)) break;
    heading = step;
    at = next;
  }
  return at;
}

/**
 * The first unbroken puff cloud within `steps` tiles of `tile` down the ram field; null when none.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightPuffAhead(world: World, tile: Vec, steps: number): Vec | null {
  const { level, broken } = world;
  const way = flightWayAhead(world, tile, steps, 'ram');
  return (
    way.find((step) => cellAt(level, step.x, step.y) === 'coral' && isSolid(level, broken, step.x, step.y)) ?? null
  );
}

/**
 * Whether an unbroken puff cloud lies within `steps` tiles of `tile` down the ram field, so a dash,
 * Puffball or Meteor would open the way.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightCoralAhead(world: World, tile: Vec, steps: number): boolean {
  return flightPuffAhead(world, tile, steps) !== null;
}
