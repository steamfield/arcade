/**
 * A runner opens a `?` crate on Run Test by jumping into it from below, the only way a crate opens
 * on foot (in the run medium a shut crate is solid).
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Run Test's only crate: column 24, row 6, one open tile above the one-tile block at row 8. */
const CRATE_INDEX = 0;
const TILE_ON_BLOCK_UNDER_CRATE = [24, 7];

/**
 * Run right, hop the cracked-stone block at column 15, run on and hop onto the block at column 24,
 * stop, step under the crate, then jump straight up: the runner's head bumps the crate's underside,
 * which opens it for the runner, and the runner drops back onto the block.
 */
export default scenario({
  description: 'jumping into a crate from below opens it for the runner under it',
  // Hard gives the player no catch-up boost, so the timing below doesn't depend on where the rivals are.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'run-test' } },
  input: [
    // Run Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 130),
    hold(['right', 'up'], 20),
    hold('right', 65),
    hold(['right', 'up'], 3),
    wait(20),
    hold('right', 5),
    wait(15),
    hold('up', 10),
    wait(30),
  ],
  expect({ events, summary }) {
    const jumps = events.filter((e) => e.type === 'racer.jumped' && e.id === 'player');
    const opened = events.filter((e) => e.type === 'clam.opened');
    expect(opened).toMatchObject([{ id: 'player', index: CRATE_INDEX }]);
    // The crate opens on the rise of the last jump, not on a landing or a touch from the side.
    expect(opened[0]?.tick).toBe((jumps.at(-1)?.tick ?? 0) + 1);
    expect(events.filter((e) => e.type === 'powerup.gained' && e.id === 'player')).toHaveLength(1);
    // Back on the block, still under the crate.
    expect(summary).toMatchObject({ scene: 'race', player: { tile: TILE_ON_BLOCK_UNDER_CRATE } });
  },
});
