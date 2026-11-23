import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { tileIndex } from '../level/query.ts';
import { swimNav } from '../media/swim/data.ts';
import { courseFromLevel } from '../test-world.ts';
import { createWorld, toAscii } from '../world.ts';
import { breakCoral } from './coral.ts';

/** Coral at (3,1) blocks the top lane; the other lanes stay open so every start can still finish. */
function setup() {
  const course = courseFromLevel({
    name: 'reef',
    ascii: `
      ########
      #1.C..F#
      #2....F#
      #3....F#
      #4....F#
      ########
    `,
  });
  const log = new EventLog<GameEvent>();
  return { world: createWorld(course, log, { seed: 1 }), log };
}

const steerAt = (world: ReturnType<typeof setup>['world'], x: number, y: number) =>
  swimNav(world.nav).steer[tileIndex(world.level, x, y)];

describe('breaking coral', () => {
  it('opens the tile to steering and announces it once', () => {
    const { world, log } = setup();
    const progressBefore = Float32Array.from(world.progress.distance);

    expect(steerAt(world, 3, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(breakCoral(world, 3, 1, 'tess')).toBe(true);

    expect(steerAt(world, 3, 1)).toBeCloseTo(3, 5);
    expect(steerAt(world, 1, 1)).toBeCloseTo(5, 5);
    expect(swimNav(world.nav).smash[tileIndex(world.level, 1, 1)]).toBeCloseTo(5, 5);
    expect(world.progress.distance).toEqual(progressBefore);
    expect(toAscii(world).split('\n')[1]).toBe('#@....F#');
    expect(log.all().filter((e) => e.type === 'coral.broken')).toMatchObject([
      { type: 'coral.broken', tx: 3, ty: 1, by: 'tess' },
    ]);
  });

  it.each([
    ['rock', 0, 0],
    ['open water', 2, 2],
    ['a tile off the map', 20, 1],
  ])('does nothing to %s', (_, tx, ty) => {
    const { world, log } = setup();
    const before = { broken: [...world.broken], nav: world.nav };

    expect(breakCoral(world, tx, ty, 'player')).toBe(false);
    expect({ broken: [...world.broken], nav: world.nav }).toEqual(before);
    expect(log.all().filter((e) => e.type === 'coral.broken')).toEqual([]);
  });

  it('does nothing to coral that is already broken', () => {
    const { world, log } = setup();
    breakCoral(world, 3, 1, 'bo');
    const nav = world.nav;

    expect(breakCoral(world, 3, 1, 'squib')).toBe(false);
    expect(world.nav).toBe(nav);
    expect(log.all().filter((e) => e.type === 'coral.broken')).toHaveLength(1);
  });
});
