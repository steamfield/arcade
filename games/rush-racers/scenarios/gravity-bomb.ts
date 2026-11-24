/**
 * Farside's Gas Bomb is a gravity bomb: used on Drift Test's start line, it drops behind the player
 * and pulls in the rivals launching beside it for 4 s, then ends where it was dropped.
 */
import { expect } from '@playwright/test';
import { COURSES, levelOf } from '../src/logic/courses/index.ts';
import { GRAVITY_BOMB_TUNING } from '../src/logic/powerups/twists/gravity-bomb.ts';
import { TILE } from '../src/logic/types.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** The centre of the player's start tile on Drift Test, in px: the bomb lands one tile left of it. */
const START = (() => {
  const start = levelOf(COURSES['drift-test']).starts[0];
  if (!start) throw new Error('drift-test has no start for the player');
  return { x: (start.x + 0.5) * TILE, y: (start.y + 0.5) * TILE };
})();

/** The bomb's 4 s and a few ticks over, so it has ended when the input does. */
const BOMB_TICKS = GRAVITY_BOMB_TUNING.ttlTicks + 5;

/**
 * The `ink-sac` stage hands the player an Ink Sac, which Farside reworks into a gravity bomb. On GO
 * the player uses it with right held, so it faces right and the bomb lands one tile behind its start,
 * level with it; the rivals on the start tiles below are inside its five-tile reach as they launch.
 * Then the player flies on. The bomb ends once, where it sat, 4 s after it was dropped.
 */
export default scenario({
  description: 'a gravity bomb drops behind the player on the start line and ends 4 s later where it sat',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'drift-test', stage: 'ink-sac' } },
  input: [
    // Drift Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold(['right', 'fire'], 1),
    hold('right', BOMB_TICKS),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([{ kind: 'inkSac' }]);
    expect(events.filter((e) => e.type === 'ink.spawned')).toEqual([]);
    const launched = events.filter((e) => e.type === 'twist.launched');
    expect(launched).toMatchObject([{ owner: 'player', style: 'gravityBomb' }]);
    const ended = events.filter((e) => e.type === 'twist.ended');
    expect(ended).toMatchObject([{ owner: 'player', style: 'gravityBomb' }]);
    const [drop] = launched;
    const [end] = ended;
    // Fired on its first tick, the bomb has spent one of its ticks already.
    expect(Number(end?.tick) - Number(drop?.tick)).toBe(GRAVITY_BOMB_TUNING.ttlTicks - 1);
    expect(Math.round(START.x - Number(end?.x)), 'how far behind the start the bomb sat').toBe(TILE);
    expect(Math.round(Number(end?.y)), 'the bomb sat level with the start').toBe(START.y);
  },
});
