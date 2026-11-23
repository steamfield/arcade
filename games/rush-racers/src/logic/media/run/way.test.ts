/**
 * Run's way, level checks and rival pilot, driven through the medium's own members (`aimFrom`,
 * `distanceAt`, `nextTile`, `validateLevel`, `steer`) on small inline levels, and whole races on the
 * `run-test` course.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { courseById, levelOf } from '../../courses/index.ts';
import { race } from '../../difficulty/race-bots.ts';
import type { GameEvent } from '../../events.ts';
import { parseLevel } from '../../level/parse.ts';
import { courseFromLevel, placeOnTile, racerOf } from '../../test-world.ts';
import { CHARACTER_IDS, type Racer, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runMotion } from './data.ts';

const run = MEDIA.run;

/** A draw that passes no skill roll, so a rival never dashes on it. */
const NO_DASH: AiDraws = { wobble: 0, kick: 0.999, side: 0, item: 0 };
/** A draw that passes every skill roll the expert profile allows. */
const DASH_ROLL: AiDraws = { ...NO_DASH, kick: 0 };

/** A world in run on `ascii`, before the countdown has moved anyone. */
function runWorld(ascii: string): World {
  return createWorld(courseFromLevel(ascii, 'run'), new EventLog<GameEvent>(100_000), { seed: 1 });
}

/** Tess standing on tile (tx, ty) with fresh pilot memory, as `afterMove` leaves a runner on the ground. */
function standingRival(world: World, tx: number, ty: number): Racer {
  const tess = racerOf(world, 'tess');
  placeOnTile(tess, tx, ty);
  tess.body.y = (ty + 1) * TILE - tess.body.h;
  runMotion(tess.motion).grounded = true;
  if (tess.ai) tess.ai.pilot = run.createPilot();
  return tess;
}

/** Tess's steering this tick. */
function steer(world: World, racer: Racer, draws = NO_DASH, forceRecover = false): Steering {
  return run.steer(world, racer, run.tuning.base, draws, forceRecover);
}

/** How many ticks in a row, from now, the rival holds Up (0 when it doesn't jump). */
function upTicks(world: World, racer: Racer): number {
  let ticks = 0;
  while (ticks < 120 && steer(world, racer).move.y < 0) ticks++;
  return ticks;
}

/** A level with a wall `height` tiles high at col 5, right of the starts, and the finish at col 10. Runners stand on row 6. */
function wallLevel(height: number): string {
  const air = [1, 2, 3, 4, 5].map((row) => `#....${row > 6 - height ? '#' : '.'}....F#`);
  return ['############', ...air, '#1234#....F#', '############'].join('\n');
}

/** Six rows of air over a floor with the starts on it and a pit at cols 8-10, open out of the bottom. */
const PIT_LEVEL = `
  ####################
  #..................#
  #..................#
  #..................#
  #..................#
  #..................#
  #1.2.3.4..........F#
  ########...#########
`;

/** A wall four tiles high, too high to jump, with a ledge two tiles up in front of it. */
const LEDGE_LEVEL = `
  ##################
  #...............F#
  #...............F#
  #...............F#
  #...........######
  #...........######
  #.......====######
  #1.2.3.4....######
  ##################
`;

/** Problems `validateLevel` finds in `ascii`. */
function problemsIn(ascii: string) {
  const level = parseLevel({ name: 'check', ascii });
  return run.validateLevel(level, run.buildNav(level, new Set(), run.tuning));
}

describe('the run way', () => {
  const world = runWorld(PIT_LEVEL);

  it('aims only sideways, toward the finish, from every open tile', () => {
    const { level } = world;
    const aims = level.cells.flatMap((row, ty) =>
      row.flatMap((cell, tx) =>
        cell === 'rock' ? [] : [run.aimFrom(world, { x: tx * TILE + 2, y: ty * TILE + 3, w: 12, h: 10 }, 1)],
      ),
    );

    expect(aims.filter((aim) => aim.y !== 0)).toEqual([]);
    expect(run.aimFrom(world, { x: 2 * TILE + 2, y: 6 * TILE + 3, w: 12, h: 10 }, 1)).toEqual({ x: 1, y: 0 });
  });

  it('gives a distance that falls to 0 at the finish and is Infinity in rock or off the grid', () => {
    const along = [1, 5, 10, 15, 18].map((tx) => run.distanceAt(world, { x: tx, y: 6 }));

    expect(along).toEqual([...along].sort((a, b) => b - a));
    expect(along.at(-1)).toBe(0);
    expect(run.distanceAt(world, { x: 0, y: 6 })).toBe(Number.POSITIVE_INFINITY);
    expect(run.distanceAt(world, { x: -1, y: 6 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('steps to the neighbour nearer the finish, and stops at the finish', () => {
    expect(run.nextTile(world, { x: 3, y: 6 })).toEqual({ x: 1, y: 0 });
    expect(run.nextTile(world, { x: 18, y: 6 })).toBeNull();
  });
});

describe('run level checks', () => {
  it('finds nothing wrong with a level a runner can race', () => {
    expect(problemsIn(PIT_LEVEL)).toEqual([]);
  });

  it('reports a start that cannot reach the finish', () => {
    const problems = problemsIn(`
      ##########
      #1#......#
      ###2.3.4F#
      ##########
    `);

    expect(problems).toEqual([{ message: 'Start 1 cannot reach the finish running', row: 1, col: 1 }]);
  });

  it('reports a start with no ground within 4 rows below it, and not one with ground 4 rows down', () => {
    const problems = problemsIn(`
      ##########
      #1......F#
      #.......F#
      #..2....F#
      #.......F#
      #.......F#
      #....3.4F#
      ##########
    `);

    expect(problems).toEqual([
      {
        message: 'Start 1 has no ground within 4 rows below it; put a floor under it',
        row: 1,
        col: 1,
      },
    ]);
  });

  it('reports a finish line with no ground close below any of its tiles', () => {
    const problems = problemsIn(`
      ##########
      #.......F#
      #........#
      #........#
      #........#
      #........#
      #1.2.3.4.#
      ##########
    `);

    expect(problems).toEqual([
      {
        message: "No finish tile in col 8 has ground within 4 rows below it; a runner can't reach the line",
        row: null,
        col: 8,
      },
    ]);
  });
});

describe('the run rival pilot', () => {
  it('jumps a wall ahead, holding Up longer for a higher one', () => {
    const holds = [1, 2].map((height) => {
      const world = runWorld(wallLevel(height));
      return upTicks(world, standingRival(world, 4, 6));
    });

    expect(holds[0]).toBeGreaterThan(0);
    expect(holds[1]).toBeGreaterThan(holds[0] ?? 0);
  });

  it('jumps a pit at its front edge with a full jump, and not from further back', () => {
    const world = runWorld(PIT_LEVEL);
    const atEdge = standingRival(world, 7, 6);
    const twoTileWall = runWorld(wallLevel(2));
    const wallHold = upTicks(twoTileWall, standingRival(twoTileWall, 4, 6));

    expect(upTicks(world, atEdge)).toBeGreaterThan(wallHold);
    expect(upTicks(world, standingRival(world, 5, 6))).toBe(0);
  });

  it('hops onto a ledge when the wall ahead is too high to jump', () => {
    const world = runWorld(LEDGE_LEVEL);
    const twoTileWall = runWorld(wallLevel(2));

    expect(upTicks(world, standingRival(world, 11, 7))).toBe(upTicks(twoTileWall, standingRival(twoTileWall, 4, 6)));
  });

  it('lets go of Up for a tick before it jumps again', () => {
    const world = runWorld(wallLevel(2));
    const tess = standingRival(world, 4, 6);
    const ups = Array.from({ length: 60 }, () => steer(world, tess).move.y < 0);
    const release = ups.indexOf(false);

    expect(release).toBeGreaterThan(0);
    expect(ups.slice(release, release + 2)).toEqual([false, true]);
  });

  it('dashes when running on flat ground with the dash ready and the skill roll passed, and not otherwise', () => {
    const world = runWorld(PIT_LEVEL);
    const running = (tx: number) => {
      const tess = standingRival(world, tx, 6);
      tess.body.vx = 100;
      return tess;
    };

    expect(steer(world, running(2), DASH_ROLL).kick).toBe(true);
    expect(steer(world, running(2), NO_DASH).kick).toBe(false);
    expect(steer(world, running(6), DASH_ROLL).kick).toBe(false);
    const cooling = running(2);
    cooling.kickCooldown = 1;
    expect(steer(world, cooling, DASH_ROLL).kick).toBe(false);
    const standingStill = standingRival(world, 2, 6);
    standingStill.kickCooldown = 0;
    expect(steer(world, standingStill, DASH_ROLL).kick).toBe(false);
  });

  it('on a forced recovery backs off from the finish, then jumps toward it', () => {
    const world = runWorld(PIT_LEVEL);
    const tess = standingRival(world, 4, 6);
    const moves = Array.from({ length: 31 }, (_, tick) => steer(world, tess, NO_DASH, tick === 0));

    expect(moves[0]).toMatchObject({ move: { x: -1, y: 0 }, kick: false, recovering: true });
    expect(moves[29]).toMatchObject({ move: { x: 1, y: -1 }, recovering: true });
    expect(moves[30]?.recovering).toBe(false);
  });
});

describe('the run-test course', () => {
  const course = courseById('run-test');

  it('is raced in run and every rival finishes within par from its start', () => {
    if (!course) throw new Error("Course 'run-test' isn't registered");
    expect(run.validateLevel(levelOf(course), run.buildNav(levelOf(course), new Set(), run.tuning))).toEqual([]);
    const late = CHARACTER_IDS.slice(0, 4).flatMap((character, index) => {
      const { finish } = race(BOT_PROFILES.expert, character, index + 1, 'hard', course.id);
      return Object.entries(finish)
        .filter(([id, tick]) => id !== 'player' && (tick === null || tick > course.parTicks))
        .map(([id, tick]) => `${character} ${id} ${tick ?? 'DNF'}`);
    });

    expect(late).toEqual([]);
  });
});
