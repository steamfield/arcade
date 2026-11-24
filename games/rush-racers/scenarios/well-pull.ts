import { expect } from '@playwright/test';
import { COURSES, levelOf } from '../src/logic/courses/index.ts';
import { HARD_SAVE, hold, scenario, TITLE_TO_SELECT, wait } from './kit.ts';

/** Drift Test's planet, the one well with no horizon: centre and reach in px. */
const PLANET = (() => {
  const planet = levelOf(COURSES['drift-test']).wells.find((well) => well.horizon === null);
  if (!planet) throw new Error('drift-test has no planet');
  return planet;
})();

interface PlayerBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
}

/** The player's body in `debugState().racers`, the one entry with this id. */
function playerBody(state: unknown): PlayerBody {
  const racers = (state as { racers: { id: string; body: PlayerBody }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

/**
 * On Drift Test, thrust right along the first straight and under the planet at the bend's inside
 * corner. The pull holds the racer against the rock the planet sits in, and past the rock's corner
 * it lifts the racer off its line. It ends with the racer's centre near the planet (inside its
 * reach or just leaving it) and moving up toward it, though only right was held. With the planet
 * removed the racer flies on level and this fails.
 */
export default scenario({
  description: 'flying the straight under the planet, the racer is pulled up toward it with only right held',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test' } },
  // Drift Test is unlisted, so the second fire starts the race; the wait runs out the countdown.
  input: [...TITLE_TO_SELECT, wait(180), hold('right', 340)],
  expect({ events, state }) {
    const body = playerBody(state);
    const centre = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
    expect(Math.hypot(centre.x - PLANET.centre.x, centre.y - PLANET.centre.y)).toBeLessThan(PLANET.reach * 1.5);
    expect(Math.round(body.vy)).toBeLessThan(0);
    expect(events.filter((e) => e.type === 'racer.fell' && e.id === 'player')).toEqual([]);
  },
});
