/**
 * A Comet fired along Drift Test's first straight passes under the planet at the bend's inside
 * corner and is bent up toward it, though it was fired straight right.
 */
import { expect } from '@playwright/test';
import { COURSES, levelOf } from '../src/logic/courses/index.ts';
import { TILE } from '../src/logic/types.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** The centre of the player's start tile on Drift Test, in px: where the comet leaves from. */
const START_Y = (() => {
  const start = levelOf(COURSES['drift-test']).starts[0];
  if (!start) throw new Error('drift-test has no start for the player');
  return (start.y + 0.5) * TILE;
})();

/** The comet's 3 s of flight and a few ticks over, so it has ended when the input does. */
const COMET_FLIGHT_TICKS = 185;

/**
 * The `icons-b` stage hands the player a Hologram (selected) and a Comet at the start line. From GO
 * it selects the Comet and fires it right. The comet flies the straight four tiles under the planet
 * (col 37 row 11, reaching six tiles), whose pull, doubled for a comet, lifts it off its line: it
 * ends (burnt out or against the rock round the planet) more than half a tile above the row it was
 * fired along. With the planet removed it flies level and this fails.
 */
export default scenario({
  description: 'a Comet fired past a planet is bent toward it',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test', stage: 'icons-b' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    tap('next'),
    hold(['right', 'fire'], 1),
    wait(COMET_FLIGHT_TICKS),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'shot.launched')).toMatchObject([{ owner: 'player', style: 'comet' }]);
    const ends = events.filter((e) => e.type === 'shot.ended');
    expect(ends).toMatchObject([{ owner: 'player', style: 'comet' }]);
    const endY = Number(ends[0]?.y);
    expect(START_Y - endY, 'how far above its line the comet ended').toBeGreaterThan(TILE / 2);
  },
});
