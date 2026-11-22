import { expect } from '@playwright/test';
import { scenario, TOP_ROUTE, tap, wait } from './kit.ts';

/**
 * The results screen comes up about 60 ticks after TOP_ROUTE ends. A kick a few ticks
 * later, as a player still mashing kick from the race would press it, must not pick a
 * menu option before the results have been seen.
 */
export default scenario({
  description: 'a kick in the first moments of the results screen is ignored',
  start: { scene: 'race' },
  input: [...TOP_ROUTE, wait(64), tap('kick'), wait(3)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'results', menu: { options: ['Race again', 'Title'], selected: 0 } });
    expect(events.map((e) => e.type)).not.toContain('menu.selected');
  },
});
