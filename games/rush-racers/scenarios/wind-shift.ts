/**
 * Sky Test's shifting wind zone (columns 112-116, between the storm cell and the finish) turns its
 * gust round every 2 s with a warning first, and a flyer crossing it is carried along or held back.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Ticks between flaps: a flap's rise and fall take about 43, so this holds height. */
const FLAP_EVERY = 40;

/** Flaps from the tunnel to the updraft, as in `flight-ring-boost`. */
const LOW_ROAD_FLAPS = 10;

/** Flaps along the run home past the rings, the storm cell and into the wind zone. */
const RUN_HOME_FLAPS = 5;

/** The wind zone's period on Sky Test, race ticks: +x for the first half, -x for the second. */
const PERIOD = 240;

/** One flap and the coast after it, holding right throughout. */
const flapAndCoast = [hold(['right', 'up'], 1), hold('right', FLAP_EVERY - 1)];

/**
 * The `cannonball` stage puts the player in the low tunnel before its puff cloud plug. From GO the
 * player flies the `flight-ring-boost` route (dash through the plug, flap along the low road, ride
 * the updraft up the last tower and through the rings), then keeps flapping right down the run home
 * through the wind zone to the finish. The zone starts blowing +x at GO; every turn after that is warned
 * 60 ticks ahead, the warning naming the direction the turn brings, and the turns alternate.
 */
export default scenario({
  description: 'a shifting wind zone warns, then turns its gust, every half period',
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
    ...Array.from({ length: LOW_ROAD_FLAPS + RUN_HOME_FLAPS }, () => flapAndCoast).flat(),
  ],
  expect({ events, state }) {
    const winds = events.filter((e) => e.type === 'wind.warned' || e.type === 'wind.shifted');
    expect(winds.every((e) => e.zone === 0)).toBe(true);
    // The zone starts its cycle at GO, a turn the start signal doesn't announce: the first event is the next warning.
    const warnings = winds.filter((e) => e.type === 'wind.warned');
    const turns = winds.filter((e) => e.type === 'wind.shifted');
    expect(winds[0]?.type).toBe('wind.warned');
    expect(turns.length, 'at least two turns').toBeGreaterThanOrEqual(2);
    turns.forEach((turn, index) => {
      expect(turn.tick - (warnings[index]?.tick ?? 0), `turn ${index} is warned 60 ticks ahead`).toBe(60);
      expect(warnings[index]?.dir, `warning ${index} names the coming direction`).toBe(turn.dir);
      expect(turn.dir, `turn ${index} reverses the gust`).toBe(index % 2 === 0 ? -1 : 1);
    });
    expect((turns[1]?.tick ?? 0) - (turns[0]?.tick ?? 0), 'turns come every half period').toBe(PERIOD / 2);
    const { racers } = state as { racers: { id: string; finished: unknown }[] };
    expect(
      racers.find((racer) => racer.id === 'player')?.finished,
      'the player flew through the zone to the line',
    ).toBeTruthy();
  },
});
