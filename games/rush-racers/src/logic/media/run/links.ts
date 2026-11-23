/**
 * What a runner can stand on and how it gets from one stand tile to another: the walk, drop and jump
 * links that `nav.ts` solves for the least time to the finish. A jump is traced tick by tick along
 * the same arc the physics flies (one arc per hold length), moving at running speed, so a link
 * exists only where a real jump with that hold lands. The trace is a sampled box, not the physics
 * itself, and starts from the middle of the take-off tile.
 */
import { TICK_DT } from '@arcade/core';
import { isLedge, isSolid } from '../../level/query.ts';
import { type Level, RACER_SIZE, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { jumpPeak, runExtra } from './physics.ts';
import type { RunLink } from './way-data.ts';

const HALF_BODY_WIDTH = RACER_SIZE.width / 2;
const DIRECTIONS: readonly (-1 | 1)[] = [1, -1];
/**
 * Ticks between samples of a jump. A box moves at most 11 px up or down and 4 px along in that time,
 * far less than the 26 px (box plus tile) it takes to pass a tile, so no sample skips over one.
 */
const SAMPLE_TICKS = 2;
/**
 * Share of `runSpeed` the links assume a runner moves at. Easy rivals run about 10 % slower
 * (`rivalForceMul` through half of forceMul's effect), and a jump planned for full speed would drop
 * them into the pit; faster runners land a little past the mark and steer back in the air.
 */
const PLANNED_SPEED_SHARE = 0.9;
/** A fall counts as caught by a corner this far short of touching it, px, for the speed a runner may differ by. */
const CATCH_MARGIN_PX = 2;

/** The running speed, px/s, that links and tick counts are planned at. */
export function plannedSpeed(tuning: MediumTuning): number {
  return runExtra(tuning).runSpeed * PLANNED_SPEED_SHARE;
}

/** The level's tiles as a runner meets them: what blocks it and what holds it up. */
export interface Terrain {
  width: number;
  height: number;
  /** 1 for rock, unbroken coral and crates, which a runner never passes through. */
  solid: Uint8Array;
  /** 1 for ledges, which hold a runner landing on them from above. */
  ledge: Uint8Array;
}

/** The terrain of `level` with `broken` coral gone. A crate, ready or shut, is solid. */
export function terrainOf(level: Level, broken: ReadonlySet<number>): Terrain {
  const { width, height } = level;
  const terrain: Terrain = {
    width,
    height,
    solid: new Uint8Array(width * height),
    ledge: new Uint8Array(width * height),
  };
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      terrain.solid[row * width + col] = isSolid(level, broken, col, row) ? 1 : 0;
      terrain.ledge[row * width + col] = isLedge(level, col, row) ? 1 : 0;
    }
  }
  for (const crate of level.clams) terrain.solid[crate.y * width + crate.x] = 1;
  return terrain;
}

/** True where a runner can't be: rock, coral, a crate, or beyond the sides and top. Below the last row is open (a pit). */
export function isSolidTile(terrain: Terrain, col: number, row: number): boolean {
  if (col < 0 || col >= terrain.width || row < 0) return true;
  if (row >= terrain.height) return false;
  return terrain.solid[row * terrain.width + col] === 1;
}

/** True when a runner can stand on top of this tile: solid or a ledge. */
function holdsRunner(terrain: Terrain, col: number, row: number): boolean {
  if (isSolidTile(terrain, col, row)) return true;
  return row < terrain.height && terrain.ledge[row * terrain.width + col] === 1;
}

/** True for an open tile with something to stand on under it. */
export function isStandTile(terrain: Terrain, col: number, row: number): boolean {
  return !isSolidTile(terrain, col, row) && holdsRunner(terrain, col, row + 1);
}

/** Indices (`y * width + x`) of every stand tile in `terrain`, in reading order. */
export function standIndices(terrain: Terrain): number[] {
  const found: number[] = [];
  for (let row = 0; row < terrain.height; row++) {
    for (let col = 0; col < terrain.width; col++) {
      if (isStandTile(terrain, col, row)) found.push(row * terrain.width + col);
    }
  }
  return found;
}

/**
 * The stand tiles of `level`: open tiles with rock, unbroken coral, a ledge or a crate under them.
 *
 * @returns Tile indices, `y * width + x`.
 */
export function standTiles(level: Level, broken: ReadonlySet<number>): ReadonlySet<number> {
  return new Set(standIndices(terrainOf(level, broken)));
}

/** A jump's feet heights over time: pixels below the take-off feet after each sample, and how many samples rise. */
interface Arc {
  feet: Float64Array;
  risingSamples: number;
}

/** Every arc a runner can fly, from the vertical physics: one per hold length, and a fall from rest. */
interface Arcs {
  /** `byHold[h - 1]` is the arc of a jump with Up held for `h` ticks; the last is a full jump. */
  byHold: readonly Arc[];
  /** A fall from rest, for a runner that bumps its head or walks off an edge. */
  fromRest: Arc;
}

/** The run extras the links need, in px and ticks. */
interface Flight {
  terrain: Terrain;
  arcs: Arcs;
  /** Horizontal pixels covered between two samples at running speed. */
  stepPx: number;
}

/** Integrates one jump or fall with the physics' own recurrence until the feet are `limitPx` below the start. */
function arcOf(tuning: MediumTuning, startSpeed: number, hold: number, limitPx: number): Arc {
  const extra = runExtra(tuning);
  const feet: number[] = [];
  let speed = startSpeed;
  let offset = 0;
  let risingSamples = 0;
  for (let tick = 0; offset <= limitPx; tick++) {
    const gravity = extra.gravity * (tick >= hold && speed < 0 ? extra.cutGravityMul : 1);
    speed = Math.min(extra.maxFall, speed + gravity * TICK_DT);
    offset += speed * TICK_DT;
    if ((tick + 1) % SAMPLE_TICKS !== 0) continue;
    feet.push(offset);
    if (speed < 0) risingSamples = feet.length;
  }
  return { feet: Float64Array.from(feet), risingSamples };
}

/** Holds Up for `1..fullHold` ticks, where the full hold is the first that a longer one doesn't beat. */
function fullHoldTicks(tuning: MediumTuning): number {
  let hold = 1;
  while (jumpPeak(tuning, hold + 1, TICK_DT) > jumpPeak(tuning, hold, TICK_DT)) hold++;
  return hold;
}

function arcsFor(tuning: MediumTuning, limitPx: number): Arcs {
  const jumpSpeed = runExtra(tuning).jumpSpeed;
  const byHold = Array.from({ length: fullHoldTicks(tuning) }, (_, index) =>
    arcOf(tuning, -jumpSpeed, index + 1, limitPx),
  );
  return { byHold, fromRest: arcOf(tuning, 0, 0, limitPx) };
}

/** True when a runner's box with its feet at (x, feet) overlaps a solid tile. */
function hitsSolid(terrain: Terrain, x: number, feet: number): boolean {
  const left = Math.floor((x - HALF_BODY_WIDTH) / TILE);
  const right = Math.ceil((x + HALF_BODY_WIDTH) / TILE) - 1;
  const top = Math.floor((feet - RACER_SIZE.height) / TILE);
  const bottom = Math.ceil(feet / TILE) - 1;
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (isSolidTile(terrain, col, row)) return true;
    }
  }
  return false;
}

/**
 * The first row, from the one under feet height `from` down to the one at `to`, whose top catches
 * any part of a box that moved from `xFrom` to `xTo` meanwhile: the fall may be caught at any point
 * of the stride, not only at its end.
 */
function caughtRow(terrain: Terrain, xFrom: number, xTo: number, from: number, to: number): number | null {
  const reach = HALF_BODY_WIDTH + CATCH_MARGIN_PX;
  const left = Math.floor((Math.min(xFrom, xTo) - reach) / TILE);
  const right = Math.ceil((Math.max(xFrom, xTo) + reach) / TILE) - 1;
  for (let row = Math.ceil(from / TILE); row <= Math.floor(to / TILE); row++) {
    for (let col = left; col <= right; col++) {
      if (holdsRunner(terrain, col, row)) return row;
    }
  }
  return null;
}

/**
 * The stand tile a box caught at row `row` stands on. Any part of the box over something stops the
 * fall, as in the physics, but only a box with its middle over it has landed: one caught by a
 * corner with its middle in the air is as likely to slip off.
 *
 * @returns null when the box is on a corner.
 */
function standTileCaught(terrain: Terrain, x: number, row: number): number | null {
  const centre = Math.floor(x / TILE);
  if (!holdsRunner(terrain, centre, row) || !isStandTile(terrain, centre, row - 1)) return null;
  return (row - 1) * terrain.width + centre;
}

/** A jump's progress through its arc. */
interface Trace {
  x: number;
  feet: number;
  /** Feet height the arc's offsets are measured from. */
  origin: number;
  arc: Arc;
  /** Samples into `arc`. */
  tick: number;
  /** Ticks since take-off, bumps included. */
  elapsed: number;
}

/** The result of one sample of a trace: still flying, lost (fell out of the level or caught on a corner), or landed on a stand tile. */
type Step = 'flying' | 'lost' | { to: number; ticks: number };

/** Moves the trace one sample: running on unless a wall stops it, then up or down the arc. */
function advance(flight: Flight, trace: Trace, dir: -1 | 1): Step {
  const { terrain } = flight;
  const xBefore = trace.x;
  const ahead = trace.x + dir * flight.stepPx;
  if (!hitsSolid(terrain, ahead, trace.feet)) trace.x = ahead;
  trace.elapsed += SAMPLE_TICKS;
  const next = trace.origin + (trace.arc.feet[trace.tick++] ?? Number.POSITIVE_INFINITY);
  if (trace.tick <= trace.arc.risingSamples) {
    if (hitsSolid(terrain, trace.x, next))
      Object.assign(trace, { arc: flight.arcs.fromRest, origin: trace.feet, tick: 0 });
    else trace.feet = next;
    return 'flying';
  }
  const caught = caughtRow(terrain, xBefore, trace.x, trace.feet, next);
  if (caught !== null) {
    const to = standTileCaught(terrain, trace.x, caught);
    return to === null ? 'lost' : { to, ticks: trace.elapsed };
  }
  trace.feet = next;
  return next > terrain.height * TILE ? 'lost' : 'flying';
}

/** Flies a jump held `hold` ticks from the middle of stand tile `from`, running `dir`; null when it doesn't land on a stand tile. */
function traceJump(flight: Flight, from: number, hold: number, dir: -1 | 1): { to: number; ticks: number } | null {
  const { width } = flight.terrain;
  const feet = (Math.floor(from / width) + 1) * TILE;
  const arc = flight.arcs.byHold[hold - 1];
  if (!arc) return null;
  const trace: Trace = { x: ((from % width) + 0.5) * TILE, feet, origin: feet, arc, tick: 0, elapsed: 0 };
  while (trace.tick < trace.arc.feet.length) {
    const step = advance(flight, trace, dir);
    if (step === 'lost') return null;
    if (step !== 'flying') return step;
  }
  return null;
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
