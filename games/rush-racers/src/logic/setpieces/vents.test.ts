import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { LevelError, parseLevel } from '../level/parse.ts';
import { COUNTDOWN_TICKS } from '../race/standings.ts';
import { courseFromLevel, eventsIn, placeOnTile, raceOn, racerOf, step, ticksOf } from '../test-world.ts';
import type { LevelDef, Racer, RacerId, VentDef, World } from '../types.ts';
import { createWorld } from '../world.ts';
import { VENT, ventPhase } from './vents.ts';

/** A cycle with quiet in it: warning 0-44, eruption 45-104, quiet 105-199. */
const PERIOD = 200;
const FIRST_ERUPTION = VENT.warnTicks;
const FIRST_QUIET = VENT.warnTicks + VENT.eruptTicks;

/** A vent on the pool floor at column 6 (its column is 6-7), reaching up to row 1, unshifted. */
const VENT_6: VentDef = { col: 6, row: 8, height: 7, periodTicks: PERIOD, offsetTicks: 0 };

/**
 * A pool 16 by 10 tiles, starts on the left, finish on the right. With `surface`, the sea's surface
 * is the top of row 4 over columns 4-11, with air above it.
 */
function pool(vents: VentDef[], surface = false): LevelDef {
  const ascii = `
    ################
    #.............F#
    #.............F#
    #1............F#
    #2............F#
    #3............F#
    #4............F#
    #.............F#
    #.............F#
    ################
  `;
  return { name: 'vents', ascii, vents, surface: surface ? [{ from: 4, to: 11, row: 4 }] : [] };
}

/** The LevelError parseLevel throws for `vents` in the pool; any other outcome fails the test. */
function ventErrorFrom(...vents: VentDef[]): LevelError {
  try {
    parseLevel(pool(vents));
  } catch (error) {
    if (error instanceof LevelError) return error;
    throw error;
  }
  throw new Error('parseLevel accepted vents it should have rejected');
}

/** Puts racers where a test needs them, given a lookup by slot. */
type Arrange = (racer: (id: RacerId) => Racer) => void;

/**
 * A racing world on the pool (with `VENT_6` unless `vents` says otherwise) stepped to the tick
 * before `VENT_6` first erupts, then arranged, then stepped `ticks` more: the first is the eruption's first tick.
 */
function intoEruption(arrange: Arrange, options: { vents?: VentDef[]; surface?: boolean; ticks?: number } = {}) {
  const { world, log } = raceOn(pool(options.vents ?? [VENT_6], options.surface));
  step(world, log, FIRST_ERUPTION - 1);
  arrange((id) => racerOf(world, id));
  step(world, log, options.ticks ?? 1);
  return { world, log };
}

/**
 * How much the eruption's first tick changed each racer's vertical speed, against the same racers
 * arranged the same way in a pool with no vent.
 */
function eruptionPush(arrange: Arrange): Record<RacerId, number> {
  const vyOf = ({ world }: { world: World; log: EventLog<GameEvent> }) =>
    Object.fromEntries(world.racers.map((racer) => [racer.id, racer.body.vy]));
  const erupted = vyOf(intoEruption(arrange));
  const calm = vyOf(intoEruption(arrange, { vents: [] }));
  const push = (id: RacerId) => Math.round(((erupted[id] ?? 0) - (calm[id] ?? 0)) * 1e6) / 1e6;
  return { player: push('player'), tess: push('tess'), squib: push('squib'), bo: push('bo') };
}

/** The upward speed one tick of eruption adds, rounded as `eruptionPush` rounds. */
const ONE_TICK_PUSH = -Math.round(VENT.push * TICK_DT * 1e6) / 1e6;

describe('parseVents', () => {
  it('reads vents as written', () => {
    const ahead: VentDef = { col: 10, row: 8, height: 2, periodTicks: FIRST_QUIET, offsetTicks: 30 };

    expect(parseLevel(pool([VENT_6, ahead])).vents).toEqual([VENT_6, ahead]);
    expect(parseLevel(pool([])).vents).toEqual([]);
  });

  it.each([
    ['left of the map', { ...VENT_6, col: -1 }],
    ['with its second column past the right edge', { ...VENT_6, col: 15 }],
    ['below the map', { ...VENT_6, row: 10 }],
    ['above the map', { ...VENT_6, row: -1 }],
  ])('rejects a vent %s', (_where, vent) => {
    expect(ventErrorFrom(vent).message).toMatch(/^Vent 0 at col -?\d+, row -?\d+ is off the map/);
  });

  it('rejects a vent whose column reaches above the map, and takes one reaching the top row', () => {
    expect(ventErrorFrom({ ...VENT_6, height: VENT_6.row + 1 }).message).toBe(
      `Vent 0 reaches row -1, above the map; lower its height to at most ${VENT_6.row}`,
    );
    expect(parseLevel(pool([{ ...VENT_6, height: VENT_6.row }])).vents).toHaveLength(1);
  });

  it('rejects a vent that reaches less than a tile up', () => {
    expect(ventErrorFrom({ ...VENT_6, height: 0 }).message).toBe(
      'Vent 0 has height 0; it must reach at least 1 tile up',
    );
  });

  it('rejects a period shorter than the warning plus the eruption, and takes one exactly that long', () => {
    expect(ventErrorFrom({ ...VENT_6, periodTicks: FIRST_QUIET - 1 }).message).toBe(
      'Vent 0 repeats every 104 ticks, shorter than its 45-tick warning plus 60-tick eruption; use at least 105',
    );
    expect(parseLevel(pool([{ ...VENT_6, periodTicks: FIRST_QUIET }])).vents).toHaveLength(1);
  });

  it('rejects two vents sharing a column, and takes two side by side', () => {
    const error = ventErrorFrom(VENT_6, { ...VENT_6, col: 7, row: 5, height: 4 });

    expect(error.message).toBe(
      'Vent 1 at col 7 shares a column with vent 0 at col 6; space vents at least 2 columns apart',
    );
    expect({ row: error.row, col: error.col }).toEqual({ row: 5, col: 7 });
    expect(parseLevel(pool([VENT_6, { ...VENT_6, col: 8 }])).vents).toHaveLength(2);
  });
});

describe('ventPhase', () => {
  it('warns, then erupts, then is quiet, the same every period', () => {
    const ticks = [0, FIRST_ERUPTION - 1, FIRST_ERUPTION, FIRST_QUIET - 1, FIRST_QUIET, PERIOD - 1];
    const phases = (from: number) => ticks.map((tick) => ventPhase(VENT_6, from + tick));

    expect(phases(0)).toEqual(['warning', 'warning', 'erupting', 'erupting', 'quiet', 'quiet']);
    expect(phases(PERIOD * 3)).toEqual(phases(0));
  });

  it('runs offsetTicks ahead of an unshifted vent', () => {
    const early = { ...VENT_6, offsetTicks: 10 };
    const ticks = [FIRST_ERUPTION - 11, FIRST_ERUPTION - 10, FIRST_QUIET - 11, FIRST_QUIET - 10, PERIOD - 11];

    expect(ticks.map((tick) => ventPhase(early, tick))).toEqual(['warning', 'erupting', 'erupting', 'quiet', 'quiet']);
  });
});

describe('vent events', () => {
  it("announce each vent's warning and eruption once per cycle, on their first tick", () => {
    // raceOn starts the race on world tick 0, so world ticks here are race ticks.
    const soon: VentDef = { ...VENT_6, offsetTicks: PERIOD - 10 };
    const later: VentDef = { ...VENT_6, col: 10, offsetTicks: PERIOD - 30 };
    const { world, log } = raceOn(pool([soon, later]));

    step(world, log, 2 * PERIOD);

    const announced = log
      .all()
      .filter((event) => event.type === 'vent.warned' || event.type === 'vent.erupted')
      .map(({ seq: _seq, ...event }) => event);
    expect(announced).toEqual([
      { tick: 10, type: 'vent.warned', vent: 0 },
      { tick: 30, type: 'vent.warned', vent: 1 },
      { tick: 10 + FIRST_ERUPTION, type: 'vent.erupted', vent: 0 },
      { tick: 30 + FIRST_ERUPTION, type: 'vent.erupted', vent: 1 },
      { tick: 10 + PERIOD, type: 'vent.warned', vent: 0 },
      { tick: 30 + PERIOD, type: 'vent.warned', vent: 1 },
      { tick: 10 + PERIOD + FIRST_ERUPTION, type: 'vent.erupted', vent: 0 },
      { tick: 30 + PERIOD + FIRST_ERUPTION, type: 'vent.erupted', vent: 1 },
    ]);
  });

  it('announce a vent already erupting when the countdown ends on the start tick, and none before', () => {
    const erupting: VentDef = { ...VENT_6, offsetTicks: FIRST_ERUPTION + 5 };
    const log = new EventLog<GameEvent>(10_000);
    const world = createWorld(courseFromLevel(pool([erupting])), log, { seed: 1 });
    const startTick = COUNTDOWN_TICKS + 1;

    step(world, log, startTick);

    expect(ticksOf(log, 'race.started')).toEqual([startTick]);
    expect(ticksOf(log, 'vent.erupted')).toEqual([startTick]);
    expect(ticksOf(log, 'vent.warned')).toEqual([]);
  });
});

describe('an eruption', () => {
  it('pushes a racer whose centre is in its column up and leaves those beside it alone', () => {
    const push = eruptionPush((racer) => {
      placeOnTile(racer('player'), 7, 6);
      placeOnTile(racer('tess'), 5, 6);
      placeOnTile(racer('squib'), 8, 6);
      placeOnTile(racer('bo'), 6, 3);
    });

    expect(push).toEqual({ player: ONE_TICK_PUSH, tess: 0, squib: 0, bo: ONE_TICK_PUSH });
  });

  it('reaches from the vent tile up to the tile `height` rows above, and no further', () => {
    const push = eruptionPush((racer) => {
      placeOnTile(racer('player'), 6, VENT_6.row - VENT_6.height);
      placeOnTile(racer('tess'), 7, VENT_6.row);
      placeOnTile(racer('squib'), 6, VENT_6.row - VENT_6.height - 1);
      placeOnTile(racer('bo'), 9, VENT_6.row);
    });

    expect(push).toEqual({ player: ONE_TICK_PUSH, tess: ONE_TICK_PUSH, squib: 0, bo: 0 });
  });

  it('passes over a fallen, a trapped or a finished racer', () => {
    const push = eruptionPush((racer) => {
      placeOnTile(racer('player'), 6, 6);
      racer('player').status.fallen = 30;
      placeOnTile(racer('tess'), 7, 5);
      racer('tess').status.trapped = 30;
      placeOnTile(racer('squib'), 6, 2);
      racer('squib').finished = { tick: 50, place: 1, overshoot: 0 };
      placeOnTile(racer('bo'), 7, 3);
    });

    expect(push).toEqual({ player: 0, tess: 0, squib: 0, bo: ONE_TICK_PUSH });
  });

  it('does nothing while it only warns', () => {
    const { world, log } = raceOn(pool([VENT_6]));
    const calm = raceOn(pool([]));
    for (const each of [world, calm.world]) placeOnTile(racerOf(each, 'player'), 6, 6);

    step(world, log, FIRST_ERUPTION - 1);
    step(calm.world, calm.log, FIRST_ERUPTION - 1);

    expect(racerOf(world, 'player').body).toEqual(racerOf(calm.world, 'player').body);
  });

  it('throws an idle racer riding it from the floor out through a surface above, which it never reaches without', () => {
    const playerBreaches = (vents: VentDef[]) => {
      const { log } = intoEruption((racer) => placeOnTile(racer('player'), 6, VENT_6.row), {
        vents,
        surface: true,
        ticks: VENT.eruptTicks,
      });
      return eventsIn(log, 'racer.breached').some((event) => 'id' in event && event.id === 'player');
    };

    expect(playerBreaches([VENT_6])).toBe(true);
    expect(playerBreaches([])).toBe(false);
  });
});
