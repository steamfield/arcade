import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Drift Test's black hole: tile (78, 2) centred, with a reach of 3 tiles, in px (16 px tiles). */
const HOLE = { x: 78.5 * 16, y: 2.5 * 16, reach: 3 * 16 };

/** A racer body is 12 by 10 px and its x, y are its top-left corner. */
const BODY_HALF = { x: 6, y: 5 };

/**
 * On Drift Test, fly the bend, then glide along the open row 7 of the top corridor (the hold at its
 * level, a three-tick nudge up keeping the body between the rocks above and below), and climb into
 * the open pocket over the shortcut's mouth where the black hole sits. Its horizon swallows the
 * racer, which waits out 60 ticks and comes back where it last flew outside the hole's reach.
 */
export default scenario({
  description: 'a racer who flies into the black hole is swallowed and comes back a second later outside its reach',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    // Lands the first hold on the race's first tick (race.started is at tick 232).
    wait(180),
    // Round the bend with the planet, as well-swing does, then level out on row 7.
    hold('right', 290),
    hold('up', 60),
    hold(['left', 'up'], 40),
    hold(['right', 'down'], 40),
    hold('right', 60),
    hold(['right', 'up'], 3),
    // Glide to the pocket past the last rock, then climb into the hole.
    hold('right', 190),
    hold('up', 40),
    wait(80),
  ],
  expect({ events }) {
    const falls = events.filter((e) => e.type === 'racer.fell' && e.id === 'player');
    const respawns = events.filter((e) => e.type === 'racer.respawned' && e.id === 'player');
    expect(falls).toHaveLength(1);
    expect(respawns).toHaveLength(1);
    expect((respawns[0]?.tick ?? 0) - (falls[0]?.tick ?? 0)).toBe(60);
    const x = Number(respawns[0]?.x) + BODY_HALF.x;
    const y = Number(respawns[0]?.y) + BODY_HALF.y;
    expect(Math.hypot(x - HOLE.x, y - HOLE.y)).toBeGreaterThan(HOLE.reach);
  },
});
