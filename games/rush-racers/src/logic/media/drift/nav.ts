/**
 * Drift's navigation: what a drifter pays to enter each tile, the three flow fields built from those
 * prices (steer, smash and ram, see `DriftNav`), and the level check that every start can reach the
 * finish. A black hole closes the tiles inside its horizon and makes the tiles in its reach dear, so
 * every field keeps clear of it where there is room. Walking the fields lives in `way.ts`.
 */
import { cellAt, isRockLike, isSolid, NEIGHBOURS, tileIndex } from '../../level/query.ts';
import { length } from '../../num.ts';
import {
  alongCost,
  distancesToFinish,
  type EntryCost,
  type FlowPrices,
  unreachableStarts,
} from '../../race/flowfield.ts';
import { wormholeLinks } from '../../race/wormhole-links.ts';
import { type Cell, type Level, TILE, type Vec, type Well } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type DriftNav, driftNav } from './way-data.ts';

/** Nebula dust lowers cruise and drags, so a way through it is dear. */
const DUST_COST = 2.5;
/** Riding a solar wind lane along its arrow is cheap; flying against it is dear. */
const WIND_PRICES: FlowPrices = { withFlow: 0.4, againstFlow: 3 };
/** Price of ploughing through unbroken ice for a racer able to break it. */
const SMASH_ICE_COST = 6;
/** Price of unbroken ice for a racer that rams through it as it flies. */
const RAM_ICE_COST = 3;
/**
 * Extra price of a tile touching a solid one, side or corner. A drifter can't stop on the spot, so
 * the way keeps a tile off the walls wherever the space is wide enough to.
 */
const BESIDE_WALL_COST = 0.5;
/** Leave a buffer around entries the racer isn't aiming to use. */
const BESIDE_MOUTH_COST = 2;
/** Cost in field units of the warp itself. */
const WARP_COST = 1;
/** Extra price of any tile whose centre is inside a black hole's reach, enough to fly round the reach's edge. */
const HOLE_REACH_COST = 2;
/** Further price at the horizon, falling to nothing at the reach's edge, so the way keeps as far out as it can. */
const HOLE_DEPTH_COST = 8;

const WIND_DIRECTION: Partial<Record<Cell, Vec>> = {
  'current-right': { x: 1, y: 0 },
  'current-left': { x: -1, y: 0 },
  'current-up': { x: 0, y: -1 },
  'current-down': { x: 0, y: 1 },
};

/**
 * What a drifter pays to enter `cell` along `move`: rock and unbroken ice are closed, dust is dear,
 * solar wind is cheap along its arrow and dear against it. Drift's `enterCost`.
 */
export const driftCost = (cell: Cell, isBroken: boolean, move: Vec): number => {
  if (isRockLike(cell)) return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return DUST_COST;
  const wind = WIND_DIRECTION[cell];
  return wind ? alongCost(wind, move, WIND_PRICES) : 1;
};

/** Like `driftCost`, but a racer able to break ice may plough through it at a price. */
const smashCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? SMASH_ICE_COST : driftCost(cell, isBroken, move);

/** Like `driftCost`, but a racer that rams through ice as it flies pays only a little for it. */
const ramCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? RAM_ICE_COST : driftCost(cell, isBroken, move);

/**
 * Drift's nav for `level` with `broken` ice open: the steer, smash and ram fields, each searched
 * from the finish column with a surcharge on tiles beside a wall and on tiles near a black hole.
 */
export function buildDriftNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): DriftNav {
  const wormholeEntries = new Set<number>();
  for (const { a, b, oneWay } of level.wormholes) {
    if (a[0] < level.finishX) wormholeEntries.add(tileIndex(level, ...a));
    if (!oneWay && b[0] < level.finishX) wormholeEntries.add(tileIndex(level, ...b));
  }
  const surcharges = tileSurcharges(level, broken, wormholeEntries);
  const field = (cost: EntryCost) => {
    const entry: EntryCost = (cell, isBroken, move, tile) =>
      cost(cell, isBroken, move, tile) + (surcharges[tile.y * level.width + tile.x] ?? 0);
    const stepCost = (tile: Vec, move: Vec) =>
      entry(cellAt(level, tile.x, tile.y), broken.has(tileIndex(level, tile.x, tile.y)), move, tile);
    const links = wormholeLinks(level, stepCost, WARP_COST);
    return distancesToFinish(level, broken, entry, links);
  };
  return {
    kind: 'drift',
    width: level.width,
    height: level.height,
    wormholeEntries,
    steer: field(driftCost),
    smash: field(smashCost),
    ram: field(ramCost),
  };
}

/** Extra cost for tiles beside walls or entries and inside each black hole's reach. */
function tileSurcharges(level: Level, broken: ReadonlySet<number>, entries: ReadonlySet<number>): Float64Array {
  const holes = level.wells.filter((well) => well.horizon !== null);
  const surcharges = new Float64Array(level.width * level.height);
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      const besideWall = NEIGHBOURS.some((offset) => isSolid(level, broken, tx + offset.x, ty + offset.y));
      const centre = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
      const nearHoles = holes.reduce((sum, hole) => sum + holeCost(hole, centre), 0);
      const besideMouth =
        entries.size > 0 &&
        !entries.has(tileIndex(level, tx, ty)) &&
        NEIGHBOURS.some(({ x, y }) => {
          const col = tx + x;
          return col >= 0 && col < level.width && entries.has(tileIndex(level, col, ty + y));
        });
      surcharges[ty * level.width + tx] =
        (besideWall ? BESIDE_WALL_COST : 0) + (besideMouth ? BESIDE_MOUTH_COST : 0) + nearHoles;
    }
  }
  return surcharges;
}

/**
 * What a black hole adds to the price of a tile centred on `point`: Infinity inside its horizon,
 * nothing from its reach outward, and between them HOLE_REACH_COST plus a share of HOLE_DEPTH_COST
 * that grows from nothing at the reach's edge to all of it at the horizon.
 */
function holeCost(hole: Well, point: Vec): number {
  const horizon = hole.horizon ?? 0;
  const distance = length(point.x - hole.centre.x, point.y - hole.centre.y);
  if (distance < horizon) return Number.POSITIVE_INFINITY;
  if (distance >= hole.reach) return 0;
  const depth = (hole.reach - distance) / (hole.reach - horizon);
  return HOLE_REACH_COST + HOLE_DEPTH_COST * depth;
}

/**
 * Why `level` can't be drifted: one problem for each start that can't reach the finish without
 * breaking ice or crossing a black hole's horizon, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateDriftLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const drift = driftNav(nav);
  return unreachableStarts(
    level,
    drift.steer,
    drift,
    "cannot reach the finish without breaking ice or crossing a black hole's horizon",
  );
}
