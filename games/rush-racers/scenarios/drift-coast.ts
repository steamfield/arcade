import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** The player's body in `debugState().racers`, the one entry with this id. */
function playerBody(state: unknown): { vx: number } {
  const racers = (state as { racers: { id: string; body: { vx: number } }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

/**
 * On Drift Test, thrust right for 60 ticks from the starting gun, then let go for 60 more. Drift has
 * little drag, so the racer is still flying right at speed after a second with no input (it was
 * near 90 px/s when this was recorded, far above the 60 asserted).
 */
export default scenario({
  description: 'a drifting racer who lets go of thrust keeps coasting right at speed',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    // Lands the hold on the race's first tick (race.started is at tick 232).
    wait(180),
    hold('right', 60),
    wait(60),
  ],
  expect({ state }) {
    expect(Math.round(playerBody(state).vx)).toBeGreaterThan(60);
  },
});
