/**
 * A flyer on Sky Test who skims the floor into the gap under the overhang (columns 61-65) falls out
 * of the bottom of the sky and comes back a second later on the last safe stretch before the gap.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Left edge of Sky Test's floor gap (column 61), in px. */
const GAP_LEFT = 61 * 16;

/** Ticks a fallen flyer waits before it respawns (`FLIGHT_TUNING.extra.respawnTicks`). */
const RESPAWN_TICKS = 60;

/**
 * The `cannonball` stage puts the player in the low tunnel three tiles before its puff cloud plug
 * (the Cannonball it hands over is never fired). From GO the player holds right, dashes through
 * the plug, and keeps holding right along the floor without a flap: gravity takes it down the gap
 * past the tunnel's end. It falls out once and respawns once, 60 ticks later, short of the gap.
 */
export default scenario({
  description: 'a flyer who falls out of the bottom of the sky respawns a second later before the gap',
  // Hard gives the player no catch-up boost, so the run along the floor is the medium's own speed.
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
    hold('right', 120),
    wait(60),
  ],
  expect({ events }) {
    const falls = events.filter((e) => e.type === 'racer.fell' && e.id === 'player');
    const respawns = events.filter((e) => e.type === 'racer.respawned' && e.id === 'player');
    expect(falls).toHaveLength(1);
    expect(respawns).toHaveLength(1);
    expect((respawns[0]?.tick ?? 0) - (falls[0]?.tick ?? 0)).toBe(RESPAWN_TICKS);
    expect(Number(respawns[0]?.x), 'back on the floor before the gap').toBeLessThan(GAP_LEFT);
  },
});
