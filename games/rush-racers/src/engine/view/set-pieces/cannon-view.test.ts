import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../logic/events.ts';
import { CANNON } from '../../../logic/setpieces/cannons.ts';
import { courseFromLevel, placeOnTile, racerOf, step } from '../../../logic/test-world.ts';
import type { CannonDef } from '../../../logic/types.ts';
import { createWorld } from '../../../logic/world.ts';
import { cannonLook } from './cannon-view.ts';

const SKY = `
  ####################
  #.2...............F#
  #.3...............F#
  #.4...............F#
  #.................F#
  #.1...............F#
  ####################
`;
const BARREL: CannonDef = { col: 5, row: 5, dir: [1, -1], speed: 400, flightTicks: 14 };

function race(barrel = BARREL, ascii = SKY) {
  const log = new EventLog<GameEvent>(1000);
  const course = courseFromLevel({ name: 'test', ascii, cannons: [barrel] }, 'flight');
  const world = createWorld(course, log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  return { world, log };
}

describe('cloud cannon art', () => {
  it('swells as the barrel holds, then puffs on launch and clears as the rider flies away', () => {
    const { world, log } = race();
    expect(cannonLook(world, 0, false)).toEqual({ swell: 1, puff: 0 });
    placeOnTile(racerOf(world, 'player'), BARREL.col, BARREL.row);
    step(world, log);
    const loaded = cannonLook(world, 0, false);
    step(world, log, CANNON.holdTicks - 1);
    const charged = cannonLook(world, 0, false);
    expect(loaded.swell).toBeGreaterThan(1);
    expect(charged.swell).toBeGreaterThan(loaded.swell);
    expect(charged.puff).toBe(0);

    step(world, log);
    expect(cannonLook(world, 0, false)).toEqual({ swell: 1, puff: 1 });
    step(world, log, 4);
    const flown = cannonLook(world, 0, false);
    expect(flown.puff).toBeGreaterThan(0);
    expect(flown.puff).toBeLessThan(1);
    step(world, log, 8);
    expect(cannonLook(world, 0, false).puff).toBe(0);
  });

  it('keeps the charge readable at a fixed size and drops the animated puff in reduced motion', () => {
    const { world, log } = race();
    placeOnTile(racerOf(world, 'player'), BARREL.col, BARREL.row);
    step(world, log);
    const loaded = cannonLook(world, 0, true);
    step(world, log, CANNON.holdTicks - 1);
    expect(cannonLook(world, 0, true)).toEqual(loaded);
    expect(loaded.swell).toBeGreaterThan(1);
    step(world, log);
    expect(cannonLook(world, 0, true)).toEqual({ swell: 1, puff: 0 });
  });

  it.each([
    { case: 'one-tick shot', speed: 400, flightTicks: 1, sky: SKY },
    {
      case: 'shot blocked on release',
      speed: 600,
      flightTicks: 14,
      sky: SKY.replace('#.1...............F#', '#.1...#...........F#'),
    },
  ])('puffs when a $case is already over on its launch tick', ({ speed, flightTicks, sky }) => {
    const { world, log } = race({ ...BARREL, dir: [1, 0], speed, flightTicks }, sky);
    placeOnTile(racerOf(world, 'player'), BARREL.col, BARREL.row);
    step(world, log, CANNON.holdTicks + 1);
    expect(world.cannonRides).toMatchObject([{ reload: CANNON.reloadTicks, flight: 0 }]);
    expect(cannonLook(world, 0, false).puff).toBe(1);
    step(world, log, 4);
    expect(cannonLook(world, 0, false).puff).toBeGreaterThan(0);
    step(world, log, 8);
    expect(cannonLook(world, 0, false).puff).toBe(0);
  });
});
