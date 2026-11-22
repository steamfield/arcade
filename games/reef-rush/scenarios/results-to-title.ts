import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/** Reaches results the quick way (an idle DNF), waits out the arming ticks, then moves down to "Title" and picks it. */
export default scenario({
  description: 'choosing Title on the results screen shows a title with no race left over',
  start: { scene: 'race' },
  input: [wait(1930), tap('down'), tap('kick'), wait(5)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'title',
      best: null,
      menu: { options: ['Race', 'Sound', 'Motion'], selected: 0 },
    });
    expect(summary).not.toHaveProperty('phase');
    expect(summary).not.toHaveProperty('player');
    expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Title' }]);
  },
});
