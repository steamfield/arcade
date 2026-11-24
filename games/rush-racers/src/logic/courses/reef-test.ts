/**
 * Reef Test, the unlisted course swim's set piece scenarios run on, so they never depend on Sunlit
 * Shallows' layout. Data only: the level format is documented in `level/parse.ts`. Only
 * `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/** A plain open-water run from the starts to the finish at col 58; the whirlpool lane lays it out. */
const LEVEL: LevelDef = {
  name: 'Reef Test',
  ascii: `
    ############################################################
    #........................................................F.#
    #1.......................................................F.#
    #........................................................F.#
    #2.......................................................F.#
    #........................................................F.#
    #3.......................................................F.#
    #........................................................F.#
    #4.......................................................F.#
    #........................................................F.#
    ############################################################
  `,
};

/** A rough guess until the whirlpool lane lays the course out and measures it. */
const PAR_TICKS = 600;

/** Reef Test: swim's set piece test course in Reef, reachable only by `?course=reef-test` and tests. */
export const REEF_TEST: ShippedCourse = {
  id: 'reef-test',
  name: 'Reef Test',
  level: LEVEL,
  world: 'reef',
  theme: 'ocean',
  song: 'race',
  listed: false,
  parTicks: PAR_TICKS,
};
