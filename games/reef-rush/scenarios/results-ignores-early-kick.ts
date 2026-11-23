import { expect } from '@playwright/test';
import { HARD_SAVE, scenario, TITLE_TO_RACE, TOP_ROUTE, tap, wait } from './kit.ts';

/**
 * The results screen comes up about 60 ticks after TOP_ROUTE ends. A fire press a few ticks
 * later, as a player still mashing it from the race would press it, must not pick a
 * menu option before the results have been seen.
 */
export default scenario({
  description: 'a fire press in the first moments of the results screen is ignored',
  start: { save: HARD_SAVE },
  input: [...TITLE_TO_RACE, ...TOP_ROUTE, wait(64), tap('fire'), wait(3)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'results',
      menu: { options: ['Race again', 'Character', 'Title'], selected: 0 },
    });
    // The title and select presses before the race are menu picks too; only the results screen counts.
    const finished = events.find((e) => e.type === 'race.finished')?.tick ?? 0;
    expect(events.filter((e) => e.tick >= finished).map((e) => e.type)).not.toContain('menu.selected');
  },
});
