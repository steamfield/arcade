/**
 * Shifting wind: zones are checked when the level is parsed, blow +x then -x through each cycle with
 * a warning naming the coming direction before every turn, and push only the flyers whose centre is
 * in their columns. Raced through `createWorld` on small inline skies.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { LevelError } from '../level/level-error.ts';
import { parseLevel } from '../level/parse.ts';
import { COUNTDOWN_TICKS } from '../race/standings.ts';
import { courseFromLevel, eventsIn, placeOnTile, racerOf, step, ticksOf } from '../test-world.ts';
import type { LevelDef, ShiftingWindDef } from '../types.ts';
import { createWorld } from '../world.ts';
import { parseShiftingWind, SHIFTING_WIND, windDirection } from './shifting-wind.ts';

/** A 240-tick cycle: +x on ticks 0-119, -x on 120-239; warnings on ticks 60 and 180. */
const PERIOD = 240;
const HALF = PERIOD / 2;

/** A zone over columns 10-14 pushing at a gust's strength. */
const ZONE: ShiftingWindDef = { cols: [10, 14], periodTicks: PERIOD, offsetTicks: 0, push: 70 };

/** An open sky 24 columns wide with the starts on the left, finish on the right, and `shiftingWind` over it. */
function windySky(shiftingWind: readonly ShiftingWindDef[], extra: Partial<LevelDef> = {}): LevelDef {
  const open = `#${'.'.repeat(22)}F`;
  const ascii = ['#'.repeat(24), open, `#1.2.3.4${'.'.repeat(15)}F`, open, open, open, open, open, '#'.repeat(24)].join(
    '\n',
  );
  return { name: 'wind', ascii, shiftingWind, ...extra };
}

/** A racing flight world on `level`, events stamped with the world tick. */
function windRace(level: LevelDef) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(level, 'flight'), log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  return { world, log };
}

/** The LevelError `parseLevel` throws for `level`; any other outcome fails the test. */
function levelErrorFrom(level: LevelDef): LevelError {
  try {
    parseLevel(level);
  } catch (error) {
    if (error instanceof LevelError) return error;
    throw error;
  }
  throw new Error('parseLevel accepted the level');
}

describe('parsing shifting wind zones', () => {
  it('keeps every valid zone in the order written', () => {
    const second: ShiftingWindDef = { cols: [16, 18], periodTicks: 300, offsetTicks: 40, push: 90 };
    expect(parseLevel(windySky([ZONE, second])).shiftingWind).toEqual([ZONE, second]);
    expect(parseLevel(windySky([])).shiftingWind).toEqual([]);
  });

  it.each([
    ['reversed', { ...ZONE, cols: [14, 10] }, /runs backwards from column 14 to 10/],
    ['off the left of the map', { ...ZONE, cols: [-1, 3] }, /covers columns -1-3 but the map has columns 0-23/],
    ['off the right of the map', { ...ZONE, cols: [20, 24] }, /covers columns 20-24 but the map has columns 0-23/],
    ['too short a period', { ...ZONE, periodTicks: 239 }, /use a period of at least 240/],
    ['with no period', { ...ZONE, periodTicks: Number.NaN }, /zone 0 has period NaN; use whole ticks/],
    ['with a fractional period', { ...ZONE, periodTicks: 300.5 }, /zone 0 has period 300.5; use whole ticks/],
    ['with a fractional offset', { ...ZONE, offsetTicks: 12.5 }, /zone 0 has offset 12.5; use whole ticks/],
    ['no push', { ...ZONE, push: 0 }, /has push 0; use a positive push/],
    ['a backward push', { ...ZONE, push: -70 }, /has push -70/],
  ] as const)('rejects a zone %s', (_name, zone, message) => {
    expect(levelErrorFrom(windySky([zone as ShiftingWindDef])).message).toMatch(message);
  });

  it('rejects two zones sharing a column, and accepts them side by side', () => {
    const touching: ShiftingWindDef = { ...ZONE, cols: [14, 16] };
    expect(levelErrorFrom(windySky([ZONE, touching])).message).toMatch(
      /zone 1 \(columns 14-16\) overlaps zone 0 \(columns 10-14\)/,
    );
    expect(parseLevel(windySky([ZONE, { ...ZONE, cols: [15, 16] }])).shiftingWind).toHaveLength(2);
  });

  it('rejects a zone sharing a column with a storm zone', () => {
    const storm = { cols: [14, 15] as [number, number], periodTicks: 150, offsetTicks: 0 };
    expect(() => parseShiftingWind([ZONE], 24, [storm])).toThrow(
      new LevelError(
        'Shifting wind zone 0 (columns 10-14) overlaps lightning zone 0 (columns 14-15); move one of them',
      ),
    );
    expect(parseShiftingWind([ZONE], 24, [{ ...storm, cols: [15, 16] }])).toEqual([ZONE]);
  });
});

describe('which way a zone blows', () => {
  it('blows +x for the first half of each cycle and -x for the second', () => {
    const ticks = [0, HALF - 1, HALF, PERIOD - 1, PERIOD, PERIOD + HALF];
    expect(ticks.map((tick) => windDirection(ZONE, tick))).toEqual([1, 1, -1, -1, 1, -1]);
  });

  it('starts offsetTicks into its cycle', () => {
    const shifted = { ...ZONE, offsetTicks: HALF + 10 };
    expect(windDirection(shifted, 0)).toBe(-1);
    expect(windDirection(shifted, HALF - 11)).toBe(-1);
    expect(windDirection(shifted, HALF - 10)).toBe(1);
  });
});

describe('announcing turns', () => {
  it('warns 60 ticks before each turn with the coming direction, then announces the turn', () => {
    const { world, log } = windRace(windySky([ZONE]));
    // The first step is race tick 1, so an event's race tick is its world tick less the tick before it.
    const before = world.tick;
    step(world, log, 2 * PERIOD);
    const announced = log
      .all()
      .filter((event) => event.type === 'wind.warned' || event.type === 'wind.shifted')
      .map(({ seq: _seq, tick, ...event }) => ({ ...event, raceTick: tick - before }));
    expect(announced).toEqual([
      { type: 'wind.warned', zone: 0, dir: -1, raceTick: HALF - SHIFTING_WIND.warnTicks },
      { type: 'wind.shifted', zone: 0, dir: -1, raceTick: HALF },
      { type: 'wind.warned', zone: 0, dir: 1, raceTick: PERIOD - SHIFTING_WIND.warnTicks },
      { type: 'wind.shifted', zone: 0, dir: 1, raceTick: PERIOD },
      { type: 'wind.warned', zone: 0, dir: -1, raceTick: PERIOD + HALF - SHIFTING_WIND.warnTicks },
      { type: 'wind.shifted', zone: 0, dir: -1, raceTick: PERIOD + HALF },
      { type: 'wind.warned', zone: 0, dir: 1, raceTick: 2 * PERIOD - SHIFTING_WIND.warnTicks },
      { type: 'wind.shifted', zone: 0, dir: 1, raceTick: 2 * PERIOD },
    ]);
  });

  /** The wind events from the start signal on, each with its race tick, in a race begun from the countdown. */
  function fromTheStart(zone: ShiftingWindDef, raceTicks: number) {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(windySky([zone]), 'flight'), log, { seed: 1 });
    step(world, log, COUNTDOWN_TICKS + 1 + raceTicks);
    const started = ticksOf(log, 'race.started')[0] ?? 0;
    return log
      .all()
      .filter((event) => event.type === 'wind.warned' || event.type === 'wind.shifted')
      .map(({ seq: _seq, tick, ...event }) => ({ ...event, raceTick: tick - started }));
  }

  it('announces nothing at the start signal when a zone turns on it', () => {
    expect(fromTheStart(ZONE, HALF)).toEqual([
      { type: 'wind.warned', zone: 0, dir: -1, raceTick: HALF - SHIFTING_WIND.warnTicks },
      { type: 'wind.shifted', zone: 0, dir: -1, raceTick: HALF },
    ]);
  });

  it('warns at the start signal when the race starts inside a warning, then turns as usual', () => {
    const midWarning = { ...ZONE, offsetTicks: HALF - 30 };
    expect(fromTheStart(midWarning, 30)).toEqual([
      { type: 'wind.warned', zone: 0, dir: -1, raceTick: 0 },
      { type: 'wind.shifted', zone: 0, dir: -1, raceTick: 30 },
    ]);
    const atWarning = { ...ZONE, offsetTicks: HALF - SHIFTING_WIND.warnTicks };
    expect(fromTheStart(atWarning, 1)).toEqual([{ type: 'wind.warned', zone: 0, dir: -1, raceTick: 0 }]);
  });

  it('names each zone by its index', () => {
    const later: ShiftingWindDef = { ...ZONE, cols: [16, 18], offsetTicks: 30 };
    const { world, log } = windRace(windySky([ZONE, later]));
    // Zone 1 turns on race tick HALF - 30; zone 0 not until HALF.
    step(world, log, HALF - 1);
    expect(eventsIn(log, 'wind.shifted')).toEqual([{ type: 'wind.shifted', zone: 1, dir: -1 }]);
  });
});

describe('pushing flyers', () => {
  /** The horizontal speed of the player coasting from column `col` for `ticks` race ticks, `offsetTicks` into the zone's cycle. */
  function driftAfter(col: number, ticks: number, offsetTicks: number): number {
    const { world, log } = windRace(windySky([{ ...ZONE, offsetTicks }]));
    const flyer = racerOf(world, 'player');
    placeOnTile(flyer, col, 4);
    step(world, log, ticks);
    return Math.round(flyer.body.vx);
  }

  it('drifts a coasting flyer in its columns along the gust, and leaves one beside them still', () => {
    expect(driftAfter(12, 20, 0)).toBeGreaterThan(10);
    expect(driftAfter(12, 20, HALF)).toBeLessThan(-10);
    expect(driftAfter(8, 20, 0)).toBe(0);
    expect(driftAfter(17, 20, HALF)).toBe(0);
  });

  it('turns a flyer round when the gust turns', () => {
    const { world, log } = windRace(windySky([{ ...ZONE, offsetTicks: HALF - 30 }]));
    const flyer = racerOf(world, 'player');
    placeOnTile(flyer, 12, 4);
    step(world, log, 29);
    expect(flyer.body.vx).toBeGreaterThan(0);
    step(world, log, 30);
    expect(flyer.body.vx).toBeLessThan(0);
  });
});
