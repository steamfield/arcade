import { expect } from '@playwright/test';
import { VENT } from '../src/logic/setpieces/vents.ts';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/** Sunlit's geyser vent at column 388, under the surface section: index 1 in the course's vents. */
const SURFACE_VENT = 1;

/**
 * Air time, in ticks from breach to splash, that only an eruption gives: swimming straight up out of
 * the water without one breaches for under 30 ticks.
 */
const LAUNCH_AIR_TICKS = 60;

/**
 * The `surface` stage stands the player in Sunlit's surface section, 12 tiles before the vent at
 * column 388. Swimming right reaches the vent's column; the player waits there through one warning
 * and swims up as the vent erupts on race tick 260, riding the eruption out of the water into a
 * long, high breach before splashing back in.
 */
export default scenario({
  description: 'riding a geyser vent eruption up throws the swimmer out of the water into a long breach',
  start: { save: HARD_SAVE, seed: 1, query: { stage: 'surface' } },
  input: [...TITLE_TO_RACE, wait(180), hold('right', 185), wait(70), hold('up', 80), wait(120)],
  expect({ events }) {
    const eruptions = events.filter((e) => e.type === 'vent.erupted' && e.vent === SURFACE_VENT).map((e) => e.tick);
    const breaches = events.filter((e) => e.type === 'racer.breached' && e.id === 'player').map((e) => e.tick);
    const splashes = events.filter((e) => e.type === 'racer.splashed' && e.id === 'player').map((e) => e.tick);

    expect({ breaches: breaches.length, splashes: splashes.length }).toEqual({ breaches: 1, splashes: 1 });
    const breachedAt = breaches[0] ?? 0;
    const duringEruption = eruptions.some((tick) => tick < breachedAt && breachedAt - tick <= VENT.eruptTicks);
    expect(duringEruption, `breached on tick ${breachedAt}, vent erupted on ${eruptions.join(', ')}`).toBe(true);
    expect((splashes[0] ?? 0) - breachedAt).toBeGreaterThanOrEqual(LAUNCH_AIR_TICKS);
  },
});
