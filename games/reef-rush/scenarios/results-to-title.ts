import { expect } from '@playwright/test';
import { IDLE_TO_RESULTS, scenario, tap, wait } from './kit.ts';

/** Reaches results the quick way (an idle DNF), waits out the arming ticks, then moves down twice to "Title" and picks it. */
export default scenario({
  description: 'choosing Title on the results screen shows a title with no race left over',
  start: { scene: 'race' },
  input: [wait(IDLE_TO_RESULTS), tap('down'), wait(2), tap('down'), tap('fire'), wait(5)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'title',
      best: null,
      menu: { options: ['Race', 'How to play', 'Difficulty', 'Sound', 'Motion'], selected: 0 },
    });
    expect(summary).not.toHaveProperty('phase');
    expect(summary).not.toHaveProperty('player');
    expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Title' }]);
  },
});
