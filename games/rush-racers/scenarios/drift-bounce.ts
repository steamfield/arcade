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
 * On Drift Test, thrust right (leaning down for the first 40 ticks, to stay low on the straight) for
 * 360 ticks, then coast. The thrust ends well short of the wall at col 50, which the racer reaches
 * about 50 ticks later (tick 644), and the script ends about 50 ticks after that. It bounces once
 * and is flying back left when the input ends.
 */
export default scenario({
  description: 'a racer who flies into the wall at the end of the first straight bounces back off it',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    // Lands the hold on the race's first tick (race.started is at tick 232).
    wait(180),
    hold(['right', 'down'], 40),
    hold('right', 320),
    wait(100),
  ],
  expect({ events, state }) {
    const bounces = events.filter((e) => e.type === 'racer.bounced' && e.id === 'player');
    expect(bounces).toHaveLength(1);
    expect(bounces[0]?.axis).toBe('x');
    expect(Math.round(playerBody(state).vx)).toBeLessThan(-10);
  },
});
