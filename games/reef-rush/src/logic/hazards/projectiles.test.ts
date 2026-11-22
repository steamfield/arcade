import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { updateProgress } from '../race/standings.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, placeOnTile, raceOn, racerOf, tileCentre } from '../test-world.ts';
import type { World } from '../types.ts';
import { advanceProjectiles } from './projectiles.ts';

/** A long open row (row 2) for bubbles to fly along, clear of the starts in column 1. */
const RANGE = `
  ######################
  #1..................F#
  #2..................F#
  #3..................F#
  #4..................F#
  ######################
`;

function setup() {
  const { world, log } = raceOn(RANGE);
  const advance = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) advanceProjectiles(world, activeRacers(world), TICK_DT);
  };
  return { world, log, advance };
}

function inkOn(world: World, at: { x: number; y: number }) {
  world.inks = [{ ...at, radius: 16, ttl: 240, owner: 'player' }];
}

describe('bubbles in flight', () => {
  it('travel at their velocity and pop after 90 ticks', () => {
    const { world, log, advance } = setup();
    const start = tileCentre(3, 2);
    world.bubbles = [{ ...start, vx: 150, vy: 0, ttl: 90, owner: 'player', seeking: false }];

    advance();
    expect(world.bubbles[0]?.x).toBeCloseTo(start.x + 2.5, 6);
    advance(88);
    expect(world.bubbles).toHaveLength(1);
    advance();

    expect(world.bubbles).toEqual([]);
    expect(eventsIn(log)).toEqual([{ type: 'bubble.popped', by: null }]);
  });

  it('pop on reaching rock', () => {
    const { world, log, advance } = setup();
    world.bubbles = [{ ...tileCentre(3, 2), vx: 0, vy: -150, ttl: 90, owner: 'player', seeking: false }];

    advance(20);

    expect(world.bubbles).toEqual([]);
    expect(eventsIn(log)).toEqual([{ type: 'bubble.popped', by: null }]);
  });
});

/** Like RANGE, with a jelly at tile (10, 2) and another at (10, 4) two tiles below the bubble's row. */
const JELLY_RANGE = `
  ######################
  #1..................F#
  #2.......j..........F#
  #3..................F#
  #4.......j..........F#
  ######################
`;

describe('lantern bubbles', () => {
  /** A bubble of the player's at tile (3, 2) flying right, `seeking` (lantern) or plain. */
  function bubbleOver(ascii: string, seeking: boolean) {
    const { world, log } = raceOn(ascii);
    world.bubbles = [{ ...tileCentre(3, 2), vx: 150, vy: 0, ttl: 90, owner: 'player', seeking }];
    const advance = (ticks = 1) => {
      for (let i = 0; i < ticks; i++) advanceProjectiles(world, activeRacers(world), TICK_DT);
    };
    return { world, log, advance };
  }

  it('fly straight on, turning for no racer ahead', () => {
    const { world, advance } = bubbleOver(RANGE, true);
    placeOnTile(racerOf(world, 'tess'), 12, 4);
    updateProgress(world);

    advance(20);

    expect(world.bubbles[0]).toMatchObject({ vx: 150, vy: 0 });
  });

  it('stun a jelly they pass within 1.5 tiles for 45 ticks, and no other', () => {
    const { world, advance } = bubbleOver(JELLY_RANGE, true);
    const [near, far] = world.jellies;

    advance(24);
    expect(near?.stunned).toBe(0);
    advance(7);

    expect(near?.stunned).toBe(45);
    expect(far?.stunned).toBe(0);
  });

  it('leave jellies alone when the bubble is not a lantern bubble', () => {
    const { world, advance } = bubbleOver(JELLY_RANGE, false);

    advance(40);

    expect(world.jellies.map((jelly) => jelly.stunned)).toEqual([0, 0]);
  });
});

describe('ink clouds', () => {
  it('slow another racer inside for 90 ticks, refreshed while it stays', () => {
    const { world, advance } = setup();
    const tess = racerOf(world, 'tess');
    inkOn(world, centreOf(tess));

    advance();
    expect(tess.status.slowed).toBe(90);
    tess.status.slowed = 10;
    advance();
    expect(tess.status.slowed).toBe(90);
  });

  it('never slow their owner', () => {
    const { world, advance } = setup();
    const player = racerOf(world, 'player');
    inkOn(world, centreOf(player));

    advance(5);

    expect(player.status.slowed).toBe(0);
  });

  it('leave racers outside the cloud alone', () => {
    const { world, advance } = setup();
    const tess = racerOf(world, 'tess');
    inkOn(world, { x: centreOf(tess).x + 20, y: centreOf(tess).y });

    advance();

    expect(tess.status.slowed).toBe(0);
  });

  it('fade after 240 ticks', () => {
    const { world, advance } = setup();
    inkOn(world, tileCentre(12, 3));

    advance(239);
    expect(world.inks).toHaveLength(1);
    advance();
    expect(world.inks).toEqual([]);
  });
});
