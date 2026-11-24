/**
 * Drift's way: the medium is registered, its aim is full 2D round a wall, its next tile steps eight
 * ways, the way keeps off walls where there is room, ice ahead is seen, and its level check reports
 * a start that can only reach the finish by breaking ice. Read through `DRIFT_MEDIUM`'s members on
 * worlds built with `createWorld` on small inline courses.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { levelOf } from '../../courses/index.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, placeOnTile, racerOf } from '../../test-world.ts';
import type { Vec, World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { effectiveTuning, MEDIA } from '../index.ts';
import { DRIFT_MEDIUM } from './index.ts';

/** A world on `ascii` in drift, with the player put on tile `at`. */
function worldWithPlayerAt(ascii: string, at: { x: number; y: number }) {
  const world = createWorld(courseFromLevel(ascii, 'drift'), new EventLog<GameEvent>(1000), { seed: 1 });
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

/** Along the top and down a one-wide shaft at col 5, then along the bottom to the finish. */
const DROP = `
  ################
  #1234.##########
  #####.##########
  #####.##########
  #####.........F#
  ################
`;

/** Open space whose only finish tile is in the top right corner, so the way from the bottom left is diagonal. */
const CORNER = `
  ##########
  #.......F#
  #.......##
  #.......##
  #.......##
  #1234...##
  ##########
`;

/** A corridor seven rows high with the starts against its bottom wall. */
const WIDE = `
  ##############################
  #...........................F#
  #...........................F#
  #...........................F#
  #...........................F#
  #...........................F#
  #...........................F#
  #1234.......................F#
  ##############################
`;

/** A corridor along row 1 plugged by ice at col 7, beside a long way round along the bottom. */
const PLUGGED = `
  ################
  #1234..C......F#
  #.############.#
  #..............#
  ################
`;

/** The tiles from `tile` along the way, one `nextTile` at a time, until it ends (at most 100). */
function wayFrom(world: World, tile: Vec): Vec[] {
  const way: Vec[] = [];
  let at = tile;
  for (let next = DRIFT_MEDIUM.nextTile(world, at); next && way.length < 100; next = DRIFT_MEDIUM.nextTile(world, at)) {
    at = { x: at.x + next.x, y: at.y + next.y };
    way.push(at);
  }
  return way;
}

describe("drift's way", () => {
  it('is shipped in MEDIA', () => {
    expect(MEDIA.drift).toBe(DRIFT_MEDIUM);
  });

  it('aims up a shaft and down a drop, round the wall between', () => {
    const shaft = worldWithPlayerAt(SHAFT, { x: 1, y: 5 });
    const drop = worldWithPlayerAt(DROP, { x: 5, y: 1 });

    expect(DRIFT_MEDIUM.aimFrom(shaft.world, shaft.player.body, 3).y).toBeLessThan(-0.5);
    expect(DRIFT_MEDIUM.aimFrom(drop.world, drop.player.body, 3).y).toBeGreaterThan(0.5);
  });

  it('steps eight ways: up a shaft, down a drop and diagonally across open space', () => {
    const shaft = worldWithPlayerAt(SHAFT, { x: 1, y: 5 }).world;
    const drop = worldWithPlayerAt(DROP, { x: 5, y: 1 }).world;
    const corner = worldWithPlayerAt(CORNER, { x: 2, y: 5 }).world;

    expect([
      DRIFT_MEDIUM.nextTile(shaft, { x: 1, y: 4 }),
      DRIFT_MEDIUM.nextTile(drop, { x: 5, y: 2 }),
      DRIFT_MEDIUM.nextTile(corner, { x: 3, y: 4 }),
    ]).toEqual([
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: -1 },
    ]);
  });

  it('leads to the finish and counts down to it', () => {
    const { world } = worldWithPlayerAt(SHAFT, { x: 1, y: 5 });
    const way = wayFrom(world, { x: 1, y: 5 });
    const distances = [{ x: 1, y: 5 }, ...way].map((tile) => DRIFT_MEDIUM.distanceAt(world, tile));

    expect(way.at(-1)).toEqual({ x: 10, y: 1 });
    expect(distances.every((distance, i) => i === 0 || distance < (distances[i - 1] ?? 0))).toBe(true);
  });

  it('keeps the way off the walls of a wide corridor', () => {
    const { world } = worldWithPlayerAt(WIDE, { x: 1, y: 7 });
    const midway = wayFrom(world, { x: 1, y: 7 }).filter((tile) => tile.x >= 8 && tile.x <= 24);

    expect(midway.length).toBeGreaterThan(10);
    expect(midway.filter((tile) => tile.y === 1 || tile.y === 7)).toEqual([]);
  });

  it('sees ice on the way ahead within the steps asked, and none past them or on an open way', () => {
    const plugged = worldWithPlayerAt(PLUGGED, { x: 4, y: 1 }).world;
    const smasher = createWorld(courseFromLevel(PLUGGED, 'drift'), new EventLog<GameEvent>(1000), {
      seed: 1,
      character: 'baron',
    });
    const open = worldWithPlayerAt(WIDE, { x: 4, y: 4 }).world;

    expect(DRIFT_MEDIUM.coralAhead(smasher, { x: 4, y: 1 }, 4)).toBe(true);
    expect(DRIFT_MEDIUM.coralAhead(smasher, { x: 4, y: 1 }, 2)).toBe(false);
    expect(DRIFT_MEDIUM.coralAhead(open, { x: 4, y: 4 }, 6)).toBe(false);
    expect(DRIFT_MEDIUM.distanceAt(plugged, { x: 4, y: 1 })).toBeGreaterThan(10);
  });

  it('reports a start that can reach the finish only by breaking ice, at that start', () => {
    const course = courseFromLevel(
      `
        ############
        #1.....C..F#
        #2.....C..F#
        ########..F#
        #3.4......F#
        ############
      `,
      'drift',
    );
    const level = levelOf(course);
    const tuning = effectiveTuning({ course: course.id, medium: 'drift', difficulty: 'hard' });
    const problems = DRIFT_MEDIUM.validateLevel(level, DRIFT_MEDIUM.buildNav(level, new Set(), tuning));

    expect(problems.map(({ row, col }) => ({ row, col }))).toEqual([
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ]);
    expect(problems.every((problem) => problem.message.length > 0)).toBe(true);
  });
});
