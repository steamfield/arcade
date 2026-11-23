/**
 * What a drift pilot looks ahead for: how far a racer can slide before a wall, and whether the way
 * on runs straight. Only the pilot reads these; the `Medium` members live in `way.ts`.
 */
import { downhillPath, hasClearSweep, openTiles, tileOf } from '../../ai/steer.ts';
import { length } from '../../num.ts';
import { type Box, TILE, type Vec, type World } from '../../types.ts';
import { driftNav } from './way-data.ts';

/** Pixels between samples when sweeping a box along a direction. */
const SWEEP_STEP_PX = 2;
/** Shrinks the swept box so an edge lying on a tile boundary doesn't count as touching the next tile. */
const EDGE_INSET_PX = 0.001;
/** Largest angle, as a cosine, between a direction and the way ahead for the way to count as straight (about 18 degrees). */
const STRAIGHT_ALIGNMENT = 0.95;

const centreOf = (body: Box): Vec => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });
const tileCentre = (tile: Vec): Vec => ({ x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE });

/**
 * How far, in px, `body` can slide along the unit `dir` before its box touches a solid tile, up to
 * `maxPx`. `maxPx` when `dir` is zero. With `throughIce`, unbroken ice counts as open, for a racer
 * that will break what it flies into.
 */
export function freeDistanceAlong(world: World, body: Box, dir: Vec, maxPx: number, throughIce = false): number {
  if (dir.x === 0 && dir.y === 0) return maxPx;
  const open = openTiles(world.level, world.broken, throughIce);
  const halfW = body.w / 2 - EDGE_INSET_PX;
  const halfH = body.h / 2 - EDGE_INSET_PX;
  const from = centreOf(body);
  for (let travelled = SWEEP_STEP_PX; travelled <= maxPx; travelled += SWEEP_STEP_PX) {
    const x = from.x + dir.x * travelled;
    const y = from.y + dir.y * travelled;
    const left = Math.floor((x - halfW) / TILE);
    const right = Math.floor((x + halfW) / TILE);
    const top = Math.floor((y - halfH) / TILE);
    const bottom = Math.floor((y + halfH) / TILE);
    if (!(open(left, top) && open(right, top) && open(left, bottom) && open(right, bottom))) {
      return travelled - SWEEP_STEP_PX;
    }
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
