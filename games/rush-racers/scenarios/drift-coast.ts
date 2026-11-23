import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** The player's body in `debugState().racers`, the one entry with this id. */
function playerBody(state: unknown): { x: number; vx: number } {
  const racers = (state as { racers: { id: string; body: { x: number; vx: number } }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

/**
 * On Drift Test, thrust right for 60 ticks from the starting gun, then let go for 60 more. Drift has
 * little drag, so the racer keeps flying: at the hold's end it had covered about 80 px (x 138 from
 * a start near x 58), and the coast alone carries it a further 99 px, more than the thrust did.
 */
export default scenario({
  description: 'a drifting racer who lets go of thrust keeps coasting right, further than the thrust took it',
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
    const body = playerBody(state);
    expect(Math.round(body.vx)).toBeGreaterThan(60);
    // 138 + 80: past the hold's end by more than the hold itself covered.
    expect(Math.round(body.x)).toBeGreaterThan(218);
  },
});
