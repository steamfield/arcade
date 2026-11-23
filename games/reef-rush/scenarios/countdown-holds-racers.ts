import { expect } from '@playwright/test';
import { hold, scenario } from './kit.ts';

export default scenario({
  description: 'nobody moves during the 3-2-1 countdown, and the race starts on tick 180',
  start: { scene: 'race' },
  input: [hold(['right', 'kick'], 170)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'countdown', player: { tile: [4, 6] } });
    expect(events.filter((e) => e.type === 'race.countdown').map((e) => e.n)).toEqual([3, 2, 1]);
    expect(events.map((e) => e.type)).not.toContain('racer.kicked');
  },
});
