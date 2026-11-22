import { expect } from '@playwright/test';
import { hold, scenario } from './kit.ts';

export default scenario({
  description: 'walking forward from the spawn collects the first orb and autosaves',
  input: [hold('forward', 50)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ orbs: '1/6', physics: 'ready' });
    expect(events.filter((e) => e.type === 'orb.collected')).toMatchObject([{ index: 0, total: 1 }]);
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
