/**
 * Drift Test, the unlisted course the drift medium is built and checked on. Data only: the level
 * format is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/**
 * An asteroid belt flown left to right, then up, then right again. Drift reads `#` as asteroid rock,
 * `C` as ice, `~` as nebula dust, `>` as solar wind, `o` as stardust, `?` as a supply pod, `*` as a
 * space mine and `j` as a plasma orb. Rows 0-1 and 22-23 are solid.
 *
 * - Cols 1-49, rows 14-21: the long straight from the starts, with stardust and a supply pod on it,
 *   into the wall at col 50: a right-angle bend up cols 40-49 to the top corridor.
 * - Cols 40-80, rows 2-10: the slalom, asteroids jutting from the ceiling and floor at cols 56-75
 *   and three floating mid-corridor, with a plasma orb, a space mine and a supply pod beside the line.
 * - Cols 81-92: the shortcut, a tunnel at rows 5-6 plugged by ice at col 86; the longer open route
 *   drops down cols 74-80 and runs along rows 15-21, with a solar wind lane at rows 17-18 pushing it on.
 * - Cols 93-118: the run home, past a dust field (cols 97-107, rows 9-16) with clean lanes above and
 *   below it, stardust and a supply pod; the finish is col 118.
 *
 * Two gravity wells: a planet (its body is the asteroid rock at the inside of the first bend, col 37
 * row 11) whose pull swings a racer round the bend, and a black hole in the rock above the shortcut
 * (col 89 row 2), its reach dipping into the tunnel's upper row and its horizon wholly inside rock.
 */
const LEVEL: LevelDef = {
  name: 'Drift Test',
  ascii: `
    ########################################################################################################################
    ########################################################################################################################
    ########################################................##..........##...........############.........................F#
    ########################################................##........j.##...........############.........................F#
    ########################################.....................................?...############.........................F#
    ########################################...................##....##....##.............C...............................F#
    ########################################....o..............##....##....##.............C.......................o.o.....F#
    ########################################.........................................############.........................F#
    ########################################....o.................##..........##.....############.........................F#
    ########################################....................*.##..........##.....############....~~~~~~~~~~~..........F#
    ########################################.........................................############....~~~~~~~~~~~..........F#
    ########################################..........########################.......############....~~~~~~~~~~~..........F#
    ########################################..........########################.......############....~~~~~~~~~~~..........F#
    ########################################..........########################.......############....~~~~~~~~~~~..........F#
    #.................................................########################.......############....~~~~~~~~~~~..........F#
    #..1..............................................########################.......................~~~~~~~~~~~..........F#
    #.................................................########################.......................~~~~~~~~~~~..........F#
    #..2................o.o.o.........................########################........>>>>>>>>>>..........................F#
    #...............................?.................########################........>>>>>>>>>>........?.................F#
    #..3..............................................########################............................................F#
    #.................................................########################..........o...o.............................F#
    #..4..............................................########################............................................F#
    ########################################################################################################################
    ########################################################################################################################
  `,
  wells: [
    { col: 37, row: 11, reach: 6, pull: 160 },
    { col: 89, row: 2, reach: 3.5, pull: 300, horizon: 1.5 },
  ],
};

/**
 * The expert bot's mean Hard finish (835 ticks over seeds 1-25 and all eight characters, measured on
 * lane a's physics before phase 1 landed) plus 30 %, the slack the test courses keep.
 */
const PAR_TICKS = 1086;

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
