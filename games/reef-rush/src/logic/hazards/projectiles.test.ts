import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { updateProgress } from '../race/standings.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, placeOnTile, raceOn, racerOf, tileCentre } from '../test-world.ts';
import type { RacerId, World } from '../types.ts';
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

type Spots = Record<RacerId, [number, number]>;

/**
 * A seeking bubble of the player's at tile (10, 2) flying right, with racers on `spots`, after one
 * tick of flight. Returns its velocity: straight right means it found no target, up or down shows
 * which way its target lies.
 */
function seekOnce(spots: Spots, finished: RacerId[] = []) {
  const { world, advance } = setup();
  for (const [id, [tx, ty]] of Object.entries(spots) as [RacerId, [number, number]][]) {
    placeOnTile(racerOf(world, id), tx, ty);
  }
  updateProgress(world);
  for (const id of finished) racerOf(world, id).finished = { tick: 1, place: 1, overshoot: 0 };
  world.bubbles = [{ ...tileCentre(10, 2), vx: 150, vy: 0, ttl: 90, owner: 'player', seeking: true }];
  advance();
  const bubble = world.bubbles[0];
  return { vx: bubble?.vx, vy: bubble?.vy };
}

describe('seeking bubbles', () => {
  it('chase the racer nearest the bubble, not the one nearest their owner', () => {
    // Tess is 2.2 tiles from the bubble and 9.5 from the player; Squib 4.5 and 3.
    const turn = seekOnce({ player: [3, 4], tess: [12, 1], squib: [6, 4], bo: [2, 4] });

    expect(turn.vy).toBeLessThan(0);
  });

  it('fly straight past racers behind their owner or more than 8 tiles off', () => {
    const turn = seekOnce({ player: [10, 2], tess: [5, 1], squib: [19, 4], bo: [4, 4] });

    expect(turn).toEqual({ vx: 150, vy: 0 });
  });

  it('pick the earlier racer in RACER_IDS order between two equally near', () => {
    const turn = seekOnce({ player: [3, 2], tess: [12, 1], squib: [12, 3], bo: [2, 4] });

    expect(turn.vy).toBeLessThan(0);
  });

  it('never chase a racer that has finished', () => {
    const turn = seekOnce({ player: [3, 2], tess: [12, 1], squib: [2, 3], bo: [2, 4] }, ['tess']);

    expect(turn).toEqual({ vx: 150, vy: 0 });
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
