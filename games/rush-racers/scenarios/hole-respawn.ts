import { expect } from '@playwright/test';
import { COURSES, levelOf } from '../src/logic/courses/index.ts';
import { DRIFT_TUNING } from '../src/logic/media/drift/tuning.ts';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

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
 * On Drift Test, from the `hole` stage (the player at rest in the black hole's column, two tiles
 * below its reach), fly straight up at the hole. Its horizon swallows the racer, which waits out
 * drift's `respawnTicks` and comes back where it last flew outside the hole's reach.
 */
export default scenario({
  description: 'a racer who flies into the black hole is swallowed and comes back a second later outside its reach',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test', stage: 'hole' } },
  // Drift Test is unlisted, so Race skips course select; the wait runs out the countdown.
  input: [...TITLE_TO_RACE, wait(180), hold('up', 40), wait(DRIFT_TUNING.extra.respawnTicks + 20)],
  expect({ events, state }) {
    const falls = events.filter((e) => e.type === 'racer.fell' && e.id === 'player');
    const respawns = events.filter((e) => e.type === 'racer.respawned' && e.id === 'player');
    expect(falls).toHaveLength(1);
    expect(respawns).toHaveLength(1);
    expect((respawns[0]?.tick ?? 0) - (falls[0]?.tick ?? 0)).toBe(DRIFT_TUNING.extra.respawnTicks);
    const { w, h } = playerSize(state);
    const x = Number(respawns[0]?.x) + w / 2;
    const y = Number(respawns[0]?.y) + h / 2;
    expect(Math.hypot(x - HOLE.centre.x, y - HOLE.centre.y)).toBeGreaterThan(HOLE.reach);
  },
});
