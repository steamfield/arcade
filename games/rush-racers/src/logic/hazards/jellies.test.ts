import { describe, expect, it } from 'vitest';
import { raceOn, step, tileCentre } from '../test-world.ts';
import type { Jelly } from '../types.ts';
import { jellyCentre, moveJellies } from './jellies.ts';

/** One jelly at tile (6, 3), clear of every racer. */
const POOL = `
  ##############
  #1..........F#
  #2..........F#
  #3....j.....F#
  #4..........F#
  #...........F#
  ##############
`;

const HOME = tileCentre(6, 3);

function jellyAt(phase: number): Jelly {
  return { home: { x: 6, y: 3 }, phase, stunned: 0 };
}

describe('bobbing', () => {
  it('rises one tile, sinks one tile below home and returns over 180 ticks', () => {
    const heights = [0, 45, 90, 135, 180].map((phase) => jellyCentre(jellyAt(phase)).y - HOME.y);

    expect(heights.map((dy) => Math.round(dy * 1000) / 1000)).toEqual([0, -16, 0, 16, 0]);
    expect(jellyCentre(jellyAt(45)).x).toBe(HOME.x);
  });

  it('moves one tick along its cycle per tick', () => {
    const { world } = raceOn(POOL);

    for (let i = 0; i < 45; i++) moveJellies(world);

    expect(jellyCentre(world.jellies[0] as Jelly).y).toBeCloseTo(HOME.y - 16, 6);
    expect(world.jellies[0]?.phase).toBe(45);
  });

  it('bobs the same whatever the seed', () => {
    const positions = (seed: number) => {
      const { world, log } = raceOn(POOL, { seed });
      step(world, log, 100);
      return world.jellies.map(jellyCentre);
    };

    expect(positions(1)).toEqual(positions(2));
    expect(positions(1)).not.toEqual([HOME]);
  });
});

describe('a stunned jelly', () => {
  it('stays put until its stun runs out, then bobs on', () => {
    const { world, log } = raceOn(POOL);
    const jelly = world.jellies[0] as Jelly;
    jelly.stunned = 10;
    const before = jellyCentre(jelly);

    step(world, log, 10);
    expect(jellyCentre(jelly)).toEqual(before);
    expect(jelly.stunned).toBe(0);

    step(world, log, 1);
    expect(jellyCentre(jelly)).not.toEqual(before);
  });
});
