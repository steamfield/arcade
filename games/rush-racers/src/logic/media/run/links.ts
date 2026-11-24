/**
 * How a runner gets from one stand tile to another: the walk, drop, jump and bounce links that
 * `nav.ts` solves for the least time to the finish. Walks and drops follow the terrain (`terrain.ts`);
 * jumps come from tracing each hold length through it, and bounces from tracing a spring mushroom's
 * launch (`arc.ts`), so a link exists only where a real jump or launch lands.
 */
import { TICK_DT } from '@arcade/core';
import { type Level, RACER_SIZE, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { arcsFor, type Flight, SAMPLE_TICKS, traceJump, traceReachPx, traceSpring } from './arc.ts';
import { runExtra } from './physics.ts';
import {
  holdsRunner,
  isSolidTile,
  isSpringTile,
  isStandTile,
  standIndices,
  type Terrain,
  terrainOf,
} from './terrain.ts';
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

/**
 * True when `to` is on `from`'s row with stand tiles all the way between and no spring mushroom, so
 * walking gets there and a jump adds nothing. A mushroom on the way would launch a walker, so a jump
 * over it is a way of its own.
 */
function isWalkable(terrain: Terrain, from: number, to: number): boolean {
  const row = Math.floor(from / terrain.width);
  if (Math.floor(to / terrain.width) !== row) return false;
  const [first, last] = from < to ? [from, to] : [to, from];
  for (let tile = first; tile <= last; tile++) {
    const col = tile % terrain.width;
    if (!isStandTile(terrain, col, row) || isSpringTile(terrain, col, row)) return false;
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

/** Ticks of Up a bounce link holds as the runner lands on its mushroom, for the higher launch. */
export const BOUNCE_HOLD_TICKS = 1;

/**
 * The bounce links out of stand tile `from` on a spring mushroom: the quickest launch, Up held or
 * not, to each other stand tile one lands on, either way. None lead back to `from`, which would only
 * launch again.
 */
function bounceLinks(flight: Flight, from: number): RunLink[] {
  const quickest = new Map<number, RunLink>();
  for (const dir of DIRECTIONS) {
    for (const held of [false, true]) {
      const landing = traceSpring(flight, from, held, dir);
      if (!landing || landing.to === from) continue;
      const known = quickest.get(landing.to);
      if (known && known.ticks <= landing.ticks) continue;
      const holdTicks = held ? BOUNCE_HOLD_TICKS : 0;
      quickest.set(landing.to, { kind: 'bounce', ...landing, dir, holdTicks, takeOffAtEdge: false });
    }
  }
  return [...quickest.values()];
}

/**
 * Every link out of stand tile `from`: on a spring mushroom only its bounces, since a runner there is
 * launched at once; elsewhere walks and drops left and right, then jumps to tiles they don't reach.
 */
function linksFrom(flight: Flight, from: number): RunLink[] {
  const { terrain } = flight;
  if (isSpringTile(terrain, from % terrain.width, Math.floor(from / terrain.width))) return bounceLinks(flight, from);
  const onFoot = DIRECTIONS.flatMap((dir) => [walkLink(flight, from, dir) ?? dropLink(flight, from, dir)]);
  const known = onFoot.filter((link): link is RunLink => link !== null);
  const taken = new Set([from, ...known.map((link) => link.to)]);
  return [...known, ...jumpLinks(flight, from, taken)];
}

/** The links last built for a level, so breaking coral re-traces only the stand tiles near it. */
interface Built {
  tuning: string;
  broken: ReadonlySet<number>;
  links: ReadonlyMap<number, RunLink[]>;
}

const lastBuilt = new WeakMap<Level, Built>();

/**
 * The columns whose stand tiles' links may differ between `before` and `after` broken coral: every
 * column a trace from it could read a changed tile from (`traceReachPx`), plus one for walks and drops.
 *
 * @returns One flag per column of `level`.
 */
function staleColumns(level: Level, before: ReadonlySet<number>, after: ReadonlySet<number>, flight: Flight) {
  const stale = new Uint8Array(level.width);
  const reach = Math.ceil(traceReachPx(flight) / TILE) + 1;
  const changed = [...before].filter((tile) => !after.has(tile));
  for (const tile of after) if (!before.has(tile)) changed.push(tile);
  for (const tile of changed) {
    const col = tile % level.width;
    stale.fill(1, Math.max(0, col - reach), Math.min(level.width, col + reach + 1));
  }
  return stale;
}

/**
 * Every link out of every stand tile of `level` with `broken` coral gone: walks and drops left and
 * right, jumps to each stand tile a held jump reaches, and bounces off spring mushrooms. A 3-tile pit is jumped, a 5-tile one isn't.
 *
 * Coral breaks mid-race and the whole table used to be re-traced each time, which is most of a run
 * race's cost. So the last table built for `level` is kept, and only stand tiles within a jump's
 * reach of a tile that broke (or mended) since are traced again; the result is the same table a
 * full build gives.
 *
 * @returns Links by stand tile index, in reading order; a stand tile with no way out maps to an
 *   empty list. Read-only: the next build for the level may share it.
 * @throws {Error} When `tuning` lacks run's extras (see `runExtra`).
 */
export function buildLinks(
  level: Level,
  broken: ReadonlySet<number>,
  tuning: MediumTuning,
): ReadonlyMap<number, readonly RunLink[]> {
  const terrain = terrainOf(level, broken);
  const flight: Flight = {
    terrain,
    arcs: arcsFor(tuning, level.height * TILE),
    stepPx: plannedSpeed(tuning) * TICK_DT * SAMPLE_TICKS,
  };
  const key = JSON.stringify(tuning);
  const last = lastBuilt.get(level);
  const reuse = last?.tuning === key ? last : undefined;
  const stale = reuse ? staleColumns(level, reuse.broken, broken, flight) : null;
  const links = new Map<number, RunLink[]>();
  for (const from of standIndices(terrain)) {
    const kept = stale?.[from % level.width] === 0 ? reuse?.links.get(from) : undefined;
    links.set(from, kept ?? linksFrom(flight, from));
  }
  lastBuilt.set(level, { tuning: key, broken: new Set(broken), links });
  return links;
}
