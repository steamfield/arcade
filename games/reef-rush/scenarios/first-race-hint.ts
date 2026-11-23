import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Seed 1's first clam sits on the start row, so swimming right picks a power-up up (the same run as
 * `clam-stack`). A fresh save is on its first race, so the hints are on: once an item is held
 * that the player has not fired, the summary says PRESS FIRE is showing.
 */
export default scenario({
  description: 'the first race shows the PRESS FIRE hint when a clam hands the player an item',
  start: { scene: 'race', seed: 1 },
  input: [wait(180), hold('right', 330), wait(30)],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'powerup.gained' && e.id === 'player')).toHaveLength(1);
    expect(summary).toMatchObject({
      difficulty: 'easy',
      hints: { pressFire: true, kick: false, pulseItems: false },
    });
  },
});
