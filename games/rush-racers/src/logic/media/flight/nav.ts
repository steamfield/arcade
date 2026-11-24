/**
 * Flight's navigation over a level: what a flyer pays to enter each tile, the two distance fields
 * to the finish built from those prices (steer, with puff clouds closed, and ram, with them open at
 * a price), the bounce pads a flyer can spring off, and the level check that every start can reach
 * the finish without popping one. Its nav is a `FlightNav` (`way-data.ts`); `way.ts` reads it.
 */
import { TICK_DT } from '@arcade/core';
import { cellAt, cornerIsClear, isRockLike, isSolid, NEIGHBOURS, tileIndex } from '../../level/query.ts';
import { length } from '../../num.ts';
import {
  alongCost,
  distancesToFinish,
  type EntryCost,
  type FlowPrices,
  type NavLink,
  unreachableStarts,
} from '../../race/flowfield.ts';
import { RACE_LIMIT_TICKS } from '../../race/standings.ts';
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
  const shots = level.cannons.map((cannon) => traceCannonShot(cannon, level, broken, rules));
  const routes = shots.map(({ exit, ticks }, index) =>
    entersLoop(index, shots)
      ? traceLoopExit(level, broken, rules, index)
      : { exit, ticks: CANNON.holdTicks + ticks, coolingExit: false },
  );
  const cruise = flightExtra(tuning).cruise;
  const field = (cost: EntryCost) => {
    const links = level.cannons.flatMap((cannon, index) =>
      cannonLinks(level, cannon, routes[index], cruise, (tile, move) =>
        cost(cellAt(level, tile.x, tile.y), broken.has(tileIndex(level, tile.x, tile.y)), move, tile),
      ),
    );
    return distancesToFinish(level, broken, cost, links);
  };
  return {
    kind: 'flight',
    width: level.width,
    height: level.height,
    steer: field(keptOffLowSky(level, flightCost)),
    ram: field(keptOffLowSky(level, ramCost)),
    bouncePads: bouncePads(level, broken),
  };
}

function entersLoop(first: number, shots: readonly ReturnType<typeof traceCannonShot>[]): boolean {
  const seen = new Set<number>();
  for (let index: number | null = first; index !== null; index = shots[index]?.receiver ?? null) {
    if (seen.has(index)) return true;
    seen.add(index);
  }
  return false;
}

type CannonRoute = { exit: Vec; ticks: number; coolingExit: boolean };

/** A forced loop can exit when a returning shot passes through a barrel still reloading for it. */
function traceLoopExit(level: Level, broken: ReadonlySet<number>, rules: MoveRules, first: number): CannonRoute | null {
  const readyAt = new Map<number, number>();
  let tick = 0;
  let costTicks = 0;
  for (let index = first; tick < RACE_LIMIT_TICKS; ) {
    const cannon = level.cannons[index];
    if (!cannon) return null;
    // The first flight tick shares the last hold tick, even though nav prices the full hold.
    const launch = tick + CANNON.holdTicks - 1;
    const { exit, ticks, receiver } = traceCannonShot(
      cannon,
      level,
      broken,
      rules,
      (next, flown) => (readyAt.get(next) ?? 0) <= launch + flown,
    );
    tick = launch + ticks;
    costTicks += CANNON.holdTicks + ticks;
    if (receiver === null) {
      const coolingExit = level.cannons.some(({ col, row }) => col === exit.x && row === exit.y);
      return { exit, ticks: costTicks, coolingExit: coolingExit && exit.x < level.finishX };
    }
    readyAt.set(index, tick + CANNON.reloadTicks);
    index = receiver;
  }
  return null;
}

/** Price the hold and flight in tiles at cruise speed, plus a step out of a cooling exit. */
function cannonLinks(
  level: Level,
  cannon: CannonDef,
  route: CannonRoute | null | undefined,
  cruise: number,
  stepCost: (tile: Vec, move: Vec) => number,
): NavLink[] {
  const from = { x: cannon.col, y: cannon.row };
  const blocked: NavLink = { from, to: from, cost: 0 };
  if (!route || route.exit.y >= level.height) return [blocked];
  const { exit, ticks, coolingExit } = route;
  const cost = (ticks * TICK_DT * cruise) / TILE;
  if (!coolingExit) return [{ from, to: { x: Math.min(exit.x, level.finishX), y: exit.y }, cost }];
  const open = (x: number, y: number) => Number.isFinite(stepCost({ x, y }, { x: 0, y: 0 }));
  const links = NEIGHBOURS.flatMap((move) => {
    const to = { x: exit.x + move.x, y: exit.y + move.y };
    const step = stepCost(to, move);
    if (!Number.isFinite(step) || !cornerIsClear(exit, move, open)) return [];
    return [{ from, to, cost: cost + length(move.x, move.y) * step }];
  });
  return links.length > 0 ? links : [blocked];
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
