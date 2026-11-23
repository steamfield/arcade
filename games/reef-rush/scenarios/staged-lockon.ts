import { expect } from '@playwright/test';
import { scenario, wait } from './kit.ts';

// `start.query` reaches the launch URL, so a debug stage sets up a rare moment directly.
export default scenario({
  description: 'a race launched with ?stage=squid-lockon shows the lock-on warning state',
  start: { scene: 'race', query: { stage: 'squid-lockon' } },
  input: [wait(2)],
  expect({ summary }) {
    expect(summary).toMatchObject({ scene: 'race', threat: { lockedOn: true, latched: false } });
  },
});
