/**
 * Flight's navigation over a level: what a flyer pays to enter each tile, the two distance fields
 * to the finish built from those prices (steer, with puff clouds closed, and ram, with them open at
 * a price), the bounce pads a flyer can spring off, and the level check that every start can reach
 * the finish without popping one. Its nav is a `FlightNav` (`way-data.ts`); `way.ts` reads it.
 */
import { TICK_DT } from '@arcade/core';
import { cellAt, isRockLike, isSolid } from '../../level/query.ts';
import {
  alongCost,
  distancesToFinish,
  type EntryCost,
  type FlowPrices,
  type NavLink,
  unreachableStarts,
} from '../../race/flowfield.ts';
import { CANNON, traceCannonShot } from '../../setpieces/cannons.ts';
import { type CannonDef, type Cell, type Level, type MoveRules, TILE, type Vec } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { flightExtra } from './physics.ts';
import { FLIGHT_EFFECTS } from './tuning.ts';
import { type FlightNav, flightNav } from './way-data.ts';

/** A fog bank slows a flyer to well under cruise. */
const FOG_COST = 2.5;
/** Flying with the wind (a gust, or up an updraft) is quick; into it (against a gust, or up a downdraft) is slow. */
const WIND_PRICES: FlowPrices = { withFlow: 0.5, againstFlow: 3 };
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

/**
 * What a flyer feels wherever it is: thunderheads (rock), bounce clouds and unbroken puff clouds
 * are walls, fog is slow, wind helps or hinders. The steer field adds the low-sky price on top
 * (`flightEnterCost`).
 */
const flightCost = (cell: Cell, isBroken: boolean, move: Vec): number => {
  if (isRockLike(cell)) return Number.POSITIVE_INFINITY;
  if (cell === 'coral') return isBroken ? 1 : Number.POSITIVE_INFINITY;
  if (cell === 'kelp') return FOG_COST;
  const wind = WIND_DIRECTION[cell];
  return wind ? alongCost(wind, move, WIND_PRICES) : 1;
};

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

/**
 * Flight's nav for `level` with `broken` puff clouds open: the steer and ram fields, each kept off
 * the bottom over open sky, and the bounce pads.
 */
export function buildFlightNav(level: Level, broken: ReadonlySet<number>, tuning: MediumTuning): FlightNav {
  const rules: MoveRules = { pitBelow: FLIGHT_EFFECTS.pitBelow, solidTiles: new Set(), openLedges: new Set() };
  const links = level.cannons.map((cannon) => cannonLink(level, cannon, broken, rules, flightExtra(tuning).cruise));
  return {
    kind: 'flight',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, keptOffLowSky(level, flightCost), links),
    ram: distancesToFinish(level, broken, keptOffLowSky(level, ramCost), links),
    bouncePads: bouncePads(level, broken),
  };
}

/** Trace a racer-sized shot, then price the hold and time in flight in tiles at cruise speed. */
function cannonLink(
  level: Level,
  cannon: CannonDef,
  broken: ReadonlySet<number>,
  rules: MoveRules,
  cruise: number,
): NavLink {
  const from = { x: cannon.col, y: cannon.row };
  const { exit, ticks } = traceCannonShot(cannon, level, broken, rules);
  // Pricing an out-of-bounds shot as a self-link makes the field route around the mouth.
  const to = exit.y >= level.height ? from : { x: Math.min(exit.x, level.finishX), y: exit.y };
  return { from, to, cost: ((CANNON.holdTicks + ticks) * TICK_DT * cruise) / TILE };
}

/** Every bounce cloud tile of `level` whose tile above is open, in reading order. */
function bouncePads(level: Level, broken: ReadonlySet<number>): Vec[] {
  const pads: Vec[] = [];
  for (let y = 1; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (cellAt(level, x, y) === 'bounce' && !isSolid(level, broken, x, y - 1)) pads.push({ x, y });
    }
  }
  return pads;
}

/**
 * Flight's `enterCost`: what its steer field charges to enter `tile` of `level` along `move`,
 * `flightCost` with the low-sky price added.
 */
export const flightEnterCost = (cell: Cell, isBroken: boolean, move: Vec, tile: Vec, level: Level): number =>
  withLowSky(level, tile, flightCost(cell, isBroken, move));

/** What the ram field charges to enter `tile`. */
export const flightRamEnterCost = (cell: Cell, isBroken: boolean, move: Vec, tile: Vec, level: Level): number =>
  withLowSky(level, tile, ramCost(cell, isBroken, move));

/** `cost` with the low-sky price added (`withLowSky`). */
function keptOffLowSky(level: Level, cost: (cell: Cell, isBroken: boolean, move: Vec) => number): EntryCost {
  return (cell, isBroken, move, tile) => withLowSky(level, tile, cost(cell, isBroken, move));
}

/** `price` plus LOW_SKY_EXTRA when it is open and `tile` is low over open sky (`isLowSky`). */
function withLowSky(level: Level, tile: Vec, price: number): number {
  return Number.isFinite(price) && isLowSky(level, tile) ? price + LOW_SKY_EXTRA : price;
}

/**
 * Whether `tile` is in the bottom LOW_SKY_ROWS rows of a column whose last row is open sky (not a
 * thunderhead, bounce cloud or puff cloud).
 */
function isLowSky(level: Level, tile: Vec): boolean {
  const bottom = cellAt(level, tile.x, level.height - 1);
  return tile.y >= level.height - LOW_SKY_ROWS && !isRockLike(bottom) && bottom !== 'coral';
}

/**
 * One problem for each start that can't reach the finish without popping a puff cloud, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateFlightLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const flight = flightNav(nav);
  return unreachableStarts(level, flight.steer, flight, 'cannot reach the finish flying without popping a puff cloud');
}
