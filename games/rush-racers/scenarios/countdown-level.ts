import { expect } from '@playwright/test';
import { HARD_SAVE, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/** A save on Hard races on Hard, and the countdown names the level with all three pips, which the race then drops. */
export default scenario({
  description: 'the countdown shows the level the race was built on, and the banner is gone once it starts',
  start: { save: HARD_SAVE },
  input: [...TITLE_TO_RACE, wait(10)],
  expect({ summary }) {
    expect(summary).toMatchObject({
      scene: 'race',
      phase: 'countdown',
      raceDifficulty: 'hard',
      levelBanner: { text: 'HARD', pips: 3 },
    });
  },
});
