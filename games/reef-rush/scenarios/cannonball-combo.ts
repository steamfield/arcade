import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/**
 * On seed 12 the first clam, at (22, 6), rolls Jet Fins; the player swims back off it, waits out
 * its 240-tick close, and opens it again for Puffer (a roll never repeats a held kind). Then it
 * swims to column 33, drops to the coral gate on rows 10-11 (the body must clear the rock on row
 * 9) and bursts right: the inflated dash smashes through the gate. Tied to OCEAN_LEVEL, and to
 * Hard's clam rolls (Easy favours Jet Fins and Bubble Shield), so it races from a Hard save.
 */
export default scenario({
  description: 'a Jet Fins plus Puffer burst fires the cannonball combo and breaks the coral gate',
  start: { seed: 12, save: HARD_SAVE },
  input: [
    ...TITLE_TO_RACE,
    wait(180),
    hold('right', 300),
    hold('left', 40),
    wait(150),
    hold('right', 150),
    hold('down', 64),
    hold(['right', 'burst'], 1),
    hold('right', 60),
  ],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'burst.fired' && e.id === 'player')).toMatchObject([
      { kinds: ['jetFin', 'puffer'], combo: 'cannonball' },
    ]);
    // The gate is 5 columns by 2 rows; the dash clears all of it.
    expect(events.filter((e) => e.type === 'coral.broken' && e.by === 'player')).toHaveLength(10);
    expect(summary.stack).toEqual(['jetFin', 'puffer']);
  },
});
