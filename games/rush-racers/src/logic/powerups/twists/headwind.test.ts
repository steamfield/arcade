/**
 * Cloudreach's Headwind: fired from the Undertow slot, a gust front sweeps forward from its owner for
 * 30 tiles and holds back every flyer it passes over but its owner. Raced through `createWorld` and
 * `stepRace` on a small inline Cloudreach sky; on Hard every slot is a person, so nobody moves unless
 * a test moves them.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { mediumOf } from '../../media/index.ts';
import { centreOf } from '../../racers.ts';
import { courseFromLevel, eventsIn, giveItems, hold, IDLE, placeOnTile, racerOf } from '../../test-world.ts';
import { type Difficulty, RACER_IDS, type RacerId, TILE, type TickInput } from '../../types.ts';
import { createWorld, stepRace } from '../../world.ts';
import { HEADWIND, HEADWIND_SWEEP_TICKS, HEADWIND_TUNING, headwindAt } from './headwind.ts';

/**
 * A Cloudreach sky 60 columns wide, flown left to right: a ceiling on row 0, open sky on rows 1-8 with
 * an updraft column at cols 40-41, a floor on row 9 and the finish on column 59.
 */
const SKY = [
  '#'.repeat(60),
  ...Array.from({ length: 7 }, () => `#${'.'.repeat(39)}^^${'.'.repeat(16)}F#`),
  `#1.2.3.4${'.'.repeat(32)}^^${'.'.repeat(16)}F#`,
  '#'.repeat(60),
].join('\n');

/** The same sky cut to 20 columns, too short for a whole sweep. */
const SHORT_SKY = SKY.split('\n')
  .map((row) => `${row.slice(0, 18)}${row.slice(-2)}`)
  .join('\n');

/** The tile row racers stand on, just over the floor. */
const STANDING_ROW = 8;

const RIGHT = hold({ x: 1, y: 0 });
/** A press of use with the stick let go: it fires the selected item, if any. */
const USE = hold({ x: 0, y: 0 }, { use: true });

/**
 * A racing Cloudreach world on `ascii`. On Hard every slot is a person (so nobody moves on their own);
 * Easy allows only the player, so its rivals fly.
 */
function headwindRace(difficulty: Difficulty = 'hard', ascii = SKY) {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel({ name: 'headwind', ascii }, 'flight', { world: 'cloudreach', theme: 'sky' });
  const humans = difficulty === 'hard' ? RACER_IDS : (['player'] as const);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone', difficulty, humans });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const at = (id: RacerId, col: number) => placeOnTile(racerOf(world, id), col, STANDING_ROW);
  /** Steps `ticks` ticks with every person idle except any `inputs` given. */
  const run = (ticks: number, inputs: Partial<Record<RacerId, TickInput>> = {}) => {
    for (let tick = 0; tick < ticks; tick++) {
      log.tick = world.tick + 1;
      stepRace(world, { player: IDLE, tess: IDLE, squib: IDLE, bo: IDLE, ...inputs }, TICK_DT);
    }
  };
  /** One tick in which the player is handed a Headwind and uses it. */
  const fire = () => {
    giveItems(racerOf(world, 'player'), ['undertow']);
    run(1, { player: USE });
  };
  return { world, log, at, run, fire };
}

/** The twist events, without stamps. */
const twistEvents = (log: EventLog<GameEvent>) => eventsIn(log, 'twist.launched', 'twist.landed', 'twist.ended');

describe('how a Headwind front sweeps', () => {
  it('replaces the Undertow, sweeping toward +x at its speed from just ahead of its owner', () => {
    const { world, log, at, run, fire } = headwindRace();
    at('player', 9);
    fire();
    const ownerX = centreOf(racerOf(world, 'player')).x;
    const halfWidth = (HEADWIND_TUNING.widthTiles * TILE) / 2;
    expect(world.twists.map((twist) => twist.x)).toEqual([ownerX + halfWidth + HEADWIND_TUNING.speed * TICK_DT]);
    run(30);
    expect(world.twists[0]?.x).toBeCloseTo(ownerX + halfWidth + 31 * HEADWIND_TUNING.speed * TICK_DT, 6);
    expect(eventsIn(log, 'item.used', 'undertow.fired')).toEqual([
      { type: 'item.used', id: 'player', kind: 'undertow', slot: 0, chargesLeft: 0 },
    ]);
  });

  it('dies away once, after sweeping 30 tiles', () => {
    const { world, log, at, run, fire } = headwindRace();
    at('player', 9);
    fire();
    const startX = (world.twists[0]?.x ?? 0) - HEADWIND_TUNING.speed * TICK_DT;
    run(HEADWIND_SWEEP_TICKS - 2);
    expect(world.twists).toHaveLength(1);
    run(1);
    expect(world.twists).toEqual([]);
    const ended = twistEvents(log).at(-1);
    expect(twistEvents(log).map((event) => event.type)).toEqual(['twist.launched', 'twist.ended']);
    expect(ended?.type === 'twist.ended' && (ended.x - startX) / TILE).toBeCloseTo(HEADWIND_TUNING.sweepTiles, 6);
    run(60);
    expect(twistEvents(log)).toHaveLength(2);
  });

  it('ends once when it leaves the level before its sweep is done', () => {
    const { world, log, at, run, fire } = headwindRace('hard', SHORT_SKY);
    at('player', 9);
    fire();
    run(HEADWIND_SWEEP_TICKS);
    expect(world.twists).toEqual([]);
    const ended = eventsIn(log, 'twist.ended');
    expect(ended).toHaveLength(1);
    // It ends on the tick its back edge crosses the level's right edge, 20 tiles in.
    const backEdge = ended[0]?.type === 'twist.ended' ? ended[0].x - (HEADWIND_TUNING.widthTiles * TILE) / 2 : 0;
    expect(backEdge).toBeGreaterThanOrEqual(20 * TILE);
    expect(backEdge).toBeLessThan(20 * TILE + HEADWIND_TUNING.speed * TICK_DT);
  });
});

describe('who a Headwind front holds back', () => {
  /**
   * The player at col 9 presses use, holding a Headwind or nothing, with Tess flying right from 10
   * tiles ahead; then both fly right for `ticks`. Squib and Bo wait behind the player. Returns both
   * flyers' x.
   */
  function flyRightAfter(fires: boolean, ticks: number) {
    const { world, at, run } = headwindRace();
    at('player', 9);
    at('tess', 19);
    at('squib', 1);
    at('bo', 3);
    if (fires) giveItems(racerOf(world, 'player'), ['undertow']);
    const flying = { player: RIGHT, tess: RIGHT };
    run(1, { ...flying, player: USE });
    run(ticks, flying);
    return { player: centreOf(racerOf(world, 'player')).x, tess: centreOf(racerOf(world, 'tess')).x };
  }

  it('holds back a flyer it passes over, and never its owner', () => {
    const calm = flyRightAfter(false, HEADWIND_SWEEP_TICKS);
    const windy = flyRightAfter(true, HEADWIND_SWEEP_TICKS);
    expect(windy.player).toBe(calm.player);
    // The front crosses a flyer holding right in about half a second and costs it about a tile.
    expect((calm.tess - windy.tess) / TILE).toBeGreaterThan(1);
  });

  it('keeps an updraft lifting a flyer inside the front while replacing its sideways wind', () => {
    const { world, at, fire } = headwindRace();
    at('player', 37);
    at('tess', 40);
    fire();
    const env = mediumOf(world).sampleEnvironment(world, racerOf(world, 'tess'));
    expect(env).toEqual({ kind: 'flight', wind: { x: HEADWIND_TUNING.gust, y: -1 }, inFog: false });
  });

  it('passes over a racer that is invulnerable, fallen out or finished', () => {
    const { world, at, fire } = headwindRace();
    at('player', 9);
    for (const id of ['tess', 'squib', 'bo'] as const) at(id, 10);
    fire();
    const [tess, squib, bo] = (['tess', 'squib', 'bo'] as const).map((id) => racerOf(world, id));
    if (!tess || !squib || !bo) throw new Error('three rivals');
    expect([tess, squib, bo].map((racer) => headwindAt(world, racer))).toEqual([-2, -2, -2]);
    tess.status.invulnerable = 30;
    squib.status.fallen = 30;
    bo.finished = { tick: 100, place: 1, overshoot: 0 };
    expect([tess, squib, bo].map((racer) => headwindAt(world, racer))).toEqual([null, null, null]);
  });

  it("never holds back a human with an Easy rival's front, but does a rival", () => {
    const { world, at } = headwindRace('easy');
    at('tess', 9);
    at('player', 10);
    at('squib', 10);
    const tess = racerOf(world, 'tess');
    HEADWIND.fire(world, tess, { x: 1, y: 0 });
    expect(headwindAt(world, racerOf(world, 'player'))).toBeNull();
    expect(headwindAt(world, racerOf(world, 'squib'))).toBe(HEADWIND_TUNING.gust);
    expect(headwindAt(world, tess)).toBeNull();
  });

  it("holds back a human with a Hard rival's front", () => {
    const { world, at } = headwindRace('hard');
    at('tess', 9);
    at('player', 10);
    HEADWIND.fire(world, racerOf(world, 'tess'), { x: 1, y: 0 });
    expect(headwindAt(world, racerOf(world, 'player'))).toBe(HEADWIND_TUNING.gust);
  });
});

describe('when a rival wants a Headwind', () => {
  /** A world with each racer's place and progress (tiles to go) set as given, in RACER_IDS order. */
  function standings(difficulty: Difficulty, places: number[], progress: number[]) {
    const { world } = headwindRace(difficulty);
    RACER_IDS.forEach((id, index) => {
      const racer = racerOf(world, id);
      racer.place = places[index] ?? 1;
      racer.progress = progress[index] ?? 0;
    });
    return world;
  }

  it('wants it from 3rd or 4th with a racer 8 or more tiles ahead, and not from 2nd', () => {
    const world = standings('hard', [1, 2, 3, 4], [10, 19, 20, 30]);
    const wants = (id: RacerId) => HEADWIND.rivalWants(world, racerOf(world, id), { x: 1, y: 0 });
    expect([wants('tess'), wants('squib'), wants('bo')]).toEqual([false, true, true]);
    // With the leader only 7 tiles ahead, 3rd place has no use for it.
    racerOf(world, 'player').progress = 13;
    expect(wants('squib')).toBe(false);
  });

  it('does not count a human ahead on Easy', () => {
    const world = standings('easy', [1, 3, 2, 4], [10, 18, 12, 22]);
    expect(HEADWIND.rivalWants(world, racerOf(world, 'tess'), { x: 1, y: 0 })).toBe(false);
    racerOf(world, 'squib').progress = 9;
    expect(HEADWIND.rivalWants(world, racerOf(world, 'tess'), { x: 1, y: 0 })).toBe(true);
  });
});
