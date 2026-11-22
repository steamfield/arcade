import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/** The first clam sits on the start row at tile (22, 6), so the player just swims right into it. */
export default scenario({
  description: 'swimming into a clam opens it and puts its power-up on the player stack shown in the summary',
  start: { scene: 'race' },
  input: [wait(180), hold('right', 330), wait(30)],
  expect({ summary, events }) {
    const opened = events.filter((e) => e.type === 'clam.opened' && e.id === 'player');
    expect(opened).toHaveLength(1);
    const gained = events.filter((e) => e.type === 'powerup.gained' && e.id === 'player').map((e) => e.kind);
    expect(gained).toEqual([opened[0]?.kind]);
    expect(summary.stack).toEqual(gained);
  },
});
