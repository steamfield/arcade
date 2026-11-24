/**
 * A flyer on Sky Test skims the floor into the bounce cloud just past the starts (columns 11-13)
 * and is sprung upward off it, higher than a flap would take it.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Top of Sky Test's floor (row 23), in px. A flyer resting on it has its bottom here. */
const FLOOR_TOP = 368;

/** How far above the floor a single flap tops out on Hard (150² / (2 × 420) px, about 27). */
const FLAP_HEIGHT = 27;

/**
 * From GO, the player holds right with nothing else: gravity keeps it on the floor until the bounce
 * cloud, which springs it upward. About 25 ticks after reaching the cloud it is well above the
 * floor, higher than one flap reaches, without ever having flapped.
 */
export default scenario({
  description: 'flying onto a bounce cloud springs the flyer up without a flap',
  // Hard, so gravity is the medium's own, with no Easy multipliers.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 100),
  ],
  expect({ events, state }) {
    expect(events.filter((e) => e.type === 'racer.bounced' && e.id === 'player')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'racer.flapped' && e.id === 'player')).toEqual([]);
    const { racers } = state as { racers: { id: string; body: { y: number; h: number } }[] };
    const body = racers.find((racer) => racer.id === 'player')?.body;
    expect(body, 'the player racer is in the state').toBeDefined();
    if (!body) return;
    expect(body.y + body.h, 'higher than a flap reaches').toBeLessThan(FLOOR_TOP - FLAP_HEIGHT);
  },
});
