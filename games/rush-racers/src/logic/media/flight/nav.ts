/**
 * Flight's navigation over a level: what a flyer pays to enter each tile, the two distance fields
 * to the finish built from those prices (steer, with puff clouds closed, and ram, with them open at
 * a price), and the level check that every start can reach the finish without popping one. Its nav
 * is a `FlightNav` (`way-data.ts`); `way.ts` reads it.
 */
import { cellAt } from '../../level/query.ts';
import { distancesToFinish, type EntryCost, fieldAt } from '../../race/flowfield.ts';
import type { Cell, Level, Vec } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type FlightNav, flightNav } from './way-data.ts';

/** A fog bank slows a flyer to well under cruise. */
const FOG_COST = 2.5;
/** Flying with the wind (a gust, or up an updraft) is quick. */
const WITH_WIND_COST = 0.5;
/** Flying into the wind (against a gust, or up a downdraft) is slow. */
const AGAINST_WIND_COST = 3;
/** A puff cloud on the ram field, entered sideways: cheap, since a dash pops it, but dearer than open sky. */
const RAM_PUFF_COST = 3;
/** Rows at the bottom of a column open to the sky below where a flyer is near falling out. */
const LOW_SKY_ROWS = 4;
/**
 * Added to the price of entering a low tile over open sky: dear enough that the way climbs a few
 * rows to pass over a floor gap, but finite, so it still leads through when an overhang leaves no
 * higher way.
 */
const LOW_SKY_EXTRA = 4;

const WIND_DIRECTION: Partial<Record<Cell, Vec>> = {
  'current-right': { x: 1, y: 0 },
  'current-left': { x: -1, y: 0 },
  'current-up': { x: 0, y: -1 },
  'current-down': { x: 0, y: 1 },
};

/** What a flyer feels: rock and unbroken puff clouds are walls, fog is slow, wind helps or hinders. Flight's `enterCost`. */
export const flightCost = (cell: Cell, isBroken: boolean, move: Vec): number => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return FOG_COST;
  const wind = WIND_DIRECTION[cell];
  return wind ? windCost(wind, move) : 1;
};

/** With or against the wind by the sign of the move's component along it; across it costs as open sky. */
function windCost(wind: Vec, move: Vec): number {
  const along = wind.x * move.x + wind.y * move.y;
  if (along > 0) return WITH_WIND_COST;
  if (along < 0) return AGAINST_WIND_COST;
  return 1;
}

/**
 * Like flight's cost, but an unbroken puff cloud entered sideways (straight or diagonally) is open
 * at a price, for a flyer that will dash through it. A dash only goes sideways, so a cloud entered
 * straight up or down stays closed.
 */
const ramCost = (cell: Cell, isBroken: boolean, move: Vec): number => {
  if (cell !== 'coral' || isBroken) return flightCost(cell, isBroken, move);
  const vertical = move.x === 0 && move.y !== 0;
  return vertical ? Number.POSITIVE_INFINITY : RAM_PUFF_COST;
};

/** Flight's nav for `level` with `broken` puff clouds open: the steer and ram fields, each kept off the bottom over open sky. */
export function buildFlightNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): FlightNav {
  return {
    kind: 'flight',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, keptOffLowSky(level, flightCost)),
    ram: distancesToFinish(level, broken, keptOffLowSky(level, ramCost)),
  };
}

/** `cost` with LOW_SKY_EXTRA added for entering an open tile in the bottom LOW_SKY_ROWS rows of a column open to the sky below. */
function keptOffLowSky(level: Level, cost: (cell: Cell, isBroken: boolean, move: Vec) => number): EntryCost {
  return (cell, isBroken, move, tile) => {
    const price = cost(cell, isBroken, move);
    return Number.isFinite(price) && isLowSky(level, tile) ? price + LOW_SKY_EXTRA : price;
  };
}

/** Whether `tile` is in the bottom LOW_SKY_ROWS rows of a column whose last row is open sky (not rock or a puff cloud). */
function isLowSky(level: Level, tile: Vec): boolean {
  const bottom = cellAt(level, tile.x, level.height - 1);
  return tile.y >= level.height - LOW_SKY_ROWS && bottom !== 'rock' && bottom !== 'coral';
}

/**
 * One problem for each start that can't reach the finish without popping a puff cloud, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateFlightLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const flight = flightNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(flight.steer, flight, start))
      ? []
      : [
          {
            message: `Start ${index + 1} cannot reach the finish flying without popping a puff cloud`,
            row: start.y,
            col: start.x,
          },
        ],
  );
}
