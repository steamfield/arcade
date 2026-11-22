import { expect } from '@playwright/test';
import { scenario, wait } from './kit.ts';

/**
 * The race ends DNF_GRACE_TICKS (600) after the third rival finishes and results follow 90 ticks
 * later. With nobody to catch, the rivals ease right off (catch-up), so on seed 1 that puts results
 * at about tick 14700; waiting to 15000 leaves room for the rivals' order and times to shift as
 * tuning changes.
 */
export default scenario({
  description: 'a player who never swims is placed last as DNF on the results screen, and no best is saved',
  start: { scene: 'race' },
  input: [wait(15000)],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({
      scene: 'results',
      finished: false,
      place: '4/4',
      result: { place: 4, ticks: null, newBest: false, saveFailed: false },
    });
    // Any rival order, but all four placed with the player last.
    const rival = expect.any(String);
    expect(events.filter((e) => e.type === 'race.finished')).toMatchObject([
      { standings: [rival, rival, rival, 'player'], playerPlace: 4, playerTicks: null },
    ]);
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(1);
    expect(state).toMatchObject({ save: { best: null, races: 1 } });
  },
});
