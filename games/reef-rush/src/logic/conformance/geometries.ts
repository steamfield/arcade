/**
 * Small courses for the medium conformance suite: the shapes a rival must get through in any
 * medium (an overhang, a 1-tile gap, a shaft with a lip, a drop), and an open arena for moving
 * freely in every direction. Each becomes a fresh registered course in the medium under test
 * (`courseFromLevel`), raced through `createWorld` and `stepWorld`. Test-only.
 */
import type { Course } from '../courses/types.ts';
import { courseFromLevel } from '../test-world.ts';

/** A shape a rival has to steer through, as ASCII with all four starts. */
export interface Geometry {
  name: string;
  ascii: string;
}

/** The steering shapes, each with the finish placed so the shape is the only way there. */
export const GEOMETRIES: readonly Geometry[] = [
  {
    // A shelf hangs over the starts from the right wall: out from under it on the left, then over the top.
    name: 'an overhang',
    ascii: `
      ################
      #.............F#
      #.............F#
      #...############
      #..............#
      #1.2.3.4.......#
      ################
    `,
  },
  {
    name: 'a 1-tile gap',
    ascii: `
      ################
      #.......#.....F#
      #1......#.....F#
      #2............F#
      #3......#.....F#
      #4......#.....F#
      ################
    `,
  },
  {
    // Up a shaft whose top is closed but for one tile at the left, then along the top to the finish.
    name: 'a shaft with a lip',
    ascii: `
      ##############
      #...........F#
      #.############
      #...##########
      #...##########
      #12.##########
      #34.##########
      ##############
    `,
  },
  {
    name: 'a drop',
    ascii: `
      ################
      #1234..#########
      #####..#########
      #####..#########
      #####.........F#
      #####.........F#
      ################
    `,
  },
];

/** Open water with the starts in one corner, the finish far right, and about ten tiles of room in every direction from `ARENA_CENTRE`. */
export const OPEN_ARENA = `
  ###############################
  #1...........................F#
  #2...........................F#
  #3...........................F#
  #4...........................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  #............................F#
  ###############################
`;

/** The tile in the middle of `OPEN_ARENA`. */
export const ARENA_CENTRE = { x: 15, y: 11 } as const;

/** A fresh course on `ascii` in the medium with id `medium`. */
export function courseIn(ascii: string, medium: string): Course {
  return courseFromLevel({ name: 'conformance', ascii }, medium);
}
