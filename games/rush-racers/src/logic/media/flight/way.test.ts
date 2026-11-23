/**
 * Flight's way: the medium is registered, its aim is full 2D (up at a climb, down at a drop), its
 * next tile steps eight ways so the Easy guide points up and down, and its level check reports a start
 * that can only reach the finish by popping a puff cloud. Read through `FLIGHT_MEDIUM`'s members on
 * worlds built with `createWorld` on small inline courses.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { levelOf } from '../../courses/index.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, placeOnTile, racerOf } from '../../test-world.ts';
import { createWorld } from '../../world.ts';
import { effectiveTuning, MEDIA } from '../index.ts';
import { FLIGHT_MEDIUM } from './index.ts';

/** A world on `ascii` in flight, with the player put on tile `at`. */
function worldWithPlayerAt(ascii: string, at: { x: number; y: number }) {
  const world = createWorld(courseFromLevel(ascii, 'flight'), new EventLog<GameEvent>(1000), { seed: 1 });
  const player = racerOf(world, 'player');
  placeOnTile(player, at.x, at.y);
  return { world, player };
}

/** Up a one-wide shaft at col 1 from the starts, then along the top to the finish. */
const SHAFT = `
  ############
  #.........F#
  #.##########
  #.##########
  #.##########
  #1234#######
  ############
`;

/** Off a ledge and down a one-wide shaft at col 5, then along the bottom to the finish. */
const DROP = `
  ################
  #1234.##########
  #####.##########
  #####.##########
  #####.........F#
  ################
`;

/** Open sky whose only finish tile is in the top right corner, so the way from the bottom left is diagonal. */
const CORNER = `
  ##########
  #.......F#
  #.......##
  #.......##
  #.......##
  #1234...##
  ##########
`;

describe('the flight medium', () => {
  it('is shipped in MEDIA', () => {
    expect(MEDIA.flight).toBe(FLIGHT_MEDIUM);
  });

  it('aims up at a climb', () => {
    const { world, player } = worldWithPlayerAt(SHAFT, { x: 1, y: 5 });

    expect(FLIGHT_MEDIUM.aimFrom(world, player.body, 3).y).toBeLessThan(-0.5);
  });

  it('aims down at a drop', () => {
    const { world, player } = worldWithPlayerAt(DROP, { x: 5, y: 1 });

    expect(FLIGHT_MEDIUM.aimFrom(world, player.body, 3).y).toBeGreaterThan(0.5);
  });

  it('steps eight ways: up a shaft, down a drop and diagonally across open sky', () => {
    const shaft = worldWithPlayerAt(SHAFT, { x: 1, y: 5 }).world;
    const drop = worldWithPlayerAt(DROP, { x: 5, y: 1 }).world;
    const corner = worldWithPlayerAt(CORNER, { x: 2, y: 5 }).world;

    expect([
      FLIGHT_MEDIUM.nextTile(shaft, { x: 1, y: 4 }),
      FLIGHT_MEDIUM.nextTile(drop, { x: 5, y: 2 }),
      FLIGHT_MEDIUM.nextTile(corner, { x: 2, y: 5 }),
    ]).toEqual([
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: -1 },
    ]);
  });

  it('reports a start that can reach the finish only by popping a puff cloud, at that start', () => {
    const course = courseFromLevel(
      `
        ############
        #1.....C..F#
        #2.....C..F#
        ########..F#
        #3.4......F#
        ############
      `,
      'flight',
    );
    const level = levelOf(course);
    const tuning = effectiveTuning({ course: course.id, medium: 'flight', difficulty: 'hard' });
    const problems = FLIGHT_MEDIUM.validateLevel(level, FLIGHT_MEDIUM.buildNav(level, new Set(), tuning));

    expect(problems.map(({ row, col }) => ({ row, col }))).toEqual([
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ]);
    expect(problems.every((problem) => problem.message.length > 0)).toBe(true);
  });
});
