import { expect } from '@playwright/test';
import save from '../tests/fixtures/save-v5.json' with { type: 'json' };
import { scenario, tap, wait } from './kit.ts';

/**
 * The v5 fixture is on Hard with a best of 0:44.16 (1st) there and 0:51.66 (3rd) on Easy. Level is three
 * rows below Race and cycles Hard to Easy in one press, and the best on show follows it.
 */
export default scenario({
  description: 'the title shows the best for the selected level and changes it when Level cycles',
  start: { save },
  input: [wait(25), tap('down'), wait(2), tap('down'), wait(2), tap('down'), wait(2), tap('fire'), wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({ scene: 'title', difficulty: 'easy', best: 'Best 0:51.66 (3rd)' });
  },
});
