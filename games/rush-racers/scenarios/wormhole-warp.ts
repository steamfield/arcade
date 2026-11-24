import { expect } from '@playwright/test';
import { z } from 'zod';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

const RacersState = z.object({ racers: z.array(z.object({ id: z.string(), body: z.object({ vx: z.number() }) })) });

/**
 * Start in front of the ice plug with a Comet. Give the moving asteroid a half-second head start,
 * break the plug, and thrust straight through the shortcut's blue mouth. Release the stick at
 * the exit so the racer has to coast to the finish on its existing momentum.
 */
export default scenario({
  description: 'a drifting racer keeps enough speed through the two-way wormhole to coast to the finish',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test', stage: 'cannonball' } },
  input: [
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(210),
    hold(['right', 'fire'], 1),
    hold('right', 346),
    wait(112),
  ],
  expect({ events, state, summary }) {
    const warps = events.filter((event) => event.type === 'wormhole.warped' && event.racer === 'player');
    expect(warps).toMatchObject([{ hole: 0, from: 'a' }]);
    const finish = events.find((event) => event.type === 'racer.finished' && event.id === 'player');
    expect(finish?.tick).toBeGreaterThan(warps[0]?.tick ?? 0);
    expect(summary).toMatchObject({ finished: true });
    const player = RacersState.parse(state).racers.find(({ id }) => id === 'player');
    expect(Math.round(player?.body.vx ?? 0)).toBeGreaterThan(70);
  },
});
