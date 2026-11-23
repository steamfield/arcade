import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Drift Test's planet: tile (37, 11) centred, with a reach of 6 tiles, in px (16 px tiles). */
const PLANET = { x: 37.5 * 16, y: 11.5 * 16, reach: 6 * 16 };

/** A racer body is 12 by 10 px and its x, y are its top-left corner. */
const BODY_HALF = { x: 6, y: 5 };

/** The player's body in `debugState().racers`, the one entry with this id. */
function playerBody(state: unknown): { x: number; y: number } {
  const racers = (state as { racers: { id: string; body: { x: number; y: number } }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

/**
 * On Drift Test, fly the first straight to its end, then turn up into the bend, steering left once
 * the racer is in it. The planet in the rock inside the bend pulls the racer round the corner. The
 * script stops while the racer is high in the bend (row 7, above the straight's rows 14-21) and
 * still inside the planet's reach, since the end state is the only position a scenario can read.
 */
export default scenario({
  description: 'a racer flying the bend with the planet passes through its reach and does not fall',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    // Lands the hold on the race's first tick (race.started is at tick 232).
    wait(180),
    hold('right', 290),
    hold('up', 60),
    hold(['left', 'up'], 40),
  ],
  expect({ events, state }) {
    const body = playerBody(state);
    const x = body.x + BODY_HALF.x;
    const y = body.y + BODY_HALF.y;
    expect(Math.hypot(x - PLANET.x, y - PLANET.y)).toBeLessThan(PLANET.reach);
    // Out of the straight (rows 14-21) and up in the bend.
    expect(y).toBeLessThan(14 * 16);
    expect(events.filter((e) => e.type === 'racer.fell' && e.id === 'player')).toEqual([]);
  },
});
