import { expect } from '@playwright/test';
import { hold, scenario } from './kit.ts';

export default scenario({
  description: 'running right along the ground collects the first ground coin and autosaves',
  start: { scene: 'play' },
  input: [hold('right', 120)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'play', coins: '1/9', player: { grounded: true } });
    expect(events.filter((e) => e.type === 'coin.collected')).toMatchObject([{ index: 7, total: 1 }]);
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
