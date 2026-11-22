import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Needs the player to start holding Jet Fins then Puffer. Scenarios can't set that yet: the
 * launch param `?stack=jetFin,puffer` (and a way for `start` to carry it) is pending from the
 * orchestrator. Route: drop to row 9 and ride the current tunnel to tile 30, drift down to row 10
 * and burst at the coral gate on rows 10-11 (cols 34-38).
 */
export default scenario({
  description: 'a Jet Fins plus Puffer burst fires the cannonball combo and breaks the coral gate',
  start: { scene: 'race', seed: 1 },
  input: [
    wait(180),
    hold('down', 50),
    hold('right', 360),
    hold(['right', 'down'], 20),
    hold(['right', 'burst'], 1),
    hold('right', 90),
  ],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'burst.fired' && e.id === 'player')).toMatchObject([
      { kinds: ['jetFin', 'puffer'], combo: 'cannonball' },
    ]);
    expect(events.filter((e) => e.type === 'coral.broken' && e.by === 'player').length).toBeGreaterThan(0);
    expect(summary.stack).toEqual(['jetFin', 'puffer']);
  },
});
