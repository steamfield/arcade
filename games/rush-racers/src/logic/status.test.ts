import { describe, expect, it } from 'vitest';
import { isDowned, tickStatuses } from './status.ts';
import { eventsIn, giveItems, hold, raceOn, racerOf, step } from './test-world.ts';
import type { RacerStatus } from './types.ts';

const OPEN = `
  ########
  #1....F#
  #2....F#
  #3....F#
  #4....F#
  ########
`;

describe('downed racers', () => {
  it.each([
    ['stunned', true],
    ['trapped', true],
    ['latched', true],
    ['fallen', true],
    ['invulnerable', false],
    ['slowed', false],
    ['inflated', false],
  ] as const satisfies readonly [keyof RacerStatus, boolean][])('%s counts as downed: %s', (status, downed) => {
    const { world } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    expect(isDowned(player)).toBe(false);

    player.status[status] = 1;

    expect(isDowned(player)).toBe(downed);
  });
});

describe('a fallen racer', () => {
  it('ignores held movement, kicks, item use and cycling for the tick', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    giveItems(player, ['jetFin', 'puffer']);
    player.status.fallen = 30;

    step(world, log, 1, hold({ x: 1, y: 0 }, { kick: true, use: true, cycle: 1 }));

    expect(player.body.vx).toBe(0);
    expect(player.selected).toBe(0);
    expect(eventsIn(log, 'racer.kicked', 'item.used', 'item.selected')).toEqual([]);
  });

  it('keeps its fallen count through the tick, since the medium counts it down', () => {
    const { world, log } = raceOn(OPEN);
    const player = racerOf(world, 'player');
    player.status.fallen = 30;
    player.status.stunned = 30;

    step(world, log, 1);
    tickStatuses(player);

    expect(player.status).toMatchObject({ fallen: 30, stunned: 28 });
  });
});
