/**
 * Run Test, the unlisted course the run medium is built and checked on. Data only: the level format
 * is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { ShippedCourse } from './types.ts';

/**
 * A short forest run, one idea at a time, left to right on a floor at row 9:
 *
 * - Cols 1-14: the starts and a flat stretch with pearls to pick up in a hop.
 * - Col 15: a cracked-stone block (`C`) one tile high to jump or break.
 * - Col 20: a beetle (`K`) walking the flat, to stomp or dash through.
 * - Col 24: a one-tile block with a crate (`?`) one open tile above it, to bump from below on the way over.
 * - Cols 29-31: a three-tile pit, open out of the bottom of the level, with a pearl over it.
 * - Cols 38-43: a ledge (`=`) run two tiles up, the only way onto the plateau beside it.
 * - Cols 44-50: a plateau four tiles high, then a drop back to the floor.
 * - Col 53: a spring mushroom (`B`) in the floor, which launches a runner about five tiles up as
 *   it runs over it, higher with Up held.
 * - Cols 59-62: a rotten branch at floor height above a two-tile dip. Cross the shaking span at
 *   speed to reach the acorn on the permanent branches at cols 63-69. The floor below has its
 *   own acorn at col 64 and stays open all the way to the finish at col 75.
 *
 * No jump needs more than 2 tiles of height or crosses more than 3 tiles of gap, so a held jump has
 * room to spare. Both heights past the mushroom lead on to the finish.
 */
const LEVEL: LevelDef = {
  name: 'Run Test',
  crumbles: [{ col: 59, row: 9, length: 4 }],
  ascii: `
    ###############################################################################
    #..........................................................................F..#
    #..........................................................................F..#
    #..............................................o...........................F..#
    #..........................................................................F..#
    #.............................o........o.o.o#######........................F..#
    #.......................?...................#######........................F..#
    #.........o.o.........................======#######........................F..#
    #1.2.3.4.......C....K...#...................#######............o...........F..#
    #############################...#####################B#####===========.....F..#
    #############################...###########################.....o..........F..#
    #############################...###############################################
  `,
};

/**
 * The expert's mean Hard finish (646 ticks across 40 seeds and all eight characters), plus Run
 * Test's 40 % allowance for slower rivals and pit respawns.
 */
const PAR_TICKS = 904;

/** Run Test: the run medium's test course in Thornwood, reachable only by `?course=run-test` and tests. */
export const RUN_TEST: ShippedCourse = {
  id: 'run-test',
  name: 'Run Test',
  level: LEVEL,
  world: 'thornwood',
  theme: 'forest',
  song: 'thornwood',
  listed: false,
  parTicks: PAR_TICKS,
};
