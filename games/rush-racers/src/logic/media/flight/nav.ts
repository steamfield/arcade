/**
 * Flight's navigation over a level: what a flyer pays to enter each tile, the two distance fields
 * to the finish built from those prices (steer, with puff clouds closed, and ram, with them open at
 * a price), and the level check that every start can reach the finish without popping one. Its nav
 * is a `FlightNav` (`way-data.ts`); `way.ts` reads it.
 */
import { tileIndex } from '../../level/query.ts';
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
/** A puff cloud on the ram field: cheap, since a dash pops it, but dearer than open sky. */
const RAM_PUFF_COST = 3;
/** Rows at the bottom of a column open to the sky below that a flyer is kept out of. */
const LOW_SKY_ROWS = 4;
/** Tiles added to the distance of a low tile over open sky: more than any step to a neighbour costs, so every walk climbs out. */
const LOW_SKY_SURCHARGE = 10;

const WIND_DIRECTION: Partial<Record<Cell, Vec>> = {
  'current-right': { x: 1, y: 0 },
  'current-left': { x: -1, y: 0 },
  'current-up': { x: 0, y: -1 },
  'current-down': { x: 0, y: 1 },
};

/** What a flyer feels: rock and unbroken puff clouds are walls, fog is slow, wind helps or hinders. Flight's `enterCost`. */
export const flightCost: EntryCost = (cell, isBroken, move) => {
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

/** Like flight's cost, but an unbroken puff cloud is open at a price, for a flyer that will dash through it. */
const ramCost: EntryCost = (cell, isBroken, move) =>
  cell === 'coral' && !isBroken ? RAM_PUFF_COST : flightCost(cell, isBroken, move);

/** Flight's nav for `level` with `broken` puff clouds open: the steer and ram fields, each kept off the bottom over open sky. */
export function buildFlightNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): FlightNav {
  return {
    kind: 'flight',
    width: level.width,
    height: level.height,
    steer: keptOffLowSky(level, distancesToFinish(level, broken, flightCost)),
    ram: keptOffLowSky(level, distancesToFinish(level, broken, ramCost)),
  };
}

/**
 * `field` with the bottom LOW_SKY_ROWS tiles of every column whose last row is open raised by
 * LOW_SKY_SURCHARGE, so a walk down the field never sinks toward a fall out of the sky. An
 * `EntryCost` sees only the cell, not its height, so the surcharge goes on after the search. The
 * finish column keeps its zeros, since reaching it ends the race.
 */
function keptOffLowSky(level: Level, field: Float32Array): Float32Array {
  const bottom = level.height - 1;
  for (let x = 0; x < level.width; x++) {
    if (x === level.finishX || !Number.isFinite(field[tileIndex(level, x, bottom)] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    for (let y = Math.max(0, level.height - LOW_SKY_ROWS); y <= bottom; y++) {
      const index = tileIndex(level, x, y);
      field[index] = (field[index] ?? Number.POSITIVE_INFINITY) + LOW_SKY_SURCHARGE;
    }
  }
  return field;
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
