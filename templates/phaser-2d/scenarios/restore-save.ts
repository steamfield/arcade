import { expect } from '@playwright/test';
import save from '../tests/fixtures/save-v1.json' with { type: 'json' };
import { scenario, wait } from './kit.ts';

export default scenario({
  description: 'a saved game resumes with its collected coins',
  start: { save },
  input: [wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({ scene: 'play', coins: '2/9' });
  },
});
