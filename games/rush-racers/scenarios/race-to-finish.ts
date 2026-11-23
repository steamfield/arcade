import { expect } from '@playwright/test';
import { HARD_SAVE, scenario, TITLE_TO_RACE, TOP_ROUTE } from './kit.ts';

export default scenario({
  description: 'swimming the top route over the pillar crosses the finish, ends the race and saves',
  start: { save: HARD_SAVE },
  input: [...TITLE_TO_RACE, ...TOP_ROUTE],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'finished', finished: true });
    expect(events.filter((e) => e.type === 'racer.finished').map((e) => e.id)).toContain('player');
    expect(events.filter((e) => e.type === 'race.finished')).toHaveLength(1);
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
