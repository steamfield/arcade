/**
 * The way to the finish as drift answers it, from its fields: an aim from a body on any of the three
 * routes, the next tile from a tile, the distance left, and whether ice lies just ahead.
 */
import { downhillPath, hasClearSweep, openTiles, steerDirection } from '../../ai/steer.ts';
import { cellAt, cornerIsClear, isSolid, NEIGHBOURS, tileCentre, tileIndex, tileOf } from '../../level/query.ts';
import { length } from '../../num.ts';
import { fieldAt } from '../../race/flowfield.ts';
import { centreOf } from '../../racers.ts';
import { isWarpCoolingDown } from '../../setpieces/wormholes.ts';
import type { Box, Racer, Vec, World } from '../../types.ts';
import { type DriftNav, driftNav } from './way-data.ts';

/** Which field a drifter follows: round ice, through it at a price, or ramming through it. */
export type DriftRoute = 'steer' | 'smash' | 'ram';

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

interface WormholeApproach {
  aim: Vec;
  waiting: boolean;
}

/**
 * Precise aim near a wormhole. A nearby entry ends the route if the field wants to use it.
 * Otherwise follow the field's way around it without wobble or a dash cutting across.
 */
export function wormholeApproach(
  world: World,
  racer: Racer,
  route: DriftRoute,
  lookahead: number,
): WormholeApproach | null {
  if (world.level.wormholes.length === 0) return null;
  const nav = driftNav(world.nav);
  const centre = centreOf(racer);
  const at = tileOf(centre);
  const isEntry = (tile: Vec) => nav.wormholeEntries.has(tileIndex(world.level, tile.x, tile.y));
  const near = ([x, y]: readonly [number, number]) =>
    x < world.level.finishX && Math.max(Math.abs(at.x - x), Math.abs(at.y - y)) <= lookahead;
  if (!world.level.wormholes.some(({ a, b, oneWay }) => near(a) || (!oneWay && near(b)))) return null;

  const field = fieldOf(nav, route);
  const open = openTiles(world.level, world.broken, route !== 'steer');
  const aimAt = (tile: Vec) => {
    const target = tileCentre(tile);
    const x = target.x - centre.x;
    const y = target.y - centre.y;
    const distance = length(x, y);
    return distance === 0 ? { x: 0, y: 0 } : { x: x / distance, y: y / distance };
  };
  const coolingDown = isWarpCoolingDown(world, racer.id);
  if (isEntry(at)) return approachOnMouth(field, nav, at, open, aimAt, coolingDown);

  const path = downhillPath(field, nav, open, at, lookahead);
  const target = targetPastMouths(world, racer.body, centre, at, path, isEntry);
  return target ? { aim: aimAt(target), waiting: isEntry(target) && coolingDown } : null;
}

/** Leave an arrival mouth if the field improves away from it or hold inside it for the warp. */
function approachOnMouth(
  field: Float32Array,
  nav: DriftNav,
  at: Vec,
  open: (x: number, y: number) => boolean,
  aimAt: (tile: Vec) => Vec,
  coolingDown: boolean,
): WormholeApproach {
  let exit: Vec | null = null;
  let best = fieldAt(field, nav, at);
  for (const offset of NEIGHBOURS) {
    const tile = { x: at.x + offset.x, y: at.y + offset.y };
    const value = fieldAt(field, nav, tile);
    if (value >= best || !open(tile.x, tile.y) || !cornerIsClear(at, offset, open)) continue;
    best = value;
    exit = tile;
  }
  return exit ? { aim: aimAt(exit), waiting: false } : { aim: { x: 0, y: 0 }, waiting: coolingDown };
}

/** Walk the downhill path as far as the racer can aim without clipping a wall or an unintended mouth. */
function targetPastMouths(
  world: World,
  body: Box,
  centre: Vec,
  at: Vec,
  path: readonly Vec[],
  isEntry: (tile: Vec) => boolean,
): Vec | undefined {
  let target: Vec | undefined;
  for (const tile of path) {
    const end = tileCentre(tile);
    if (crossesOtherMouth(centre, end, tile, isEntry)) {
      if (target) break;
      // A diagonal step past an entry may clip its corner. Fly the open side of that step first.
      const sides = [
        { x: at.x, y: tile.y },
        { x: tile.x, y: at.y },
      ];
      target = sides.find((side) => (side.x !== at.x || side.y !== at.y) && !isEntry(side));
      break;
    }
    if (target && !hasClearSweep(world.level, world.broken, body, end)) break;
    target = tile;
    if (isEntry(tile)) break;
  }
  return target;
}

/** Check the centre's straight approach for entry tiles, except the mouth it is aiming at. */
function crossesOtherMouth(from: Vec, to: Vec, target: Vec, isEntry: (tile: Vec) => boolean): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.ceil(length(dx, dy));
  for (let step = 1; step < steps; step++) {
    const tile = tileOf({ x: from.x + (dx * step) / steps, y: from.y + (dy * step) / steps });
    if ((tile.x !== target.x || tile.y !== target.y) && isEntry(tile)) return true;
  }
  return false;
}
