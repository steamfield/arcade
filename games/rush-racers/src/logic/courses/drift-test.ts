/**
 * Drift Test, the unlisted course the drift medium is built and checked on. Data only: the level
 * format is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/** A stand-in: an open box with one asteroid to steer round, until the real test course is laid out. */
const LEVEL: LevelDef = {
  name: 'Drift Test',
  ascii: `
    ############################################################
    #.........................................................F#
    #.1.......................................................F#
    #.2..................####.................................F#
    #.3..................####..........o.o.o..................F#
    #.4..................####.................................F#
    #.........................................................F#
    ############################################################
  `,
};

/** A rough guess until the course is laid out and an expert run is measured. */
const PAR_TICKS = 900;

/** Drift Test: the drift medium's test course in Farside, reachable only by `?course=drift-test` and tests. */
export const DRIFT_TEST: ShippedCourse = {
  id: 'drift-test',
  name: 'Drift Test',
  level: LEVEL,
  world: 'farside',
  theme: 'ocean',
  song: 'race',
  listed: false,
  parTicks: PAR_TICKS,
};
