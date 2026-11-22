import { expect } from '@playwright/test';
import save from '../tests/fixtures/save-v1.json' with { type: 'json' };
import { scenario, wait } from './kit.ts';

export default scenario({
  description: 'a saved game resumes with the same field and collected orbs',
  start: { save },
  input: [wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({ orbs: '2/6' });
  },
});
