/**
 * Swim's navigation: what a swimmer pays to enter each tile, the three flow fields built from those
 * prices (see FlowFields), and the level check that every start can reach the finish. Walking the
 * fields lives in `way.ts` and `ai/steer.ts`.
 */
import { isRockLike } from '../../level/query.ts';
import { alongCost, distancesToFinish, type FlowPrices, unreachableStarts } from '../../race/flowfield.ts';
import type { Cell, Level, Vec } from '../../types.ts';
import type { LevelProblem, MediumNav } from '../types.ts';
import { type SwimNav, swimNav } from './data.ts';

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
 * Swim's `enterCost`.
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

/** Builds the steer, smash and ram fields by Dijkstra from the finish column, with `broken` coral open. */
export function buildSwimNav(level: Level, broken: ReadonlySet<number>): SwimNav {
  return {
    kind: 'swim',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, steerCost),
    smash: distancesToFinish(level, broken, smashCost),
    ram: distancesToFinish(level, broken, ramCost),
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
