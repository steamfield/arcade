/**
 * Run Test, the unlisted course the run medium is built and checked on. Data only: the level format
 * is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { Course } from './types.ts';

/**
 * A short forest run, one idea at a time, left to right on a floor at row 9:
 *
 * - Cols 1-14: the starts and a flat stretch with pearls to pick up in a hop.
 * - Col 15: a cracked-stone block (`C`) one tile high to jump or break.
 * - Col 20: a beetle (`K`) walking the flat, to stomp or dash through.
 * - Col 24: a one-tile block with a crate (`?`) one open tile above it, to bump from below on the way over.
 * - Cols 29-31: a three-tile pit, open out of the bottom of the level, with a pearl over it.
 * - Cols 38-43: a ledge (`=`) run two tiles up, the only way onto the plateau beside it.
 * - Cols 44-50: a plateau four tiles high, then a drop back to the floor and the finish at col 57.
 *
 * No jump needs more than 2 tiles of height or crosses more than 3 tiles of gap, so a held jump has
 * room to spare.
 */
const LEVEL: LevelDef = {
  name: 'Run Test',
  ascii: `
    ############################################################
    #........................................................F.#
    #........................................................F.#
    #..............................................o.........F.#
    #........................................................F.#
    #.............................o........o.o.o#######......F.#
    #.......................?...................#######......F.#
    #.........o.o.........................======#######......F.#
    #1.2.3.4.......C....K...#...................#######......F.#
    #############################...############################
    #############################...############################
    #############################...############################
  `,
};

/**
 * The rivals' mean Hard finish (512 ticks) plus 40 %, measured over seeds 1-5 and all eight player
 * characters with the expert bot as the player: 120 rival runs, none failed to finish, the slowest
 * took 579. Re-measured once a respawn backed a fallen runner off the pit's lip and rivals steered
 * back in the air from a landing their speed would carry into a pit; it was 523 (par 732) with the
 * jump-link pilot and v2 phase 5's lasting dash. It was plus 30 % before the dash carried; with races
 * that much shorter, 30 % no longer covered a rival that falls into the pit once.
 */
const PAR_TICKS = 717;

/** Run Test: the run medium's test course in Thornwood, reachable only by `?course=run-test` and tests. */
export const RUN_TEST: Course = {
  id: 'run-test',
  name: 'Run Test',
  level: LEVEL,
  world: 'thornwood',
  theme: 'forest',
  song: 'thornwood',
  listed: false,
  parTicks: PAR_TICKS,
};
