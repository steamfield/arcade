/**
 * Swim's navigation: what a swimmer pays to enter each tile, the three flow fields built from those
 * prices (see FlowFields), and the level check that every start can reach the finish. Walking the
 * fields lives in `way.ts` and `ai/steer.ts`.
 */
import { distancesToFinish, type EntryCost, fieldAt } from '../../race/flowfield.ts';
import type { Cell, Level, Vec } from '../../types.ts';
import type { LevelProblem, MediumNav } from '../types.ts';
import { type SwimNav, swimNav } from './data.ts';

const KELP_COST = 2.5;
const WITH_CURRENT_COST = 0.4;
const AGAINST_CURRENT_COST = 3;
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
 * What a swimmer feels: kelp drags, currents help or hinder, unbroken coral is a wall, air is dear.
 * Swim's `enterCost`.
 */
export const steerCost: EntryCost = (cell, isBroken, move) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return KELP_COST;
  if (cell === 'air') return AIR_COST;
  const current = CURRENT_DIRECTION[cell];
  return current ? currentCost(current, move) : 1;
};

/**
 * A diagonal entry counts as with or against the current by the sign of its component along
 * the current, the same as a straight one; only a move with no component along it is across.
 */
function currentCost(current: Vec, move: Vec): number {
  const along = current.x * move.x + current.y * move.y;
  if (along > 0) return WITH_CURRENT_COST;
  if (along < 0) return AGAINST_CURRENT_COST;
  return 1;
}

/** Like steer, but a racer able to break coral may plough through it at a price. */
const smashCost: EntryCost = (cell, isBroken, move) =>
  cell === 'coral' && !isBroken ? SMASH_CORAL_COST : steerCost(cell, isBroken, move);

/** Like steer, but a racer that rams through coral as it swims pays only a little for it. */
const ramCost: EntryCost = (cell, isBroken, move) =>
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
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(fields.steer, fields, start))
      ? []
      : [{ message: `Start ${index + 1} cannot reach the finish without breaking coral`, row: start.y, col: start.x }],
  );
}
