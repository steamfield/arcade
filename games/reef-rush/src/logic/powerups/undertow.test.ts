import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { updateProgress } from '../race/standings.ts';
import { eventsIn, hold, IDLE, placeOnTile, raceOn, racerOf, step } from '../test-world.ts';
import type { RacerId } from '../types.ts';
import { fireBurst } from './burst.ts';
import { applyUndertow } from './undertow.ts';

/** A long open pool with the finish at the right end. */
const POOL = `
  ###############################
  #1............................#
  #2............................#
  #3............................#
  #4...........................F#
  ###############################
`;

const RIGHT = { x: 1, y: 0 };

type Spots = Partial<Record<RacerId, number>>;

/** A pool race with each racer in row 2 at its column in `spots`; the rest keep still and out of the way. */
function pool(spots: Spots) {
  const { world, log } = raceOn(POOL);
  for (const [id, column] of Object.entries(spots) as [RacerId, number][]) placeOnTile(racerOf(world, id), column, 2);
  for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
  updateProgress(world);
  return { world, log };
}

describe('firing an Undertow', () => {
  it('pulls every racer ahead of the user for 90 ticks, and nobody behind', () => {
    const { world, log } = pool({ player: 10, tess: 16, squib: 22, bo: 4 });
    racerOf(world, 'player').stack = ['undertow'];

    fireBurst(world, racerOf(world, 'player'), RIGHT);

    expect(eventsIn(log, 'undertow.fired')).toEqual([
      { type: 'undertow.fired', id: 'player', pulled: ['tess', 'squib'] },
    ]);
    expect(world.racers.map((racer) => [racer.id, racer.status.undertow])).toEqual([
      ['player', 0],
      ['tess', 90],
      ['squib', 90],
      ['bo', 0],
    ]);
  });

  it('is used up: it leaves the stack with powerup.lost cause used, and the rest stays', () => {
    const { world, log } = pool({ player: 10, tess: 16 });
    const player = racerOf(world, 'player');
    player.stack = ['jetFin', 'undertow'];

    fireBurst(world, player, RIGHT);

    expect(player.stack).toEqual(['jetFin']);
    expect(eventsIn(log, 'burst.fired')).toEqual([
      { type: 'burst.fired', id: 'player', kinds: ['jetFin', 'undertow'], combo: null },
    ]);
    expect(eventsIn(log, 'powerup.lost')).toEqual([
      { type: 'powerup.lost', id: 'player', kind: 'undertow', cause: 'used' },
    ]);
  });

  it('is used up with nobody to pull, when the user leads', () => {
    const { world, log } = pool({ player: 20, tess: 10, squib: 8, bo: 6 });
    const player = racerOf(world, 'player');
    player.stack = ['undertow'];

    fireBurst(world, player, RIGHT);

    expect(eventsIn(log, 'undertow.fired')).toEqual([{ type: 'undertow.fired', id: 'player', pulled: [] }]);
    expect(player.stack).toEqual([]);
  });

  it('leaves racers who have finished alone', () => {
    const { world, log } = pool({ player: 10, tess: 16, squib: 22 });
    racerOf(world, 'squib').finished = { tick: 1, place: 1, overshoot: 0 };
    racerOf(world, 'player').stack = ['undertow'];

    fireBurst(world, racerOf(world, 'player'), RIGHT);

    expect(eventsIn(log, 'undertow.fired')).toEqual([{ type: 'undertow.fired', id: 'player', pulled: ['tess'] }]);
  });
});

describe('being pulled', () => {
  it('drags a swimming racer back along the course, so it covers less ground than one left alone', () => {
    const run = (fire: boolean) => {
      const { world, log } = pool({ player: 6, tess: 14 });
      const tess = racerOf(world, 'tess');
      tess.status.stunned = 0;
      const player = racerOf(world, 'player');
      if (fire) {
        player.stack = ['undertow'];
        fireBurst(world, player, RIGHT);
      }
      step(world, log, 80, IDLE);
      return tess.body.x;
    };

    expect(run(false) - run(true)).toBeGreaterThan(40);
  });

  it('pulls harder the further ahead the racer was, up to 3 times the base', () => {
    const pullOf = (gapTiles: number) => {
      const { world } = pool({ player: 10, tess: 16 });
      const tess = racerOf(world, 'tess');
      tess.status.undertow = 30;
      tess.undertowGapTiles = gapTiles;
      tess.body.vx = 0;
      applyUndertow(world, tess, TICK_DT);
      return -tess.body.vx / TICK_DT;
    };

    expect(pullOf(0)).toBeCloseTo(120, 6);
    expect(pullOf(10)).toBeCloseTo(180, 6);
    expect(pullOf(20)).toBeCloseTo(240, 6);
    expect(pullOf(1000)).toBeCloseTo(360, 6);
  });

  it('leaves a racer that is not pulled alone', () => {
    const { world } = pool({ player: 10, tess: 16 });
    const tess = racerOf(world, 'tess');
    tess.body.vx = 50;

    applyUndertow(world, tess, TICK_DT);

    expect(tess.body.vx).toBe(50);
  });

  it('is cut by a kick: that tick it is not pulled, and 20 ticks come off the rest', () => {
    const kicked = pool({ player: 20, tess: 10 });
    const idle = pool({ player: 20, tess: 10 });
    for (const { world } of [kicked, idle]) {
      const player = racerOf(world, 'player');
      player.status.undertow = 90;
      player.undertowGapTiles = 12;
    }

    step(kicked.world, kicked.log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    step(idle.world, idle.log, 1, IDLE);

    expect(racerOf(idle.world, 'player').status.undertow).toBe(89);
    expect(racerOf(kicked.world, 'player').status.undertow).toBe(69);
    // Without the cut the pull would have left the kicked racer slower than the idle one's start.
    expect(racerOf(kicked.world, 'player').body.vx).toBeGreaterThan(racerOf(idle.world, 'player').body.vx);
  });
});
