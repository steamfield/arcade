import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Swims the first section's top route without kicks: along row 4 over the pillar,
 * down past it, along the dive floor, through the arch and up to the finish.
 * The route is tied to OCEAN_LEVEL; reshaping the course means re-recording it.
 */
export default scenario({
  description: 'swimming the top route over the pillar crosses the finish, ends the race and saves',
  start: { scene: 'play' },
  input: [
    wait(180),
    hold(['right', 'up'], 40),
    hold('right', 480),
    hold('down', 120),
    hold('right', 300),
    hold(['right', 'up'], 40),
    hold('right', 520),
  ],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'play', phase: 'finished', finished: true });
    expect(events.filter((e) => e.type === 'racer.finished').map((e) => e.id)).toContain('player');
    expect(events.filter((e) => e.type === 'race.finished')).toHaveLength(1);
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
