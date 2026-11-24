/**
 * Sky Test, the unlisted course the flight medium is built and checked on. Data only: the level
 * format is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/**
 * A sunset sky over a thunderhead floor, flown left to right. Rows 0 and 23 are the ceiling and the
 * floor; flight reads `#` as thunderhead, `C` as puff cloud, `~` as fog, `^` as updraft, `o` as a
 * feather, `?` as a balloon, `*` as a spark cloud, `j` as a static wisp, `B` as a bounce cloud and
 * `@` as a boost ring.
 *
 * - Cols 1-8: the starts on the floor, with feathers up the line of the first climb.
 * - Cols 11-13: a bounce cloud in the floor, just past the starts, that springs a flyer coming down
 *   onto it up toward the first climb.
 * - Cols 18-28: the thunderhead weave: a tower from the floor to climb over (open above row 10),
 *   then one from the ceiling to dive under (open below row 13). A balloon sits between them.
 * - Cols 40-52: a thunderhead block. The open way climbs over its top (rows 1-4, feathers there);
 *   the shortcut is the low tunnel under it, plugged by a puff cloud at col 46 that a dash pops. A
 *   spark cloud sits low before it.
 * - Cols 57-68: an overhang from the ceiling down to row 13, over a floor gap (cols 61-65) where
 *   the bottom row is open sky, with feathers and a static wisp under it.
 * - Cols 73-78: a fog bank at mid height, with a balloon below it.
 * - Cols 84-88: an updraft column up the face of a floor tower that is open above row 6.
 * - Cols 89-117: the run home: a line of four boost rings stepping down from the tower top (cols
 *   91-100, rows 5-8), then a balloon, a static wisp and feathers, and the storm cell, a lightning
 *   zone over cols 107-111 around a spark cloud. A thunderhead shelf at row 10 (cols 107-114)
 *   splits the crossing into an upper and a lower route.
 * - Cols 112-116: a shifting wind zone on the far side of the storm cell, blowing toward the
 *   finish for 2 s and back against it for 2 s, with a warning before each turn.
 * - Cols 124-146: a cloud cannon at row 12 aims up and right over the thunderhead wall at cols
 *   130-132 (open above row 8). A flyer can also climb over the wall under its own power. The finish
 *   is at col 146.
 */
const LEVEL: LevelDef = {
  name: 'Sky Test',
  ascii: `
    ####################################################################################################################################################
    #.........................###............................############.............................................................................F#
    #.........................###..................o.........############.............................................................................F#
    #.........................###.................o..........############.......................?.....................................................F#
    #.........................###............................############...............^^............................................................F#
    #.........................###...........#############....############...............^^.....@......................................................F#
    #......................?..###...........#############....############...............^^........@...................................................F#
    #.........................###...........#############....############....~~~~~~.....^^###........@..........*.....................................F#
    #.........................###...........#############....############....~~~~~~.....^^###...........@.............................###.............F#
    #.........................###...........#############....############....~~~~~~.....^^###.........................................###.............F#
    #.........................###...........#############....############....~~~~~~.....^^###..................########...............###.............F#
    #.................###.....###...........#############....############....~~~~~~.....^^###.........................................###.............F#
    #.................###.....###...........#############....############....~~~~~~.....^^###...........j.............................###.............F#
    #.................###.....###...........#############....############....~~~~~~.....^^###.........................................###.............F#
    #.................###...................#############....................~~~~~~.....^^###.........................................###.............F#
    #............o....###...................#############....................~~~~~~.....^^###...............oo........................###.............F#
    #...........o.....###...................#############.........oo.........~~~~~~.....^^###.........................................###.............F#
    #..........o......###...................#############.....j..............~~~~~~.....^^###.........................................###.............F#
    #.................###...................#############...............................^^###.........................................###.............F#
    #.................###.........................C.....................................^^###.........................................###.............F#
    #.................###.........................C............................?........^^###.........................................###.............F#
    #.................###............*............C.....................................^^###.........................................###.............F#
    #.1.2.3.4.........###.........................C.....................................^^###.........................................###.............F#
    ###########BBB###############################################.....##################################################################################
  `,
  // The storm cell: warns, then strikes, every 2.5 s from the start signal.
  lightning: [{ cols: [107, 111], periodTicks: 150, offsetTicks: 0 }],
  // The turning wind on the run home, a gust's strength each way.
  shiftingWind: [{ cols: [112, 116], periodTicks: 240, offsetTicks: 0, push: 70 }],
  cannons: [{ col: 124, row: 12, dir: [1, -1], speed: 600, flightTicks: 22 }],
};

/**
 * The expert bot's mean Hard finish (1040 ticks over seeds 1-40 and all eight characters) plus 30 %,
 * the slack a test course keeps since no difficulty bars run on it.
 */
const PAR_TICKS = 1352;

/** Sky Test: the flight medium's test course in Cloudreach, reachable only by `?course=sky-test` and tests. */
export const SKY_TEST: ShippedCourse = {
  id: 'sky-test',
  name: 'Sky Test',
  level: LEVEL,
  world: 'cloudreach',
  theme: 'sky',
  song: 'cloudreach',
  listed: false,
  parTicks: PAR_TICKS,
};
