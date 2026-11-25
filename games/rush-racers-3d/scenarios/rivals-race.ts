import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

type Racers = { world: { racers: { id: string; s: number; state: string }[] } };

export default scenario({
  description: 'three rivals run the trail beside the player for the first ten seconds, and the player has a place',
  start: { scene: 'race', seed: 3 },
  input: [wait(180), hold('forward', 600)],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'racing' });
    expect([1, 2, 3, 4]).toContain(summary.place);
    const rivals = (state as Racers).world.racers.slice(1);
    for (const rival of rivals) expect(rival.s).toBeGreaterThan(100);
    expect(events.filter((e) => e.type === 'racer.fell' && e.id !== 'player')).toEqual([]);
  },
});
