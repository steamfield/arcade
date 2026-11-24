/**
 * Thornwood's Cannonball is the Boulder: fired on Run Test, it rolls along the floor ahead of the
 * runner and breaks the cracked stone block at col 15, ending there.
 */
import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * The `cannonball` stage holds a Cannonball three tiles before Run Test's first cracked stone (the
 * one-tile block at col 15 on the floor), facing it. After the countdown, fire once and stand still:
 * the boulder rolls right, breaks the block and ends against it, and the item is used up.
 */
export default scenario({
  description: 'the Boulder rolls along the floor and breaks the cracked stone it reaches',
  start: { scene: 'race', seed: 1, query: { course: 'run-test', stage: 'cannonball' } },
  input: [wait(180), hold('fire', 1), wait(40)],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([
      { kind: 'cannonball', slot: 0, chargesLeft: 0 },
    ]);
    expect(events.filter((e) => e.type === 'shot.launched')).toEqual([
      expect.objectContaining({ owner: 'player', style: 'boulder', target: null }),
    ]);
    expect(events.filter((e) => e.type === 'coral.broken')).toEqual([
      expect.objectContaining({ tx: 15, ty: 8, by: 'player' }),
    ]);
    expect(events.filter((e) => e.type === 'shot.ended')).toEqual([
      expect.objectContaining({ owner: 'player', style: 'boulder' }),
    ]);
    expect(summary).toMatchObject({ items: [null, null, null] });
  },
});
