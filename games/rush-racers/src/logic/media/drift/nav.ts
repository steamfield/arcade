/**
 * Drift's navigation: what a drifter pays to enter each tile, the three flow fields built from those
 * prices (steer, smash and ram, see `DriftNav`), and the level check that every start can reach the
 * finish. Walking the fields lives in `way.ts`.
 */
import { isSolid } from '../../level/query.ts';
import { distancesToFinish, type EntryCost, fieldAt, NEIGHBOURS } from '../../race/flowfield.ts';
import type { Cell, Level, Vec } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type DriftNav, driftNav } from './way-data.ts';

/** Nebula dust lowers cruise and drags, so a way through it is dear. */
const DUST_COST = 2.5;
/** Riding a solar wind lane along its arrow is cheap; flying against it is dear. */
const WITH_WIND_COST = 0.4;
const AGAINST_WIND_COST = 3;
/** Price of ploughing through unbroken ice for a racer able to break it. */
const SMASH_ICE_COST = 6;
/** Price of unbroken ice for a racer that rams through it as it flies. */
const RAM_ICE_COST = 3;
/**
 * Extra price of a tile touching a solid one, side or corner. A drifter can't stop on the spot, so
 * the way keeps a tile off the walls wherever the space is wide enough to.
 */
const BESIDE_WALL_COST = 0.5;

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
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return DUST_COST;
  const wind = WIND_DIRECTION[cell];
  return wind ? windCost(wind, move) : 1;
};

/** A move counts as with or against the wind by the sign of its component along the wind's arrow. */
function windCost(wind: Vec, move: Vec): number {
  const along = wind.x * move.x + wind.y * move.y;
  if (along > 0) return WITH_WIND_COST;
  if (along < 0) return AGAINST_WIND_COST;
  return 1;
}

/** Like `driftCost`, but a racer able to break ice may plough through it at a price. */
const smashCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? SMASH_ICE_COST : driftCost(cell, isBroken, move);

/** Like `driftCost`, but a racer that rams through ice as it flies pays only a little for it. */
const ramCost = (cell: Cell, isBroken: boolean, move: Vec): number =>
  cell === 'coral' && !isBroken ? RAM_ICE_COST : driftCost(cell, isBroken, move);

/**
 * Drift's nav for `level` with `broken` ice open: the steer, smash and ram fields, each searched
 * from the finish column with tiles beside a wall a little dearer than open ones.
 */
export function buildDriftNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): DriftNav {
  const besideWall = tilesBesideWalls(level, broken);
  const offWalls =
    (cost: (cell: Cell, isBroken: boolean, move: Vec) => number): EntryCost =>
    (cell, isBroken, move, tile) =>
      cost(cell, isBroken, move) + (besideWall[tile.y * level.width + tile.x] ? BESIDE_WALL_COST : 0);
  return {
    kind: 'drift',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, offWalls(driftCost)),
    smash: distancesToFinish(level, broken, offWalls(smashCost)),
    ram: distancesToFinish(level, broken, offWalls(ramCost)),
  };
}

/** One flag per tile, indexed `y * width + x`: 1 where any of its eight neighbours is solid. */
function tilesBesideWalls(level: Level, broken: ReadonlySet<number>): Uint8Array {
  const flags = new Uint8Array(level.width * level.height);
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      const touches = NEIGHBOURS.some((offset) => isSolid(level, broken, tx + offset.x, ty + offset.y));
      flags[ty * level.width + tx] = touches ? 1 : 0;
    }
  }
  return flags;
}

/**
 * Why `level` can't be drifted: one problem for each start that can't reach the finish without
 * breaking ice, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateDriftLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const drift = driftNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(drift.steer, drift, start))
      ? []
      : [{ message: `Start ${index + 1} cannot reach the finish without breaking ice`, row: start.y, col: start.x }],
  );
}
