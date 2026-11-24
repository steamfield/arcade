/**
 * A jump or a spring mushroom's launch traced through the level: the feet heights each hold length
 * (or each launch) gives, from the physics' own vertical step, and a sampled box flown along them at
 * running speed to find where it lands. A jump lands only where a real jump with that hold would;
 * the trace is a sampled box, not the physics itself, and starts from the middle of the take-off tile.
 */
import { TICK_DT } from '@arcade/core';
import { RACER_SIZE, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { jumpPeak, runExtra, stepFallSpeed } from './physics.ts';
import { holdsRunner, isSolidTile, isStandTile, type Terrain } from './terrain.ts';
import { RUN_BOUNCE_SPEED, RUN_HELD_BOUNCE_SPEED } from './tuning.ts';

const HALF_BODY_WIDTH = RACER_SIZE.width / 2;
/**
 * Ticks between samples of a jump. A box moves at most 11 px up or down and 4 px along in that time,
 * far less than the 26 px (box plus tile) it takes to pass a tile, so no sample skips over one.
 */
export const SAMPLE_TICKS = 2;
/** A fall counts as caught by a corner this far short of touching it, px, for the speed a runner may differ by. */
const CATCH_MARGIN_PX = 2;

/** A jump's feet heights over time: pixels below the take-off feet after each sample, and how many samples rise. */
interface Arc {
  feet: Float64Array;
  risingSamples: number;
}

/** Every arc a runner can fly, from the vertical physics: one per hold length, the spring launches, and a fall from rest. */
export interface Arcs {
  /** `byHold[h - 1]` is the arc of a jump with Up held for `h` ticks; the last is a full jump. */
  byHold: readonly Arc[];
  /** A spring mushroom's launch with Up let go (`free`) and held (`held`) as the runner lands on it. */
  spring: { free: Arc; held: Arc };
  /** A fall from rest, for a runner that bumps its head or walks off an edge. */
  fromRest: Arc;
}

/** What a jump is traced through: the terrain, the arcs, and how far a runner moves between samples. */
export interface Flight {
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
    speed = stepFallSpeed(speed, tick >= hold, 0, extra, TICK_DT);
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

/** The arcs for `tuning`, long enough to fall `limitPx` below the take-off. */
export function arcsFor(tuning: MediumTuning, limitPx: number): Arcs {
  const jumpSpeed = runExtra(tuning).jumpSpeed;
  const byHold = Array.from({ length: fullHoldTicks(tuning) }, (_, index) =>
    arcOf(tuning, -jumpSpeed, index + 1, limitPx),
  );
  // A spring launch is no jump, so gravity is never cut: it holds "Up" for good.
  const spring = {
    free: arcOf(tuning, -RUN_BOUNCE_SPEED, Number.POSITIVE_INFINITY, limitPx),
    held: arcOf(tuning, -RUN_HELD_BOUNCE_SPEED, Number.POSITIVE_INFINITY, limitPx),
  };
  return { byHold, spring, fromRest: arcOf(tuning, 0, 0, limitPx) };
}

/**
 * How far from the middle of its take-off tile any jump traced through `flight` reads the terrain,
 * px: the longest flight at running speed (a bump restarts the arc as a fall from rest), plus the
 * box and the catch margin. A tile farther than this from a take-off can't change where it lands.
 */
export function traceReachPx(flight: Flight): number {
  const { byHold, spring, fromRest } = flight.arcs;
  const arcs = [...byHold, spring.free, spring.held];
  const samples = Math.max(...arcs.map((arc) => Math.max(arc.feet.length, arc.risingSamples + fromRest.feet.length)));
  return samples * flight.stepPx + HALF_BODY_WIDTH + CATCH_MARGIN_PX;
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

/** Where a traced flight lands: the stand tile, and the ticks from take-off until it stands there. */
export interface Landing {
  to: number;
  ticks: number;
}

/** Flies a jump held `hold` ticks from the middle of stand tile `from`, running `dir`; null when it doesn't land on a stand tile. */
export function traceJump(flight: Flight, from: number, hold: number, dir: -1 | 1): Landing | null {
  const arc = flight.arcs.byHold[hold - 1];
  return arc ? traceArc(flight, from, arc, dir) : null;
}

/**
 * Flies a spring mushroom's launch from the middle of stand tile `from` (the tile on top of the
 * mushroom), Up `held` or not as the runner lands, running `dir`; null when it doesn't land on a stand tile.
 */
export function traceSpring(flight: Flight, from: number, held: boolean, dir: -1 | 1): Landing | null {
  const { spring } = flight.arcs;
  return traceArc(flight, from, held ? spring.held : spring.free, dir);
}

/** Flies `arc` from the middle of stand tile `from`, running `dir`; null when it doesn't land on a stand tile. */
function traceArc(flight: Flight, from: number, arc: Arc, dir: -1 | 1): Landing | null {
  const { width } = flight.terrain;
  const feet = (Math.floor(from / width) + 1) * TILE;
  const trace: Trace = { x: ((from % width) + 0.5) * TILE, feet, origin: feet, arc, tick: 0, elapsed: 0 };
  while (trace.tick < trace.arc.feet.length) {
    const step = advance(flight, trace, dir);
    if (step === 'lost') return null;
    if (step !== 'flying') return step;
  }
  return null;
}
