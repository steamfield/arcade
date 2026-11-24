/**
 * A runner on Run Test reaches the spring mushroom in the floor past the plateau (col 53) and is
 * launched off it, higher than any jump: a mushroom springs a runner landing on it from above.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Top of Run Test's floor (row 9), in px. A runner standing on it has its bottom here. */
const FLOOR_TOP = 144;
/** How high a full held jump lifts a runner's feet on Hard, px (about 3.3 tiles). */
const FULL_JUMP_PX = 53;
/** The mushroom's column, in px: col 53 starts at x 848. */
const MUSHROOM_LEFT = 848;

/**
 * The route `ledge-jump` takes onto the branch at cols 38-43, then a run to its end against the
 * plateau's side, a held jump up onto it, a run across it, off its far edge to the floor and on into
 * the mushroom, ending near the top of the launch, Up let go. It never jumps after leaving the plateau.
 */
export default scenario({
  description: 'running onto a spring mushroom launches the runner higher than a jump',
  // Hard gives the player no catch-up boost, so the timing below doesn't depend on where the rivals are.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'run-test' } },
  input: [
    // Run Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 130),
    hold(['right', 'up'], 20),
    hold('right', 65),
    hold(['right', 'up'], 3),
    wait(20),
    hold('right', 5),
    wait(15),
    hold('right', 40),
    hold(['right', 'up'], 20),
    hold('right', 95),
    wait(20),
    hold('up', 20),
    wait(40),
    hold('right', 25),
    hold(['right', 'up'], 20),
    hold('right', 110),
  ],
  expect({ events, state }) {
    const player = events.filter((e) => 'id' in e && e.id === 'player');
    expect(player.filter((e) => e.type === 'racer.fell')).toEqual([]);
    expect(player.filter((e) => e.type === 'racer.bounced')).toHaveLength(1);
    const { racers } = state as { racers: { id: string; body: { x: number; y: number; h: number } }[] };
    const body = racers.find((racer) => racer.id === 'player')?.body;
    expect(body, 'the player racer is in the state').toBeDefined();
    if (!body) return;
    expect(body.x, 'past the plateau, at or over the mushroom').toBeGreaterThan(MUSHROOM_LEFT - 16);
    expect(body.y + body.h, 'higher than a full jump reaches').toBeLessThan(FLOOR_TOP - FULL_JUMP_PX);
  },
});
