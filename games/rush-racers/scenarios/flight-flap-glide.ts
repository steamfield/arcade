/**
 * A flyer on Sky Test flaps on a fresh Up press and glides while Up stays held: it rises off the
 * thunderhead floor, then comes down no faster than the glide's capped fall.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Top of Sky Test's floor (row 23), in px. A flyer resting on it has its bottom here. */
const FLOOR_TOP = 368;

/** Fall speed Up held caps on Hard (`FLIGHT_TUNING.extra.glideFall`), in px/s. */
const GLIDE_FALL = 50;

/** Fall speed with nothing held caps (`FLIGHT_TUNING.extra.maxFall`), in px/s; a glide stays well under it. */
const FREE_FALL = 240;

/**
 * From GO, the player holds Up for 40 ticks with nothing else pressed: the first tick of the hold is
 * a fresh press, so it flaps once; the flap's lift runs out after about 21 ticks, and for the rest
 * of the hold the flyer sinks at the glide's fall speed, still above the floor it started on.
 */
export default scenario({
  description: 'a fresh Up press flaps once, and holding Up afterwards glides down slowly',
  // Hard, so gravity and the flap are the medium's own, with no Easy multipliers.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('up', 40),
  ],
  expect({ events, state }) {
    expect(events.filter((e) => e.type === 'racer.flapped' && e.id === 'player')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'racer.kicked' && e.id === 'player')).toEqual([]);
    const { racers } = state as { racers: { id: string; body: { y: number; h: number; vy: number } }[] };
    const body = racers.find((racer) => racer.id === 'player')?.body;
    expect(body, 'the player racer is in the state').toBeDefined();
    if (!body) return;
    expect(body.y + body.h, 'still in the air above the floor it flapped from').toBeLessThan(FLOOR_TOP);
    expect(body.vy, 'falling, past the top of the flap').toBeGreaterThan(0);
    expect(body.vy, 'no faster than a glide').toBeLessThanOrEqual(GLIDE_FALL);
    expect(body.vy).toBeLessThan(FREE_FALL);
  },
});
