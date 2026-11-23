/**
 * Reading flight's nav: the distance at a tile, the next tile on the way (8-way, so the Easy guide
 * points up and down), a full 2D aim along it, and whether a puff cloud lies ahead.
 *
 * Scaffold baseline, ported from the conformance suite's glide. Phase 1 lane b replaces it.
 */
import { isSolid } from '../../level/query.ts';
import { length } from '../../num.ts';
import { cornerIsClear, fieldAt, NEIGHBOURS } from '../../race/flowfield.ts';
import { type Box, TILE, type Vec, type World } from '../../types.ts';
import { flightNav } from './way-data.ts';

/**
 * The distance to the finish from `tile`; Infinity off the grid or where it can't be reached.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightDistanceAt(world: World, tile: Vec): number {
  const nav = flightNav(world.nav);
  return fieldAt(nav.distance, nav, tile);
}

/**
 * Offset of the open neighbour of `tile` nearest the finish, never across a closed corner; null at
 * the finish or boxed in.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightNextTile(world: World, tile: Vec): Vec | null {
  const open = (tx: number, ty: number) => !isSolid(world.level, world.broken, tx, ty);
  let best: Vec | null = null;
  let bestDistance = flightDistanceAt(world, tile);
  for (const offset of NEIGHBOURS) {
    const next = { x: tile.x + offset.x, y: tile.y + offset.y };
    const distance = flightDistanceAt(world, next);
    if (distance >= bestDistance || !open(next.x, next.y) || !cornerIsClear(tile, offset, open)) continue;
    best = offset;
    bestDistance = distance;
  }
  return best ? { ...best } : null;
}

/**
 * The tile `steps` tiles along the way from `tile` (fewer when the way ends first).
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightTileAhead(world: World, tile: Vec, steps: number): Vec {
  let at = tile;
  for (let i = 0; i < steps; i++) {
    const step = flightNextTile(world, at);
    if (!step) break;
    at = { x: at.x + step.x, y: at.y + step.y };
  }
  return at;
}

/**
 * Unit aim from the body's centre to the centre of the tile `lookaheadTiles` (at least 1) along the
 * way; zero at the finish.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function flightAimFrom(world: World, body: Box, lookaheadTiles: number): Vec {
  const centre = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
  const tile = { x: Math.floor(centre.x / TILE), y: Math.floor(centre.y / TILE) };
  const ahead = flightTileAhead(world, tile, Math.max(1, lookaheadTiles));
  if (ahead.x === tile.x && ahead.y === tile.y) return { x: 0, y: 0 };
  const target = { x: (ahead.x + 0.5) * TILE, y: (ahead.y + 0.5) * TILE };
  const distance = length(target.x - centre.x, target.y - centre.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (target.x - centre.x) / distance, y: (target.y - centre.y) / distance };
}

/** Whether unbroken puff clouds lie within `steps` tiles along the way. Baseline: the way never crosses one. */
export function flightCoralAhead(_world: World, _tile: Vec, _steps: number): boolean {
  return false;
}
