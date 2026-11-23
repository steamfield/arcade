import { describe, expect, it } from 'vitest';
import { isDowned } from './status.ts';
import { raceOn, racerOf } from './test-world.ts';
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
