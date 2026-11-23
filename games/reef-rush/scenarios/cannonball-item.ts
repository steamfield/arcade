import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * The `cannonball` stage holds a Cannonball three tiles before the reef's coral gate (5 columns by
 * 2 rows, under the pillar), level with its middle. After the countdown, fire with right held: the
 * Cannonball dashes through the whole gate, inflated, and is used up.
 */
export default scenario({
  description: 'firing a Cannonball dashes through the coral gate and uses the item up',
  start: { scene: 'race', seed: 1, query: { stage: 'cannonball' } },
  input: [wait(180), hold(['right', 'fire'], 1), hold('right', 60)],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([
      { kind: 'cannonball', slot: 0, chargesLeft: 0 },
    ]);
    expect(events.filter((e) => e.type === 'coral.broken' && e.by === 'player')).toHaveLength(10);
    expect(summary).toMatchObject({ items: [null, null, null] });
  },
});
