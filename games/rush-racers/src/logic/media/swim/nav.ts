/**
 * Swim's navigation: what a swimmer pays to enter each tile, the three flow fields built from those
 * prices (see FlowFields), and the level check that every start can reach the finish. Walking the
 * fields lives in `way.ts` and `ai/steer.ts`.
 */
import type { StepPrice } from '../../ai/steer.ts';
import { cellAt, isRockLike, tileIndex } from '../../level/query.ts';
import { length } from '../../num.ts';
import {
  alongCost,
  distancesToFinish,
  type EntryCost,
  type FlowPrices,
  unreachableStarts,
} from '../../race/flowfield.ts';
import { whirlpoolFlowAt } from '../../setpieces/whirlpools.ts';
import { type Cell, type Level, TILE, type Vec, type World } from '../../types.ts';
import type { LevelProblem, MediumNav } from '../types.ts';
import { type SwimNav, swimNav } from './data.ts';
import { SWIM_TUNING } from './tuning.ts';

const KELP_COST = 2.5;
/** Swimming with a current is quick; against it is slow. */
const CURRENT_PRICES: FlowPrices = { withFlow: 0.4, againstFlow: 3 };
const SMASH_CORAL_COST = 6;
const RAM_CORAL_COST = 3;
/** Air above a surface: a swimmer can only arc through it, so it is a costly way round. */
const AIR_COST = 4;

const CURRENT_DIRECTION: Partial<Record<Cell, Vec>> = {
  'current-right': { x: 1, y: 0 },
  'current-left': { x: -1, y: 0 },
  'current-up': { x: 0, y: -1 },
  'current-down': { x: 0, y: 1 },
};

/**
 * What a swimmer feels: rock (and a bounce cloud, rock-like) and unbroken coral are walls, kelp
 * drags, currents help or hinder, air is dear.
 * Swim's terrain price before the local whirlpool flow.
 */
export const steerCost = (cell: Cell, isBroken: boolean, move: Vec): number => {
  if (isRockLike(cell)) return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return KELP_COST;
  if (cell === 'air') return AIR_COST;
  const current = CURRENT_DIRECTION[cell];
  return current ? alongCost(current, move, CURRENT_PRICES) : 1;
};

/** Like steer, but a racer able to break coral may plough through it at a price. */
const smashCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? SMASH_CORAL_COST : steerCost(cell, isBroken, move);

/** Like steer, but a racer that rams through coral as it swims pays only a little for it. */
const ramCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? RAM_CORAL_COST : steerCost(cell, isBroken, move);

export type SwimRoute = 'steer' | 'smash' | 'ram';

const TERRAIN_COST = { steer: steerCost, smash: smashCost, ram: ramCost };

/** Prices the pool like a current, tapering the discount and penalty as the flow drops off. */
function entryCostFor(level: Level, route: SwimRoute): EntryCost {
  const cost = TERRAIN_COST[route];
  if (level.whirlpools.length === 0) return cost;
  return (cell, isBroken, move, tile) => {
    const base = cost(cell, isBroken, move);
    if (!Number.isFinite(base)) return base;
    const point = { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
    for (const pool of level.whirlpools) {
      const flow = whirlpoolFlowAt(pool, point);
      if (!flow) continue;
      const strength = Math.min(1, length(flow.x, flow.y) / SWIM_TUNING.extra.currentForce);
      return base * (1 + strength * (alongCost(flow, move, CURRENT_PRICES) - 1));
    }
    return base;
  };
}

/** The steer field's tile entry price, including whirlpool flow. */
export function swimEnterCost(cell: Cell, isBroken: boolean, move: Vec, tile: Vec, level: Level): number {
  return entryCostFor(level, 'steer')(cell, isBroken, move, tile);
}

/** The same entry prices the field used, so a rival can follow its cheapest route past a pool. */
export function swimStepPrice(world: World, route: SwimRoute): StepPrice | undefined {
  const { level, broken } = world;
  if (level.whirlpools.length === 0) return undefined;
  const cost = entryCostFor(level, route);
  return (tile, move) => cost(cellAt(level, tile.x, tile.y), broken.has(tileIndex(level, tile.x, tile.y)), move, tile);
}

/** Builds the steer, smash and ram fields by Dijkstra from the finish column, with `broken` coral open. */
export function buildSwimNav(level: Level, broken: ReadonlySet<number>): SwimNav {
  return {
    kind: 'swim',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, entryCostFor(level, 'steer')),
    smash: distancesToFinish(level, broken, entryCostFor(level, 'smash')),
    ram: distancesToFinish(level, broken, entryCostFor(level, 'ram')),
  };
}

/**
 * Why `level` can't be swum: one problem for each start tile that can't reach the finish on the
 * steer field, located at that tile. `createWorld` rejects ledges itself.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateSwimLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const fields = swimNav(nav);
  return unreachableStarts(level, fields.steer, fields, 'cannot reach the finish without breaking coral');
}
