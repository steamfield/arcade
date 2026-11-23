/**
 * How a runner gets from one stand tile to another: the walk, drop and jump links that `nav.ts`
 * solves for the least time to the finish. Walks and drops follow the terrain (`terrain.ts`); jumps
 * come from tracing each hold length through it (`arc.ts`), so a link exists only where a real jump
 * with that hold lands.
 */
import { TICK_DT } from '@arcade/core';
import { type Level, RACER_SIZE, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { arcsFor, type Flight, SAMPLE_TICKS, traceJump } from './arc.ts';
import { runExtra } from './physics.ts';
import { holdsRunner, isSolidTile, isStandTile, standIndices, type Terrain, terrainOf } from './terrain.ts';
import type { RunLink } from './way-data.ts';

const HALF_BODY_WIDTH = RACER_SIZE.width / 2;
const DIRECTIONS: readonly (-1 | 1)[] = [1, -1];
/**
 * Share of `runSpeed` the links assume a runner moves at. Easy rivals run about 10 % slower
 * (`rivalForceMul` through half of forceMul's effect), and a jump planned for full speed would drop
 * them into the pit; faster runners land a little past the mark and steer back in the air.
 */
const PLANNED_SPEED_SHARE = 0.9;

/** The running speed, px/s, that links and tick counts are planned at. */
export function plannedSpeed(tuning: MediumTuning): number {
  return runExtra(tuning).runSpeed * PLANNED_SPEED_SHARE;
}

/** The walk to the stand tile beside `from` on the same row, if there is one. */
function walkLink(flight: Flight, from: number, dir: -1 | 1): RunLink | null {
  const { terrain, stepPx } = flight;
  const col = (from % terrain.width) + dir;
  const row = Math.floor(from / terrain.width);
  if (!isStandTile(terrain, col, row)) return null;
  return {
    kind: 'walk',
    to: row * terrain.width + col,
    dir,
    ticks: (TILE / stepPx) * SAMPLE_TICKS,
    holdTicks: 0,
    takeOffAtEdge: false,
  };
}

/** Walking off the edge beside `from` and falling to the first stand tile below it; null at a pit or where there is no edge. */
function dropLink(flight: Flight, from: number, dir: -1 | 1): RunLink | null {
  const { terrain, stepPx } = flight;
  const col = (from % terrain.width) + dir;
  const row = Math.floor(from / terrain.width);
  if (isSolidTile(terrain, col, row) || holdsRunner(terrain, col, row + 1)) return null;
  for (let below = row + 1; below < terrain.height; below++) {
    if (!isStandTile(terrain, col, below)) continue;
    const fallTicks =
      (flight.arcs.fromRest.feet.findIndex((offset) => offset >= (below - row) * TILE) + 1) * SAMPLE_TICKS;
    const walkOffTicks = ((TILE / 2 + HALF_BODY_WIDTH) / stepPx) * SAMPLE_TICKS;
    return {
      kind: 'drop',
      to: below * terrain.width + col,
      dir,
      ticks: walkOffTicks + fallTicks,
      holdTicks: 0,
      takeOffAtEdge: false,
    };
  }
  return null;
}

/** True when `to` is on `from`'s row with stand tiles all the way between, so walking gets there and a jump adds nothing. */
function isWalkable(terrain: Terrain, from: number, to: number): boolean {
  const row = Math.floor(from / terrain.width);
  if (Math.floor(to / terrain.width) !== row) return false;
  const [first, last] = from < to ? [from, to] : [to, from];
  for (let tile = first; tile <= last; tile++) {
    if (!isStandTile(terrain, tile % terrain.width, row)) return false;
  }
  return true;
}

/** True when the tile beside `from` toward `dir` is open with nothing to stand on: an edge, not a wall. */
function isEdge(terrain: Terrain, from: number, dir: -1 | 1): boolean {
  const col = (from % terrain.width) + dir;
  const row = Math.floor(from / terrain.width);
  return !isSolidTile(terrain, col, row) && !isStandTile(terrain, col, row);
}

/**
 * One jump link to each other stand tile some held jump from `from` lands on. Of the holds that land
 * on a tile it takes the middle one, so the jump has room to come up a little short or long.
 */
function jumpLinks(flight: Flight, from: number, alreadyLinked: Set<number>): RunLink[] {
  const links: RunLink[] = [];
  for (const dir of DIRECTIONS) {
    const landings = new Map<number, { holdTicks: number; ticks: number }[]>();
    for (let hold = 1; hold <= flight.arcs.byHold.length; hold++) {
      const landing = traceJump(flight, from, hold, dir);
      if (!landing || alreadyLinked.has(landing.to) || isWalkable(flight.terrain, from, landing.to)) continue;
      landings.set(landing.to, [...(landings.get(landing.to) ?? []), { holdTicks: hold, ticks: landing.ticks }]);
    }
    for (const [to, flights] of landings) {
      const middle = flights[Math.floor((flights.length - 1) / 2)];
      if (!middle) continue;
      alreadyLinked.add(to);
      links.push({
        kind: 'jump',
        to,
        dir,
        ticks: middle.ticks,
        holdTicks: middle.holdTicks,
        takeOffAtEdge: isEdge(flight.terrain, from, dir),
      });
    }
  }
  return links;
}

/**
 * Every link out of every stand tile of `level` with `broken` coral gone: walks and drops left and
 * right, and jumps to each stand tile a held jump reaches. A 3-tile pit is jumped, a 5-tile one isn't.
 *
 * @returns Links by stand tile index; a stand tile with no way out maps to an empty list.
 * @throws {Error} When `tuning` lacks run's extras (see `runExtra`).
 */
export function buildLinks(level: Level, broken: ReadonlySet<number>, tuning: MediumTuning): Map<number, RunLink[]> {
  const terrain = terrainOf(level, broken);
  const flight: Flight = {
    terrain,
    arcs: arcsFor(tuning, level.height * TILE),
    stepPx: plannedSpeed(tuning) * TICK_DT * SAMPLE_TICKS,
  };
  const links = new Map<number, RunLink[]>();
  for (const from of standIndices(terrain)) {
    const onFoot = DIRECTIONS.flatMap((dir) => [walkLink(flight, from, dir) ?? dropLink(flight, from, dir)]);
    const known = onFoot.filter((link): link is RunLink => link !== null);
    const taken = new Set([from, ...known.map((link) => link.to)]);
    links.set(from, [...known, ...jumpLinks(flight, from, taken)]);
  }
  return links;
}
