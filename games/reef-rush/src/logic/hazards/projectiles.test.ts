import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, raceOn, racerOf, tileCentre } from '../test-world.ts';
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
