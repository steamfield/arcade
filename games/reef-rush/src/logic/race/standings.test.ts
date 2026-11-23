import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { playerOf } from '../racers.ts';
import { type Racer, type RacerId, TILE, type TickInput, type World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import {
  advanceClock,
  COUNTDOWN_TICKS,
  checkRaceEnd,
  DNF_GRACE_TICKS,
  RACE_LIMIT_TICKS,
  recordFinishes,
  updatePlaces,
} from './standings.ts';

/** Four open lanes; the finish line is at x = 8 * TILE. */
function setup() {
  const level = parseLevel({
    name: 'straight',
    ascii: `
      ##########
      #1......F#
      #2......F#
      #3......F#
      #4......F#
      ##########
    `,
  });
  const log = new EventLog<GameEvent>(10_000);
  return { world: createWorld(level, log, { seed: 1 }), log };
}

/** Skips the countdown so referee calls act on a running race. */
function racing(world: World, raceTick = 0) {
  world.race = { phase: 'racing', raceTick, rivalsDoneAt: null, result: null, endsWhen: 'player' };
}

function racer(world: World, id: RacerId): Racer {
  const found = world.racers.find((r) => r.id === id);
  if (!found) throw new Error(`No racer ${id}`);
  return found;
}

/** Puts a racer's centre `overshoot` px past the finish line. */
function cross(world: World, id: RacerId, overshoot: number) {
  const { body } = racer(world, id);
  body.x = world.level.finishX * TILE + overshoot - body.w / 2;
}

function setProgress(world: World, progress: Record<RacerId, number>) {
  for (const r of world.racers) r.progress = progress[r.id];
}

/** The end-of-tick referee calls in world order, with progress set by the test. */
function referee(world: World) {
  recordFinishes(world);
  updatePlaces(world);
  checkRaceEnd(world);
}

const places = (world: World) => Object.fromEntries(world.racers.map((r) => [r.id, r.place]));
const ofType = (log: EventLog<GameEvent>, type: GameEvent['type']) => log.all().filter((e) => e.type === type);
const HOLD_RIGHT: TickInput = { move: { x: 1, y: 0 }, kick: true, burst: false };

describe('countdown', () => {
  it('beeps 3, 2, 1 at ticks 0, 60 and 120, starts at 180 and holds every racer until then', () => {
    const { world, log } = setup();
    const starts = world.racers.map((r) => ({ ...r.body }));
    const step = () => {
      log.tick = world.tick;
      stepWorld(world, HOLD_RIGHT, TICK_DT);
    };

    for (let i = 0; i < COUNTDOWN_TICKS; i++) step();
    expect(world.race.phase).toBe('countdown');
    expect(world.racers.map((r) => r.body)).toEqual(starts);
    expect(ofType(log, 'player.place')).toEqual([]);

    step();
    expect(world.race).toMatchObject({ phase: 'racing', raceTick: 0 });
    expect(playerOf(world).body.x).toBeGreaterThan(starts[0]?.x ?? Number.POSITIVE_INFINITY);
    expect(log.all().filter((e) => e.type.startsWith('race.'))).toMatchObject([
      { type: 'race.countdown', n: 3, tick: 0 },
      { type: 'race.countdown', n: 2, tick: 60 },
      { type: 'race.countdown', n: 1, tick: 120 },
      { type: 'race.started', tick: 180 },
    ]);
  });

  it('holds racers for exactly COUNTDOWN_TICKS ticks, then counts race ticks from 0', () => {
    const { world } = setup();
    const holding = Array.from({ length: COUNTDOWN_TICKS + 2 }, () => advanceClock(world));

    expect(holding.filter(Boolean)).toHaveLength(COUNTDOWN_TICKS);
    expect(holding.slice(COUNTDOWN_TICKS)).toEqual([false, false]);
    expect(world.race).toMatchObject({ phase: 'racing', raceTick: 1 });
  });
});

describe('placing', () => {
  it('ranks finished racers first by place, then the rest by progress', () => {
    const { world } = setup();
    racing(world, 50);
    setProgress(world, { player: 1, tess: 6, squib: 2, bo: 9 });
    racer(world, 'bo').finished = { tick: 40, place: 1, overshoot: 1 };
    updatePlaces(world);

    expect(places(world)).toEqual({ bo: 1, player: 2, squib: 3, tess: 4 });
  });

  it('breaks equal progress in racer order', () => {
    const { world } = setup();
    racing(world);
    setProgress(world, { player: 5, tess: 3, squib: 4, bo: 3 });
    updatePlaces(world);

    expect(places(world)).toEqual({ tess: 1, bo: 2, squib: 3, player: 4 });
  });

  it('announces the player place only when it changes', () => {
    const { world, log } = setup();
    racing(world);
    setProgress(world, { player: 1, tess: 2, squib: 3, bo: 4 });
    updatePlaces(world);
    setProgress(world, { player: 9, tess: 2, squib: 3, bo: 4 });
    updatePlaces(world);
    updatePlaces(world);
    setProgress(world, { player: 2.5, tess: 2, squib: 3, bo: 4 });
    updatePlaces(world);

    expect(ofType(log, 'player.place')).toMatchObject([
      { type: 'player.place', place: 4 },
      { type: 'player.place', place: 2 },
    ]);
  });
});

describe('finishing', () => {
  it('records a crossing once with its race tick, place and overshoot', () => {
    const { world, log } = setup();
    racing(world, 42);
    cross(world, 'tess', 3);
    recordFinishes(world);
    world.race.raceTick = 43;
    recordFinishes(world);

    expect(racer(world, 'tess').finished).toEqual({ tick: 42, place: 1, overshoot: 3 });
    expect(ofType(log, 'racer.finished')).toMatchObject([{ type: 'racer.finished', id: 'tess', place: 1, ticks: 42 }]);
  });

  it('places a later finisher after the earlier ones', () => {
    const { world } = setup();
    racing(world, 42);
    cross(world, 'tess', 3);
    recordFinishes(world);
    world.race.raceTick = 50;
    cross(world, 'player', 1);
    recordFinishes(world);

    expect(playerOf(world).finished).toEqual({ tick: 50, place: 2, overshoot: 1 });
  });

  it('finishes a racer whose centre is exactly on the line, not one a pixel short', () => {
    const { world } = setup();
    racing(world, 10);
    cross(world, 'squib', 0);
    cross(world, 'bo', -1);
    recordFinishes(world);

    expect(racer(world, 'squib').finished).toEqual({ tick: 10, place: 1, overshoot: 0 });
    expect(racer(world, 'bo').finished).toBeNull();
  });

  it('places racers crossing on the same tick by how far past the line they are', () => {
    const { world } = setup();
    racing(world, 10);
    cross(world, 'tess', 2);
    cross(world, 'squib', 5);
    recordFinishes(world);

    expect(racer(world, 'squib').finished?.place).toBe(1);
    expect(racer(world, 'tess').finished?.place).toBe(2);
  });

  it('breaks an equal overshoot on the same tick in racer order', () => {
    const { world } = setup();
    racing(world, 10);
    cross(world, 'bo', 3);
    cross(world, 'tess', 3);
    recordFinishes(world);

    expect(racer(world, 'tess').finished?.place).toBe(1);
    expect(racer(world, 'bo').finished?.place).toBe(2);
  });
});

describe('race end', () => {
  it('ends when the player finishes and announces the result once', () => {
    const { world, log } = setup();
    racing(world, 90);
    setProgress(world, { player: 1, tess: 0, squib: 3, bo: 2 });
    cross(world, 'tess', 2);
    referee(world);
    world.race.raceTick = 100;
    cross(world, 'player', 2);
    referee(world);
    referee(world);

    const result = { standings: ['tess', 'player', 'bo', 'squib'], playerPlace: 2, playerTicks: 100 };
    expect(world.race).toMatchObject({ phase: 'finished', result });
    expect(ofType(log, 'race.finished')).toMatchObject([{ type: 'race.finished', ...result }]);
  });

  it('ends DNF_GRACE_TICKS after the third rival finishes, placing the player after them with no time', () => {
    const { world, log } = setup();
    racing(world, 80);
    setProgress(world, { player: 4, tess: 0, squib: 0, bo: 0 });
    for (const [tick, id] of [
      [80, 'tess'],
      [90, 'squib'],
      [100, 'bo'],
    ] as const) {
      world.race.raceTick = tick;
      cross(world, id, 1);
      referee(world);
    }
    expect(world.race.rivalsDoneAt).toBe(100);

    world.race.raceTick = 100 + DNF_GRACE_TICKS - 1;
    referee(world);
    expect(world.race.phase).toBe('racing');

    world.race.raceTick = 100 + DNF_GRACE_TICKS;
    referee(world);
    const result = { standings: ['tess', 'squib', 'bo', 'player'], playerPlace: 4, playerTicks: null };
    expect(world.race).toMatchObject({ phase: 'finished', result });
    expect(ofType(log, 'race.finished')).toMatchObject([{ type: 'race.finished', ...result }]);
  });

  it('ends at RACE_LIMIT_TICKS, placing the unfinished player by progress after every finisher', () => {
    const { world } = setup();
    racing(world, 10);
    setProgress(world, { player: 2, tess: 0, squib: 5, bo: 4 });
    cross(world, 'tess', 1);
    referee(world);

    world.race.raceTick = RACE_LIMIT_TICKS - 1;
    referee(world);
    expect(world.race.phase).toBe('racing');

    world.race.raceTick = RACE_LIMIT_TICKS;
    referee(world);
    expect(world.race).toMatchObject({
      phase: 'finished',
      result: { standings: ['tess', 'player', 'bo', 'squib'], playerPlace: 2, playerTicks: null },
    });
  });
});
