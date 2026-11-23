/**
 * A runner jumps up through a branch (a ledge, `=`) on Run Test and stands on it: a ledge lets a
 * rising body pass and holds a falling one.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Easy, so the timing below is the player's Easy run on foot; pinned so a new default can't move it. */
const EASY_SAVE = {
  ...HARD_SAVE,
  data: { ...HARD_SAVE.data, settings: { ...HARD_SAVE.data.settings, difficulty: 'easy' } },
};

/** Run Test's ledge run: columns 38-43 (x 608-704) on row 7, whose top is at y 112. */
const LEDGE_LEFT = 608;
const LEDGE_RIGHT = 704;
const LEDGE_TOP = 112;

/**
 * Run right over the cracked stone and the block under the crate, take a held jump over the pit,
 * run on until the runner is under the ledge, stop, then jump straight up with nothing held sideways:
 * the runner rises through the ledge from the floor below and comes down standing on it, and is
 * still there 40 ticks later.
 */
export default scenario({
  description: 'a runner jumps up through a ledge from below and stands on it',
  start: { save: EASY_SAVE, seed: 1, query: { course: 'run-test' } },
  input: [
    // Run Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 130),
    hold(['right', 'up'], 20),
    hold('right', 62),
    hold(['right', 'up'], 4),
    wait(20),
    hold('right', 5),
    wait(15),
    hold('right', 40),
    hold(['right', 'up'], 20),
    hold('right', 95),
    wait(20),
    hold('up', 20),
    wait(40),
  ],
  expect({ events, state }) {
    expect(events.filter((e) => e.type === 'racer.fell' && e.id === 'player')).toEqual([]);
    const { racers } = state as {
      racers: { id: string; body: { x: number; y: number; w: number; h: number; vy: number } }[];
    };
    const body = racers.find((racer) => racer.id === 'player')?.body;
    expect(body, 'the player racer is in the state').toBeDefined();
    if (!body) return;
    expect(body.x).toBeGreaterThanOrEqual(LEDGE_LEFT);
    expect(body.x + body.w).toBeLessThanOrEqual(LEDGE_RIGHT);
    expect(body.y + body.h, 'standing on the ledge top').toBeCloseTo(LEDGE_TOP, 3);
    expect(body.vy).toBe(0);
  },
});
