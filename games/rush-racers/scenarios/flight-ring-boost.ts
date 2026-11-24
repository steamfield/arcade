/**
 * A flyer on Sky Test rides the updraft up the last tower and flies through the line of boost
 * rings stepping down from its top (columns 91-100), each ring it passes boosting it once.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Ticks between flaps on the low road: a flap's rise and fall take about 43, so this holds height. */
const FLAP_EVERY = 40;

/** Flaps from the tunnel to the updraft: under the overhang, over its floor gap and under the fog bank. */
const LOW_ROAD_FLAPS = 10;

/** One flap and the glide-free coast after it, holding right throughout. */
const flapAndCoast = [hold(['right', 'up'], 1), hold('right', FLAP_EVERY - 1)];

/**
 * The `cannonball` stage puts the player in the low tunnel three tiles before its puff cloud plug
 * (the Cannonball it hands over is never fired). From GO the player holds right, dashes through
 * the plug, then flaps every 40 ticks along the low road: under the overhang and over its gap,
 * under the fog bank, into the updraft at the foot of the last tower, which carries it up the
 * tower's face. Still holding right, it clears the top and passes the line's first two rings in
 * order; it falls under the rest, which step down less steeply than a flyer with no Up held.
 */
export default scenario({
  description: 'flying through a boost ring boosts the flyer, once per ring',
  // Hard gives the player no catch-up boost, so the route is flown at the medium's own speed.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test', stage: 'cannonball' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 40),
    hold(['right', 'dash'], 1),
    ...Array.from({ length: LOW_ROAD_FLAPS }, () => flapAndCoast).flat(),
    hold('right', 200),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'racer.fell' && e.id === 'player')).toEqual([]);
    const rings = events.filter((e) => e.type === 'ring.passed' && e.id === 'player').map((e) => e.ring);
    expect(rings.slice(0, 2), 'the first two rings of the line, in order').toEqual([0, 1]);
    expect(new Set(rings).size, 'each ring boosts the flyer once').toBe(rings.length);
  },
});
