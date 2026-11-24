import { expect } from '@playwright/test';
import { hold, RUN_ON, scenario } from './kit.ts';

export default scenario({
  description: 'running into the Ravine without jumping falls in, then respawns on the near side',
  start: { query: { stage: 'before-pit' } },
  input: [hold('forward', RUN_ON)],
  expect({ events }) {
    const types = events.map((e) => e.type);
    expect(types).toContain('racer.fell');
    expect(types).toContain('racer.respawned');
    expect(types.indexOf('racer.fell')).toBeLessThan(types.indexOf('racer.respawned'));
  },
});
