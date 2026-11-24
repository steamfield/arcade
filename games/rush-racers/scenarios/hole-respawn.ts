import { expect } from '@playwright/test';
import { COURSES, levelOf } from '../src/logic/courses/index.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Drift Test's black hole, the one well with a horizon: centre and reach in px. */
const HOLE = (() => {
  const hole = levelOf(COURSES['drift-test']).wells.find((well) => well.horizon !== null);
  if (!hole) throw new Error('drift-test has no black hole');
  return hole;
})();

/** The player's body size in `debugState().racers`, to turn the respawn's top-left into a centre. */
function playerSize(state: unknown): { w: number; h: number } {
  const racers = (state as { racers: { id: string; body: { w: number; h: number } }[] }).racers;
  const player = racers.find((racer) => racer.id === 'player');
  if (!player) throw new Error('debugState().racers has no player entry');
  return player.body;
}

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
  expect({ events, state }) {
    const falls = events.filter((e) => e.type === 'racer.fell' && e.id === 'player');
    const respawns = events.filter((e) => e.type === 'racer.respawned' && e.id === 'player');
    expect(falls).toHaveLength(1);
    expect(respawns).toHaveLength(1);
    expect((respawns[0]?.tick ?? 0) - (falls[0]?.tick ?? 0)).toBe(60);
    const { w, h } = playerSize(state);
    const x = Number(respawns[0]?.x) + w / 2;
    const y = Number(respawns[0]?.y) + h / 2;
    expect(Math.hypot(x - HOLE.centre.x, y - HOLE.centre.y)).toBeGreaterThan(HOLE.reach);
  },
});
