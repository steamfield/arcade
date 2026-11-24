/**
 * Reef Test, the unlisted course swim's set piece scenarios run on, so they never depend on Sunlit
 * Shallows' layout. Data only: the level format is documented in `level/parse.ts`. Only
 * `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/**
 * A short swim through open water, left to right:
 *
 * - Cols 1-12: the four starts at col 2 and room to line up the approach.
 * - Cols 13-21: a clockwise whirlpool centred at (17, 7). Its northern side flows toward the finish,
 *   with pearls at cols 14, 17 and 20 in row 3, along the shallower edge of the ride.
 * - Cols 17-21: a rock island in rows 9-10. There is a way round its south side below the whirlpool.
 * - Cols 22-46: open water to the finish at col 45.
 */
const LEVEL: LevelDef = {
  name: 'Reef Test',
  ascii: `
    ################################################
    #............................................F.#
    #............................................F.#
    #.............o..o..o........................F.#
    #............................................F.#
    #.1..........................................F.#
    #............................................F.#
    #.2..........................................F.#
    #............................................F.#
    #.3..............#####.......................F.#
    #................#####.......................F.#
    #.4..........................................F.#
    #............................................F.#
    #............................................F.#
    ################################################
  `,
  whirlpools: [{ col: 17, row: 7, radius: 4, spin: 1, push: 220 }],
};

/** Mean Hard expert finish over 40 seeds and all eight characters (320 of 320 finished). */
const PAR_TICKS = 443;

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
