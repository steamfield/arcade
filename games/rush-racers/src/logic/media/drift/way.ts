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

/** Pixels between samples when sweeping a box along a direction. */
const SWEEP_STEP_PX = 2;
/** Shrinks the swept box so an edge lying on a tile boundary doesn't count as touching the next tile. */
const EDGE_INSET_PX = 0.001;
/** Largest angle, as a cosine, between a direction and the way ahead for the way to count as straight (about 18 degrees). */
const STRAIGHT_ALIGNMENT = 0.95;

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

/**
 * How far, in px, `body` can slide along the unit `dir` before its box touches a solid tile, up to
 * `maxPx`. `maxPx` when `dir` is zero.
 */
export function freeDistanceAlong(world: World, body: Box, dir: Vec, maxPx: number): number {
  if (dir.x === 0 && dir.y === 0) return maxPx;
  const halfW = body.w / 2 - EDGE_INSET_PX;
  const halfH = body.h / 2 - EDGE_INSET_PX;
  const from = centreOf(body);
  for (let travelled = SWEEP_STEP_PX; travelled <= maxPx; travelled += SWEEP_STEP_PX) {
    const x = from.x + dir.x * travelled;
    const y = from.y + dir.y * travelled;
    const blocked =
      isSolid(world.level, world.broken, Math.floor((x - halfW) / TILE), Math.floor((y - halfH) / TILE)) ||
      isSolid(world.level, world.broken, Math.floor((x + halfW) / TILE), Math.floor((y - halfH) / TILE)) ||
      isSolid(world.level, world.broken, Math.floor((x - halfW) / TILE), Math.floor((y + halfH) / TILE)) ||
      isSolid(world.level, world.broken, Math.floor((x + halfW) / TILE), Math.floor((y + halfH) / TILE));
    if (blocked) return travelled - SWEEP_STEP_PX;
  }
  return maxPx;
}

/**
 * True when the steer field runs `tiles` steps on from `body`'s tile, the body can slide straight
 * to the last of them, and that tile lies within about 18 degrees of the unit `dir`.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function wayRunsStraight(world: World, body: Box, dir: Vec, tiles: number): boolean {
  const nav = driftNav(world.nav);
  const centre = centreOf(body);
  const path = downhillPath(nav.steer, nav, openTiles(world.level, world.broken, false), tileOf(centre), tiles);
  const last = path[tiles - 1];
  if (!last) return false;
  const end = tileCentre(last);
  const dx = end.x - centre.x;
  const dy = end.y - centre.y;
  const distance = length(dx, dy);
  if (distance === 0 || (dx * dir.x + dy * dir.y) / distance < STRAIGHT_ALIGNMENT) return false;
  return hasClearSweep(world.level, world.broken, body, end);
}
