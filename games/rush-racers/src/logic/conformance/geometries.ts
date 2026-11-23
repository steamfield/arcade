/**
 * Small courses for the medium conformance suite, and which of them apply to each medium. Free
 * movers (swim, glide) get an overhang, a 1-tile gap, a shaft with a lip, a drop and an open arena
 * to move in eight ways. Runners skip what needs free movement (the shaft, eight-way open space and
 * the gap's mid-air starts) and get a flat run, a step up, a pit and a ledge hop instead, plus open
 * ground to run left and right on. Each course becomes a fresh registered course in the medium under
 * test (`courseFromLevel`), raced through `createWorld` and `stepWorld`. Test-only.
 */
import type { Course } from '../courses/types.ts';
import { courseFromLevel } from '../test-world.ts';
import type { Vec } from '../types.ts';

/** A shape a rival has to steer through, as ASCII with all four starts. */
export interface Geometry {
  name: string;
  ascii: string;
}

/** Room to move in: the level, where a racer is put to move freely, and where it is put to run up to speed. */
export interface Arena {
  ascii: string;
  /** A tile with about ten tiles of room each way the medium moves. */
  centre: Vec;
  /** A tile near the starts with the length of the arena ahead of it. */
  runway: Vec;
  /** Idle ticks a racer placed in the arena needs to settle (land on its floor) before it is measured. */
  settleTicks: number;
}

/** What the conformance suite races a medium on. */
export interface MediumCases {
  /** Courses every rival must finish without stalling; the first also checks determinism. */
  geometries: readonly Geometry[];
  /** The directions the medium's own spec says a racer moves freely in through the arena. */
  directions: readonly Vec[];
  arena: Arena;
}

// A shelf hangs over the starts from the right wall: out from under it on the left, then over the top.
const OVERHANG: Geometry = {
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
};

// The starts are stacked in mid-air in one column, so racers set off floating or falling.
const ONE_TILE_GAP: Geometry = {
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
};

// Up a shaft whose top is closed but for one tile at the left, then along the top to the finish.
const SHAFT_WITH_LIP: Geometry = {
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
};

const DROP: Geometry = {
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
};

const FLAT_RUN: Geometry = {
  name: 'a flat run',
  ascii: `
    ##################
    #................#
    #................#
    #1.2.3.4........F#
    ##################
  `,
};

// A two-tile step up to the finish.
const STEP_UP: Geometry = {
  name: 'a step up',
  ascii: `
    ##################
    #...............F#
    #...............F#
    #..........#######
    #1.2.3.4...#######
    ##################
  `,
};

// A three-tile gap in the floor, open out of the bottom of the level, with headroom for a full jump.
const PIT: Geometry = {
  name: 'a pit',
  ascii: `
    ####################
    #..................#
    #..................#
    #..................#
    #..................#
    #1.2.3.4..........F#
    ##########...#######
  `,
};

// A wall too high to jump from the floor, with a ledge two tiles up to hop from.
const LEDGE_HOP: Geometry = {
  name: 'a ledge hop',
  ascii: `
    ##################
    #...............F#
    #...............F#
    #...............F#
    #...........######
    #...........######
    #.......====######
    #1.2.3.4....######
    ##################
  `,
};

/** Open water with the starts in one corner, the finish far right, and about ten tiles of room in every direction from its centre. */
const OPEN_ARENA: Arena = {
  ascii: `
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
  `,
  centre: { x: 15, y: 11 },
  runway: { x: 2, y: 6 },
  settleTicks: 0,
};

/** A long flat floor with the starts at the left and the finish far right; its centre stands on the floor. */
const OPEN_GROUND: Arena = {
  ascii: `
    #############################################################
    #...........................................................#
    #...........................................................#
    #1.2.3.4...................................................F#
    #############################################################
  `,
  centre: { x: 30, y: 3 },
  runway: { x: 9, y: 3 },
  settleTicks: 10,
};

const EIGHT_WAYS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
];

/** Media that move freely in every direction. */
const FREE_MOVEMENT: MediumCases = {
  geometries: [OVERHANG, ONE_TILE_GAP, SHAFT_WITH_LIP, DROP],
  directions: EIGHT_WAYS,
  arena: OPEN_ARENA,
};

/** Media that run on the ground under gravity and jump. */
const ON_FOOT: MediumCases = {
  geometries: [FLAT_RUN, OVERHANG, DROP, STEP_UP, PIT, LEDGE_HOP],
  directions: [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ],
  arena: OPEN_GROUND,
};

/** The cases each medium is raced on, by medium id. A new medium adds its own entry. */
export const CASES_BY_MEDIUM: Readonly<Record<string, MediumCases>> = {
  swim: FREE_MOVEMENT,
  glide: FREE_MOVEMENT,
  run: ON_FOOT,
};

/** A fresh course on `ascii` in the medium with id `medium`. */
export function courseIn(ascii: string, medium: string): Course {
  return courseFromLevel({ name: 'conformance', ascii }, medium);
}
