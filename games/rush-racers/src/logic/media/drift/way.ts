/**
 * The way to the finish as drift answers it, from its fields: an aim from a body on any of the three
 * routes, the next tile from a tile, the distance left, whether ice lies just ahead, and the two
 * questions a drifter with momentum asks of the space in front of it: how far it can fly straight
 * before a wall, and whether the way runs straight ahead.
 */
import { downhillPath, hasClearSweep, openTiles, steerDirection, tileOf } from '../../ai/steer.ts';
import { cellAt, isSolid } from '../../level/query.ts';
import { length } from '../../num.ts';
import { fieldAt } from '../../race/flowfield.ts';
import { type Box, TILE, type Vec, type World } from '../../types.ts';
import { type DriftNav, driftNav } from './way-data.ts';

/** Which field a drifter follows: round ice, through it at a price, or ramming through it. */
export type DriftRoute = 'steer' | 'smash' | 'ram';

const centreOf = (body: Box): Vec => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });
const tileCentre = (tile: Vec): Vec => ({ x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE });
const fieldOf = (nav: DriftNav, route: DriftRoute): Float32Array => nav[route];

/**
 * Unit aim from `body` toward the tile `lookaheadTiles` steps down the steer field; zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftAimFrom(world: World, body: Box, lookaheadTiles: number): Vec {
  return driftRouteAim(world, body, lookaheadTiles, 'steer');
}

/**
 * Unit aim from `body` toward the tile `lookaheadTiles` steps down `route`'s field; on the smash and
 * ram fields the walk may enter unbroken ice. Zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftRouteAim(world: World, body: Box, lookaheadTiles: number, route: DriftRoute): Vec {
  const nav = driftNav(world.nav);
  const field = fieldOf(nav, route);
  return steerDirection(field, nav, world.level, world.broken, body, lookaheadTiles, route !== 'steer');
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

/**
 * True when unbroken ice lies within `steps` tiles down the smash field from `tile`, so a Shock
 * Bubble or Comet would open the way.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function driftIceAhead(world: World, tile: Vec, steps: number): boolean {
  const { level, broken } = world;
  const nav = driftNav(world.nav);
  const path = downhillPath(nav.smash, nav, openTiles(level, broken, true), tile, steps);
  return path.some((step) => cellAt(level, step.x, step.y) === 'coral' && isSolid(level, broken, step.x, step.y));
}
