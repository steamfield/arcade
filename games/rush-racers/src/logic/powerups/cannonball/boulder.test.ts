/**
 * Thornwood's Boulder, raced through `createWorld` on small inline Thornwood courses: the player
 * fires its Cannonball with Use, a rival's throw goes through the style's own `fire`. The rivals not
 * in a test start behind the player, stunned for the whole test, so they never meet the boulder.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, eventsIn, giveItems, hold, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { type Difficulty, type Racer, type RacerId, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { BOULDER_TUNING } from './boulder.ts';
import { shotRules, shotStyleOf } from './index.ts';

/** A long floor at row 5 (runners on row 4) with the rivals' starts behind the player's. */
const FLOOR = `
  ##################################
  #................................#
  #................................#
  #................................#
  #2.3.4.1.......................F.#
  ##################################
`;

/** `FLOOR` with a three-tile pit at cols 13-15, open out of the bottom of the level. */
const PIT = `
  ##################################
  #................................#
  #................................#
  #................................#
  #2.3.4.1.......................F.#
  #############...##################
  #############...##################
`;

/** `FLOOR` with a one-tile cracked stone block on the floor at col 14. */
const STONE = `
  ##################################
  #................................#
  #................................#
  #................................#
  #2.3.4.1......C................F.#
  ##################################
`;

const RIVALS: readonly RacerId[] = ['tess', 'squib', 'bo'];
/** Ticks every other rival stays stunned: longer than any test runs. */
const HELD_TICKS = 10_000;
const FIRE_RIGHT = hold({ x: 1, y: 0 }, { use: true });

/** A racing Thornwood world on `ascii` with the player holding a Cannonball and every rival but `free` stunned. */
function thornwoodRace(ascii: string, options: { difficulty?: Difficulty; free?: RacerId } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel(ascii, 'run', { world: 'thornwood' });
  const world = createWorld(course, log, { seed: 1, difficulty: options.difficulty ?? 'hard' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  for (const id of RIVALS) if (id !== options.free) racerOf(world, id).status.stunned = HELD_TICKS;
  const player = racerOf(world, 'player');
  giveItems(player, ['cannonball']);
  return { world, log, player };
}

/** Steps until no shot is left in flight, at most `limit` ticks; returns how many ticks that took. */
function stepUntilShotsEnd(world: World, log: EventLog<GameEvent>, limit = 400): number {
  let ticks = 0;
  while (world.shots.length > 0 && ticks < limit) {
    step(world, log, 1, IDLE);
    ticks++;
  }
  return ticks;
}

/** Where the boulder stopped, in whole tiles. */
function endTile(log: EventLog<GameEvent>) {
  return eventsIn(log, 'shot.ended').map((event) =>
    event.type === 'shot.ended' ? { col: Math.floor(event.x / TILE), row: Math.floor(event.y / TILE) } : null,
  );
}

/** Stands `racer` on tile (`col`, `row`) of the floor. */
function standOn(racer: Racer, col: number, row: number): void {
  placeOnTile(racer, col, row);
  racer.body.y = (row + 1) * TILE - racer.body.h;
}

describe("Thornwood's Cannonball", () => {
  it('is the Boulder; the reef keeps the swim dash', () => {
    const thornwood = thornwoodRace(FLOOR).world;
    const reef = createWorld(courseFromLevel('#1234F#'), new EventLog<GameEvent>(100), { seed: 1 });

    expect([shotStyleOf(thornwood), shotStyleOf(reef)]).toEqual(['boulder', null]);
  });
});

describe('a rolled boulder', () => {
  it('drops just ahead of its thrower and rolls along the floor at its speed, then ends after its ttl', () => {
    const { world, log, player } = thornwoodRace(FLOOR);
    standOn(player, 7, 4);
    step(world, log, 1, FIRE_RIGHT);
    const [shot] = world.shots;
    const launched = shot ? { x: shot.x, y: shot.y, vx: shot.vx } : null;
    step(world, log, 30, IDLE);
    const rolled = world.shots[0] ? { y: world.shots[0].y, vx: world.shots[0].vx } : null;
    const ticks = stepUntilShotsEnd(world, log);

    expect(launched?.x).toBeGreaterThan(player.body.x + player.body.w);
    expect(launched?.vx).toBe(BOULDER_TUNING.rollSpeed);
    // Resting on the floor (row 5's top at 80 px), its centre half a tile above it.
    expect(rolled).toEqual({ y: 5 * TILE - TILE / 2, vx: BOULDER_TUNING.rollSpeed });
    expect(eventsIn(log, 'shot.launched', 'shot.ended', 'racer.hit').map((event) => event.type)).toEqual([
      'shot.launched',
      'shot.ended',
    ]);
    // It rolls into the far wall first unless the ttl ends it: 240 ticks at 3 px is 45 tiles.
    expect(ticks + 31).toBeLessThanOrEqual(BOULDER_TUNING.ttlTicks);
    expect(endTile(log)).toEqual([{ col: 32, row: 4 }]);
  });

  it('ends on its own when its ttl runs out, still rolling', () => {
    const { world, log, player } = thornwoodRace(FLOOR);
    standOn(player, 7, 4);
    step(world, log, 1, FIRE_RIGHT);
    const shot = world.shots[0];
    if (shot) shot.ttl = 5;
    const ticks = stepUntilShotsEnd(world, log);

    expect(ticks).toBe(5);
    expect(eventsIn(log, 'shot.ended')).toHaveLength(1);
  });

  it('falls into a pit and ends once it drops out of the level', () => {
    const { world, log, player } = thornwoodRace(PIT);
    standOn(player, 7, 4);
    step(world, log, 1, FIRE_RIGHT);
    stepUntilShotsEnd(world, log);
    const [ended] = eventsIn(log, 'shot.ended');

    expect(ended).toMatchObject({ type: 'shot.ended', owner: 'player', style: 'boulder' });
    expect(ended?.type === 'shot.ended' && ended.y).toBeGreaterThan(7 * TILE);
    expect(eventsIn(log, 'coral.broken', 'racer.hit')).toEqual([]);
  });

  it('breaks the cracked stone it rolls into and ends there', () => {
    const { world, log, player } = thornwoodRace(STONE);
    standOn(player, 7, 4);
    step(world, log, 1, FIRE_RIGHT);
    stepUntilShotsEnd(world, log);

    expect(eventsIn(log, 'coral.broken', 'shot.ended').map((event) => event.type)).toEqual([
      'coral.broken',
      'shot.ended',
    ]);
    expect(eventsIn(log, 'coral.broken')).toEqual([{ type: 'coral.broken', tx: 14, ty: 4, by: 'player' }]);
    expect(endTile(log)).toEqual([{ col: 13, row: 4 }]);
  });

  it('hits the first rival it reaches and ends there', () => {
    const { world, log, player } = thornwoodRace(FLOOR, { free: 'tess' });
    standOn(player, 7, 4);
    standOn(racerOf(world, 'tess'), 14, 4);
    step(world, log, 1, FIRE_RIGHT);
    stepUntilShotsEnd(world, log);

    expect(eventsIn(log, 'racer.hit', 'shot.ended').map((event) => event.type)).toEqual(['racer.hit', 'shot.ended']);
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'tess', cause: 'boulder', by: 'player' }]);
  });

  it('never hits its owner, rolling on through it', () => {
    const { world, log, player } = thornwoodRace(FLOOR);
    standOn(player, 7, 4);
    step(world, log, 1, FIRE_RIGHT);
    step(world, log, 10, IDLE);
    const shot = world.shots[0];
    if (shot) standOn(player, Math.floor(shot.x / TILE) + 1, 4);
    step(world, log, 10, IDLE);

    expect(world.shots).toHaveLength(1);
    expect(eventsIn(log, 'racer.hit', 'shot.ended')).toEqual([]);
  });
});

describe("a rival's boulder", () => {
  /** Tess throws a boulder right from col 7 at the player standing at col 12; returns the hits and ends. */
  function rivalThrowAtPlayer(difficulty: Difficulty) {
    const { world, log, player } = thornwoodRace(FLOOR, { difficulty });
    const tess = racerOf(world, 'tess');
    standOn(tess, 7, 4);
    tess.facing = 1;
    standOn(player, 12, 4);
    shotRules('boulder').fire(world, tess, { x: 1, y: 0 });
    step(world, log, 30, IDLE);
    return eventsIn(log, 'racer.hit', 'shot.ended').map((event) => event.type);
  }

  it('hits the player on Hard', () => {
    expect(rivalThrowAtPlayer('hard')).toEqual(['racer.hit', 'shot.ended']);
  });

  it('passes through the player on Easy', () => {
    expect(rivalThrowAtPlayer('easy')).toEqual([]);
  });
});

describe('a rival holding the Boulder', () => {
  /** Whether Tess, standing at col 7 facing right, wants to roll it with Bo standing at `boAt` and Squib out of the way. */
  function wants(ascii: string, boAt: { col: number; row: number } | null): boolean {
    const { world } = thornwoodRace(ascii, { free: 'bo' });
    const tess = racerOf(world, 'tess');
    standOn(tess, 7, 4);
    tess.facing = 1;
    standOn(racerOf(world, 'squib'), 2, 4);
    standOn(racerOf(world, 'player'), 3, 4);
    const bo = racerOf(world, 'bo');
    if (boAt) standOn(bo, boAt.col, boAt.row);
    else standOn(bo, 1, 4);
    return shotRules('boulder').rivalWants(world, tess, { x: 1, y: 0 });
  }

  it.each([
    { why: 'a racer 5 tiles ahead on its row', ascii: FLOOR, bo: { col: 12, row: 4 }, wanted: true },
    { why: 'a racer 8 tiles ahead', ascii: FLOOR, bo: { col: 15, row: 4 }, wanted: true },
    { why: 'a racer 9 tiles ahead, past its reach', ascii: FLOOR, bo: { col: 16, row: 4 }, wanted: false },
    { why: 'a racer ahead but in the air above its row', ascii: FLOOR, bo: { col: 12, row: 2 }, wanted: false },
    { why: 'a racer across a pit', ascii: PIT, bo: { col: 17, row: 4 }, wanted: false },
    { why: 'cracked stone ahead', ascii: STONE, bo: null, wanted: true },
    { why: 'nothing ahead', ascii: FLOOR, bo: null, wanted: false },
  ])('wants it with $why: $wanted', ({ ascii, bo, wanted }) => {
    expect(wants(ascii, bo)).toBe(wanted);
  });
});
