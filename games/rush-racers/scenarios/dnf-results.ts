import { expect } from '@playwright/test';
import { IDLE_TO_RESULTS, scenario, wait } from './kit.ts';

/**
 * The race ends DNF_GRACE_TICKS (600) after the third rival finishes, or at the race limit, and
 * results follow 90 ticks later; IDLE_TO_RESULTS waits past the latest that can happen.
 */
export default scenario({
  description: 'a player who never swims is placed last with TIME UP on the results screen, and no best is saved',
  start: { scene: 'race' },
  input: [wait(IDLE_TO_RESULTS)],
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
    expect(state).toMatchObject({ save: { lastCourse: 'sunlit-shallows', races: 1 } });
    expect((state as { save: { bests: unknown } }).save.bests, 'a DNF saves no best').toEqual({});
  },
});
