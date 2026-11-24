import { expect } from '@playwright/test';
import { hold, RUN_ON, scenario } from './kit.ts';

export default scenario({
  description:
    'running from 30 m out crosses the finish line, ends the race and shows results, without saving a staged run',
  start: { query: { stage: 'near-finish' } },
  input: [hold('forward', RUN_ON)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ phase: 'finished', scene: 'results', player: { state: 'finished' } });
    expect(events.filter((e) => e.type === 'racer.finished')).toHaveLength(1);
    expect(events.map((e) => e.type)).toContain('race.ended');
    expect(events.map((e) => e.type)).not.toContain('save.written');
  },
});
