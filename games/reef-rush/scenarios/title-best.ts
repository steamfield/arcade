import { expect } from '@playwright/test';
import save from '../tests/fixtures/save-v2.json' with { type: 'json' };
import { scenario, wait } from './kit.ts';

/** Loading a save while the title is already up restarts the title, which must stay running. */
export default scenario({
  description: 'a save with a best time shows that time and place on a running title screen',
  start: { save },
  input: [wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({
      scene: 'title',
      best: 'Best 0:45.20 (2nd)',
      menu: { options: ['Race', 'How to play', 'Difficulty', 'Sound', 'Motion'] },
    });
  },
});
