/**
 * Sky Test, the unlisted course the flight medium is built and checked on. Data only: the level
 * format is documented in `level/parse.ts`. Only `courses/index.ts` imports this file.
 */
import type { LevelDef } from '../types.ts';
import type { Course } from './types.ts';

/**
 * Scaffold placeholder: an open sky over a solid floor, left to right.
 *
 * - Cols 1-7: the starts on the floor, with feathers to flap up to at col 12.
 * - Cols 15-16: a thunderhead (`#`) six tiles high to fly over.
 * - Cols 25-26: a puff cloud (`C`) five tiles high to fly over or dash through.
 * - Cols 32-36: a fog bank (`~`) up high, and col 42 an updraft (`^`) column.
 * - Col 58: the finish.
 *
 * Phase 1 lane b replaces it with the real test course (a thunderhead weave, a puff cloud shortcut,
 * a floor gap over open sky, hazards and pickups).
 */
const LEVEL: LevelDef = {
  name: 'Sky Test',
  ascii: `
    ############################################################
    #.........................................................F#
    #.........................................................F#
    #...............................~~~~~.....................F#
    #...............................~~~~~...........o.........F#
    #...........oo..................~~~~~.....................F#
    #...................?...........~~~~~.....................F#
    #.........................................^...............F#
    #..............##.........................^...............F#
    #..............##........CC...............^...............F#
    #..............##........CC...............^...............F#
    #..............##........CC...............^...............F#
    #..............##........CC...oo..........^...............F#
    #1.2.3.4.......##........CC...............^...............F#
    ############################################################
    ############################################################
  `,
};

/** A rough guess at a good flyer's Hard finish; the orchestrator measures it at phase 1's landing. */
const PAR_TICKS = 600;

/** Sky Test: the flight medium's test course in Cloudreach, reachable only by `?course=sky-test` and tests. */
export const SKY_TEST: Course = {
  id: 'sky-test',
  name: 'Sky Test',
  level: LEVEL,
  world: 'cloudreach',
  theme: 'ocean',
  song: 'race',
  listed: false,
  parTicks: PAR_TICKS,
};
