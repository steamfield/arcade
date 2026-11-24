import { expect } from '@playwright/test';
import { hold, RUN_ON, scenario } from './kit.ts';

export default scenario({
  description: 'running into the first log without jumping stops the player at its face',
  start: { query: { stage: 'before-log' } },
  input: [hold('forward', RUN_ON)],
  expect({ summary, events }) {
    expect(events.map((e) => e.type)).toContain('racer.bumped');
    expect(summary).toMatchObject({ phase: 'racing', player: { state: 'racing' } });
  },
});
