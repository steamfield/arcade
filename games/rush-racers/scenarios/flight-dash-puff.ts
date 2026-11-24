/**
 * A flyer on Sky Test pops the puff cloud plugging the low tunnel (column 46) with a dash: pushing
 * into it does nothing, and the dash breaks it.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Sky Test's puff cloud plug, column 46, rows 19-22. */
const PUFF_COLUMN = 46;

/**
 * The `cannonball` stage puts the player three tiles before the course's first puff cloud, the
 * tunnel's plug, facing it (it also hands over a Cannonball, which this scenario never fires). From
 * GO the player holds right for 40 ticks, flying into the cloud and pressing against it, then dashes
 * while still holding right: the dash pops the cloud tile it hits, and none breaks before it.
 */
export default scenario({
  description: 'a dash pops a puff cloud that pushing into it does not',
  // Hard gives the player no catch-up boost, so the run-up is the medium's own speed.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test', stage: 'cannonball' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 40),
    hold(['right', 'dash'], 1),
    hold('right', 20),
  ],
  expect({ events }) {
    const dashes = events.filter((e) => e.type === 'racer.kicked' && e.id === 'player');
    const pops = events.filter((e) => e.type === 'coral.broken' && e.by === 'player');
    expect(dashes).toHaveLength(1);
    expect(pops.length, 'the dash pops at least one tile of the plug').toBeGreaterThan(0);
    expect(pops.every((pop) => pop.tx === PUFF_COLUMN)).toBe(true);
    expect(pops[0]?.tick ?? 0, 'nothing pops before the dash').toBeGreaterThanOrEqual(dashes[0]?.tick ?? Infinity);
    expect(events.filter((e) => e.type === 'coral.broken' && e.by !== 'player')).toEqual([]);
  },
});
