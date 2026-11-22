import { expect } from '@playwright/test';
import { scenario, wait } from './kit.ts';

/**
 * Rivals finish by about tick 1200 on seed 1 (Squib, stung by an urchin and a jelly on the way, comes
 * in third); the race ends 600 ticks later and results follow 90 after that.
 */
export default scenario({
  description: 'a player who never swims is placed last as DNF on the results screen, and no best is saved',
  start: { scene: 'race' },
  input: [wait(1900)],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({
      scene: 'results',
      finished: false,
      place: '4/4',
      result: { place: 4, ticks: null, newBest: false, saveFailed: false },
    });
    expect(events.filter((e) => e.type === 'race.finished')).toMatchObject([
      { standings: ['tess', 'bo', 'squib', 'player'], playerPlace: 4, playerTicks: null },
    ]);
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(1);
    expect(state).toMatchObject({ save: { best: null, races: 1 } });
  },
});
