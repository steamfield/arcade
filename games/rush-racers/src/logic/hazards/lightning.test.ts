import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { COUNTDOWN_TICKS } from '../race/standings.ts';
import {
  courseFromLevel,
  eventsIn,
  giveItems,
  placeAt,
  placeOnTile,
  raceOn,
  racerOf,
  step,
  ticksOf,
  tileCentre,
} from '../test-world.ts';
import { type LevelDef, type LightningZone, RACER_SIZE, type RacerId, TILE } from '../types.ts';
import { createWorld } from '../world.ts';
import { lightningPhase } from './lightning.ts';
import { LIGHTNING } from './tuning.ts';

/** A cycle long enough to have calm in it: calm 0-42, warning 43-87, strike 88-99. */
const PERIOD = 100;
const FIRST_WARNING = PERIOD - LIGHTNING.warnTicks - LIGHTNING.strikeTicks;
const FIRST_STRIKE = PERIOD - LIGHTNING.strikeTicks;

/** A storm over columns 6-7 on a cycle of PERIOD race ticks, unshifted. */
const STORM: LightningZone = { cols: [6, 7], periodTicks: PERIOD, offsetTicks: 0 };

/** Left edge of the storm's columns, world px. */
const STORM_LEFT = STORM.cols[0] * TILE;

/** A five-row pool, starts on the left, finish on the right, with `lightning` overhead. */
function stormyPool(...lightning: LightningZone[]): LevelDef {
  const ascii = `
    ##############
    #1..........F#
    #2..........F#
    #3..........F#
    #4..........F#
    #...........F#
    ##############
  `;
  return { name: 'storm', ascii, lightning };
}

/**
 * A racing world under STORM stepped to the tick before its first strike with every racer put back
 * on its start, outside the storm, so the next step is the strike's first tick. `strikeEvents`
 * lists the events of the given types from that tick on, without their stamps.
 */
function justBeforeStrike() {
  const { world, log } = raceOn(stormyPool(STORM));
  step(world, log, FIRST_STRIKE - 1);
  world.racers.forEach((racer, index) => {
    const start = world.level.starts[index];
    if (start) placeOnTile(racer, start.x, start.y);
  });
  const strikeEvents = (...types: GameEvent['type'][]) =>
    log
      .all()
      .filter((event) => event.tick >= FIRST_STRIKE && types.includes(event.type))
      .map(({ tick: _tick, seq: _seq, ...event }) => event);
  return { world, log, strikeEvents, racer: (id: RacerId) => racerOf(world, id) };
}

describe('lightningPhase', () => {
  it('is calm, then warns, then strikes at the end of each period', () => {
    const phases = [0, FIRST_WARNING - 1, FIRST_WARNING, FIRST_STRIKE - 1, FIRST_STRIKE, PERIOD - 1, PERIOD].map(
      (tick) => lightningPhase(STORM, tick),
    );

    expect(phases).toEqual(['calm', 'calm', 'warning', 'warning', 'strike', 'strike', 'calm']);
  });

  it('runs the same cycle every period', () => {
    const cycle = (from: number) => Array.from({ length: PERIOD }, (_, tick) => lightningPhase(STORM, from + tick));

    expect(cycle(PERIOD * 3)).toEqual(cycle(0));
  });

  it('runs offsetTicks ahead of an unshifted zone', () => {
    const early = { ...STORM, offsetTicks: 10 };
    const phases = [
      FIRST_WARNING - 11,
      FIRST_WARNING - 10,
      FIRST_STRIKE - 11,
      FIRST_STRIKE - 10,
      PERIOD - 11,
      PERIOD - 10,
    ];

    expect(phases.map((tick) => lightningPhase(early, tick))).toEqual([
      'calm',
      'warning',
      'warning',
      'strike',
      'strike',
      'calm',
    ]);
  });

  it('never calms a zone whose period is just the warning and the strike', () => {
    const restless = { ...STORM, periodTicks: LIGHTNING.warnTicks + LIGHTNING.strikeTicks };
    const phases = Array.from({ length: restless.periodTicks }, (_, tick) => lightningPhase(restless, tick));

    expect(phases.filter((phase) => phase === 'warning')).toHaveLength(LIGHTNING.warnTicks);
    expect(phases.filter((phase) => phase === 'strike')).toHaveLength(LIGHTNING.strikeTicks);
  });
});

describe('storm events', () => {
  it("announce each zone's warning and strike once per cycle, on their first tick", () => {
    const ahead: LightningZone = { cols: [10, 10], periodTicks: PERIOD, offsetTicks: 20 };
    const { world, log } = raceOn(stormyPool(STORM, ahead));

    step(world, log, 2 * PERIOD);

    const announced = log
      .all()
      .filter((event) => event.type === 'lightning.warned' || event.type === 'lightning.struck')
      .map(({ seq: _seq, ...event }) => event);
    expect(announced).toEqual([
      { tick: FIRST_WARNING - 20, type: 'lightning.warned', zone: 1 },
      { tick: FIRST_WARNING, type: 'lightning.warned', zone: 0 },
      { tick: FIRST_STRIKE - 20, type: 'lightning.struck', zone: 1 },
      { tick: FIRST_STRIKE, type: 'lightning.struck', zone: 0 },
      { tick: PERIOD + FIRST_WARNING - 20, type: 'lightning.warned', zone: 1 },
      { tick: PERIOD + FIRST_WARNING, type: 'lightning.warned', zone: 0 },
      { tick: PERIOD + FIRST_STRIKE - 20, type: 'lightning.struck', zone: 1 },
      { tick: PERIOD + FIRST_STRIKE, type: 'lightning.struck', zone: 0 },
    ]);
  });
});

describe('a strike', () => {
  it('stuns every racer in the columns at any height and leaves the rest alone', () => {
    const { world, log, racer, strikeEvents } = justBeforeStrike();
    placeOnTile(racer('player'), 6, 1);
    placeOnTile(racer('tess'), 7, 5);
    placeOnTile(racer('squib'), 5, 3);
    placeOnTile(racer('bo'), 8, 3);

    step(world, log);

    expect(strikeEvents('lightning.struck', 'racer.hit', 'racer.stunned')).toEqual([
      { type: 'lightning.struck', zone: 0 },
      { type: 'racer.hit', id: 'player', cause: 'lightning', by: null },
      { type: 'racer.stunned', id: 'player' },
      { type: 'racer.hit', id: 'tess', cause: 'lightning', by: null },
      { type: 'racer.stunned', id: 'tess' },
    ]);
  });

  it('hits a racer whose box only just reaches into the columns, not one touching their edge', () => {
    const hitsWithRightEdgeAt = (rightEdge: number) => {
      const { world, log, racer, strikeEvents } = justBeforeStrike();
      placeAt(racer('player'), { x: rightEdge - RACER_SIZE.width / 2, y: tileCentre(0, 1).y });
      step(world, log);
      return strikeEvents('racer.hit');
    };

    expect(hitsWithRightEdgeAt(STORM_LEFT + 2)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'lightning', by: null },
    ]);
    expect(hitsWithRightEdgeAt(STORM_LEFT)).toEqual([]);
  });

  it('only lands once on a racer that stays in the columns for the whole strike', () => {
    const { world, log, racer, strikeEvents } = justBeforeStrike();
    placeOnTile(racer('player'), 6, 1);

    step(world, log, LIGHTNING.strikeTicks);

    expect(strikeEvents('racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'lightning', by: null }]);
  });

  it('passes over an invulnerable, a fallen or a finished racer and pops a shield', () => {
    const { world, log, racer, strikeEvents } = justBeforeStrike();
    placeOnTile(racer('player'), 6, 1);
    giveItems(racer('player'), ['bubbleShield']);
    placeOnTile(racer('tess'), 6, 2);
    racer('tess').status.invulnerable = 30;
    placeOnTile(racer('squib'), 7, 3);
    racer('squib').status.fallen = 30;
    placeOnTile(racer('bo'), 7, 4);
    racer('bo').finished = { tick: 50, place: 1, overshoot: 0 };

    step(world, log);

    expect(strikeEvents('racer.hit', 'racer.stunned', 'shield.popped')).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'lightning', by: null },
      { type: 'shield.popped', id: 'player' },
    ]);
    expect(racer('player').status.stunned).toBe(0);
  });

  it('does nothing during the warning', () => {
    const { world, log } = raceOn(stormyPool(STORM));
    step(world, log, FIRST_WARNING - 1);
    placeOnTile(racerOf(world, 'player'), 6, 1);

    step(world, log, LIGHTNING.warnTicks);

    expect(eventsIn(log, 'racer.hit')).toEqual([]);
    expect(eventsIn(log, 'lightning.warned')).toEqual([{ type: 'lightning.warned', zone: 0 }]);
  });
});

describe('outside the race', () => {
  it('keeps the sky calm through the countdown, counting the cycle from the start', () => {
    const log = new EventLog<GameEvent>(10_000);
    const world = createWorld(courseFromLevel(stormyPool(STORM)), log, { seed: 1 });
    const startTick = COUNTDOWN_TICKS + 1;

    step(world, log, startTick + FIRST_WARNING);

    expect(ticksOf(log, 'race.started')).toEqual([startTick]);
    expect(ticksOf(log, 'lightning.warned')).toEqual([startTick + FIRST_WARNING]);
  });

  it('stops once the race is over', () => {
    const { world, log } = raceOn(stormyPool(STORM));
    step(world, log, 10);
    placeOnTile(racerOf(world, 'player'), 12, 1);
    step(world, log);
    expect(world.race.phase).toBe('finished');

    step(world, log, PERIOD);

    expect(eventsIn(log, 'lightning.warned', 'lightning.struck')).toEqual([]);
  });
});

describe('determinism', () => {
  it('strikes the same racers on the same ticks from the same seed', () => {
    const wideStorm: LightningZone = { cols: [3, 9], periodTicks: 57, offsetTicks: 0 };
    const strikes = () => {
      const { world, log } = raceOn(stormyPool(wideStorm), { seed: 7 });
      step(world, log, 600);
      return log.all().filter((event) => event.type === 'racer.hit' && event.cause === 'lightning');
    };

    const first = strikes();

    expect(first.length).toBeGreaterThan(0);
    expect(strikes()).toEqual(first);
  });
});
