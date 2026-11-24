import { expect } from '@playwright/test';
import { TILE } from '../src/logic/types.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** First tile column past the bend, where the top corridor runs on to the right. */
const CORRIDOR_START_COL = 50;
/** Rows of the top corridor, inclusive. */
const CORRIDOR_ROWS = { first: 2, last: 10 };

interface PlayerBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
}

/** The player's body in `debugState().racers`, the one entry with this id. */
function playerBody(state: unknown): PlayerBody {
  const racers = (state as { racers: { id: string; body: PlayerBody }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

/**
 * On Drift Test, fly the first straight, turn up the bend past the planet in its inside corner,
 * and run out along the top corridor. This is an end-to-end flight of the planet bend: it ends in the
 * corridor past col 50, still moving, without having fallen. That the planet's pull works is the
 * logic tests' job, not this scenario's.
 */
export default scenario({
  description: 'a racer can fly the planet bend into the top corridor without falling',
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
    hold(['right', 'down'], 40),
    hold('right', 60),
    hold(['right', 'up'], 3),
    hold('right', 60),
  ],
  expect({ events, state }) {
    const body = playerBody(state);
    expect(Math.floor((body.x + body.w / 2) / TILE)).toBeGreaterThanOrEqual(CORRIDOR_START_COL);
    const row = Math.floor((body.y + body.h / 2) / TILE);
    expect(row).toBeGreaterThanOrEqual(CORRIDOR_ROWS.first);
    expect(row).toBeLessThanOrEqual(CORRIDOR_ROWS.last);
    expect(Math.round(body.vx)).toBeGreaterThan(20);
    expect(events.filter((e) => e.type === 'racer.fell' && e.id === 'player')).toEqual([]);
  },
});
