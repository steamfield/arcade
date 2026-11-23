import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/** Easy, so the timing below is the player's Easy run on foot; pinned so a new default can't move it. */
const EASY_SAVE = {
  ...HARD_SAVE,
  data: { ...HARD_SAVE.data, settings: { ...HARD_SAVE.data.settings, difficulty: 'easy' } },
};

/**
 * On Run Test, run right into the cracked-stone block, hop it, run on to the block under the crate,
 * then take a held jump over it: it carries the runner into the three-tile pit beyond. The runner
 * falls out of the level, waits a second while parked (its sprite hidden), and comes back on the
 * last solid ground it stood on, short of the pit.
 */
export default scenario({
  description: 'a runner who falls into a pit comes back a second later on the last safe ground',
  start: { save: EASY_SAVE, seed: 1, query: { course: 'run-test' } },
  input: [
    ...TITLE_TO_RACE,
    wait(200),
    hold('right', 130),
    hold(['right', 'up'], 20),
    hold('right', 80),
    hold(['right', 'up'], 30),
    hold('right', 30),
    wait(90),
  ],
  expect({ events }) {
    const falls = events.filter((e) => e.type === 'racer.fell' && e.id === 'player');
    const respawns = events.filter((e) => e.type === 'racer.respawned' && e.id === 'player');
    expect(falls).toHaveLength(1);
    expect(respawns).toHaveLength(1);
    const [fell] = falls;
    const [respawned] = respawns;
    expect(respawned.tick - fell.tick).toBe(60);
    // The pit spans columns 29-31 (x 464-512); the runner comes back before it.
    expect(respawned).toMatchObject({ type: 'racer.respawned', id: 'player' });
    expect((respawned as { x: number }).x).toBeLessThan(464);
  },
});
