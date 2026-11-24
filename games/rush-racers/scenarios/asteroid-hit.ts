/**
 * A pilot on Drift Test blasts the shortcut's ice plug with a Comet, flies the tunnel and meets the
 * drifting asteroid that sweeps the lane past its exit (col 96, rows 2-8), which hits it.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Ticks of holding right after the shot: out of the tunnel, into the sweep and a little past it. */
const THROUGH_THE_TUNNEL = 140;

/**
 * The `cannonball` stage holds the player in the shortcut tunnel three tiles before its ice plug
 * (col 86, rows 5-6), level with the seam between the two ice tiles. From GO it fires the Comet
 * right, which breaks both tiles, then holds right through the tunnel. Coming out at col 93 it
 * meets the asteroid mid-sweep about 115 ticks in (its offset is set for this flight) and is hit
 * once, with no owner. With no asteroids on the course this fails.
 */
export default scenario({
  description: 'flying out of the tunnel into a drifting asteroid, the pilot is hit by it',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test', stage: 'cannonball' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold(['right', 'fire'], 1),
    hold('right', THROUGH_THE_TUNNEL),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'coral.broken' && e.by === 'player')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'racer.hit' && e.id === 'player')).toMatchObject([
      { cause: 'asteroid', by: null },
    ]);
  },
});
