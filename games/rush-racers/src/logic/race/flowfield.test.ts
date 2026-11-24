import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { steerDirection } from '../ai/steer.ts';
import { DEFAULT_COURSE, levelOf } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { tileIndex } from '../level/query.ts';
import { buildSwimNav, validateSwimLevel } from '../media/swim/nav.ts';
import { courseFromLevel, placeOnTile, racerOf, step } from '../test-world.ts';
import { type Body, type Level, RACER_SIZE, TILE } from '../types.ts';
import { createWorld } from '../world.ts';
import { buildProgressField, distancesToFinish, type EntryCost, progressAt } from './flowfield.ts';

/** A four-lane straight with one column (x = 3) of `fill`. The finish is at x = 6. */
const straight = (fill = '.'): Level =>
  parseLevel({
    name: 'straight',
    ascii: `
      ########
      #1.${fill}..F#
      #2.${fill}..F#
      #3.${fill}..F#
      #4.${fill}..F#
      ########
    `,
  });

/** Starts in a pocket at the bottom; the only way out is up the left column, then right along the top. */
const hook = (): Level =>
  parseLevel({
    name: 'hook',
    ascii: `
      #########
      #......F#
      #.#######
      #.#######
      #1234####
      #########
    `,
  });

const at = (field: Float32Array, level: Level, x: number, y: number) => field[tileIndex(level, x, y)];

/** The progress field beside swim's fields, as a race on `level` holds them. */
const racedFields = (level: Level, broken: ReadonlySet<number>) => ({
  progress: buildProgressField(level).distance,
  ...buildSwimNav(level, broken),
});

const bodyCentredOn = (tx: number, ty: number): Body => ({
  x: tx * TILE + (TILE - RACER_SIZE.width) / 2,
  y: ty * TILE + (TILE - RACER_SIZE.height) / 2,
  vx: 0,
  vy: 0,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

describe('the progress field', () => {
  it('is zero on finish tiles and grows by one tile per step away', () => {
    const level = straight();
    const { progress } = racedFields(level, new Set());

    for (const y of [1, 2, 3, 4]) expect(at(progress, level, 6, y)).toBe(0);
    expect(at(progress, level, 5, 2)).toBeCloseTo(1, 5);
    expect(at(progress, level, 3, 2)).toBeCloseTo(3, 5);
    expect(at(progress, level, 1, 1)).toBeCloseTo(5, 5);
  });

  it('measures the route around walls, not the straight-line distance', () => {
    const level = hook();
    const { progress } = racedFields(level, new Set());

    expect(at(progress, level, 1, 4)).toBeCloseTo(9, 5);
  });

  it('marks rock unreachable in every field', () => {
    const level = straight();
    const fields = racedFields(level, new Set());

    for (const field of [fields.progress, fields.steer, fields.smash]) {
      expect(at(field, level, 0, 0)).toBe(Number.POSITIVE_INFINITY);
      expect(at(field, level, 7, 2)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it('places racers through coral even though swimmers cannot steer through it', () => {
    const level = straight('C');
    const fields = racedFields(level, new Set());

    expect(at(fields.progress, level, 1, 1)).toBeCloseTo(5, 5);
    expect(at(fields.steer, level, 1, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(at(fields.steer, level, 4, 1)).toBeCloseTo(2, 5);
  });

  it('opens the steer field through coral once it is broken', () => {
    const level = straight('C');
    const broken = new Set([1, 2, 3, 4].map((y) => tileIndex(level, 3, y)));
    const fields = racedFields(level, broken);

    expect(at(fields.steer, level, 1, 1)).toBeCloseTo(5, 5);
  });

  it('lets the smash field cross unbroken coral at a higher cost', () => {
    const level = straight('C');
    const fields = racedFields(level, new Set());
    const smash = at(fields.smash, level, 1, 1) ?? Number.NaN;

    expect(Number.isFinite(smash)).toBe(true);
    expect(smash).toBeGreaterThan(5);
  });

  it('lets the ram field cross unbroken coral too, but for less than the smash field', () => {
    const level = straight('C');
    const fields = racedFields(level, new Set());
    const ram = at(fields.ram, level, 1, 1) ?? Number.NaN;

    expect(ram).toBeGreaterThan(5);
    expect(ram).toBeLessThan(at(fields.smash, level, 1, 1) ?? Number.NaN);
  });
});

describe('the coral gate on the ocean course', () => {
  const level = levelOf(DEFAULT_COURSE);
  const fields = racedFields(level, new Set());
  /** A racer-sized body at the centre of tile (tx, ty). */
  const bodyAt = (tx: number, ty: number): Body => ({
    x: (tx + 0.5) * TILE - RACER_SIZE.width / 2,
    y: (ty + 0.5) * TILE - RACER_SIZE.height / 2,
    w: RACER_SIZE.width,
    h: RACER_SIZE.height,
    vx: 0,
    vy: 0,
  });

  it('the ram field runs straight through the gate (columns 737-738) from the room before it', () => {
    const aim = steerDirection(fields.ram, fields, level, new Set(), bodyAt(732, 9), 3, true);

    // Through, not over: the cave beyond pulls it a little low, but never up the way the others go.
    expect(aim.x).toBeGreaterThan(0.9);
    expect(Math.abs(aim.y)).toBeLessThan(0.35);
  });

  it('the steer and smash fields send a swimmer up and over the gate instead', () => {
    const steer = steerDirection(fields.steer, fields, level, new Set(), bodyAt(732, 9), 3);
    const smash = steerDirection(fields.smash, fields, level, new Set(), bodyAt(732, 9), 3, true);

    expect(steer.y).toBeLessThan(-0.5);
    expect(smash.y).toBeLessThan(-0.5);
  });
});

describe('the steer field', () => {
  it('matches progress in open water', () => {
    const level = straight();
    const fields = racedFields(level, new Set());

    expect(at(fields.steer, level, 1, 2)).toBeCloseTo(at(fields.progress, level, 1, 2) ?? Number.NaN, 5);
  });

  it('charges more to swim through kelp', () => {
    const level = straight('~');
    const fields = racedFields(level, new Set());

    expect(at(fields.steer, level, 1, 2)).toBeGreaterThan(5.5);
  });

  it('charges more to swim against a current and less to ride one', () => {
    const against = straight('<');
    const riding = straight('>');

    expect(at(racedFields(against, new Set()).steer, against, 1, 2)).toBeGreaterThan(5.2);
    expect(at(racedFields(riding, new Set()).steer, riding, 1, 2)).toBeLessThan(4.9);
  });
});

describe('progress lookups', () => {
  it('reads lower for a body further along the same tile', () => {
    const level = straight();
    const fields = buildProgressField(level);
    const middle = bodyCentredOn(2, 2);
    const further = { ...middle, x: middle.x + 4 };

    expect(progressAt(fields, middle)).toBeCloseTo(4, 5);
    expect(progressAt(fields, further)).toBeLessThan(progressAt(fields, middle));
    expect(progressAt(fields, further)).toBeGreaterThanOrEqual(3);
  });

  it('falls smoothly through an L-turn, never rising or jumping between pixels', () => {
    const level = hook();
    const fields = buildProgressField(level);
    const start = bodyCentredOn(1, 4);
    const climb = 3 * TILE;
    const route = [
      ...Array.from({ length: climb + 1 }, (_, i) => ({ ...start, y: start.y - i })),
      ...Array.from({ length: 6 * TILE }, (_, i) => ({ ...start, y: start.y - climb, x: start.x + i + 1 })),
    ];
    const readings = route.map((body) => progressAt(fields, body));
    const drops = readings.slice(1).map((reading, i) => (readings[i] ?? 0) - reading);

    expect(Math.min(...drops)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...drops)).toBeLessThanOrEqual(1 / TILE + 1e-6);
  });
});

describe('reachability', () => {
  it('lists starts sealed off by coral', () => {
    const level = parseLevel({
      name: 'sealed',
      ascii: `
        ########
        #1....F#
        #2....F#
        #CC...F#
        #3C.4.F#
        #CC...F#
        ########
      `,
    });

    expect(validateSwimLevel(level, buildSwimNav(level, new Set()))).toEqual([
      { message: 'Start 3 cannot reach the finish without breaking coral', row: 4, col: 1 },
    ]);
  });

  it('lists nothing when every start can reach the finish', () => {
    const level = straight();

    expect(validateSwimLevel(level, buildSwimNav(level, new Set()))).toEqual([]);
  });
});

describe('progress beside a blocked diagonal', () => {
  /**
   * The tile at (1,1) has rock to its right, so its route runs down through (1,2) and only then
   * right. Its diagonal neighbour (2,2) reads lower but can't be swum to directly.
   */
  const notch = (): Level =>
    parseLevel({
      name: 'notch',
      ascii: `
        ########
        #1######
        #.....F#
        #234..F#
        ########
      `,
    });

  it('does not read lower for a body pressed toward the rock that blocks the diagonal', () => {
    const level = notch();
    const fields = buildProgressField(level);
    const centred = bodyCentredOn(1, 1);
    const againstWall = { ...centred, x: centred.x + 2 };

    expect(progressAt(fields, againstWall)).toBeCloseTo(progressAt(fields, centred), 5);
  });

  it('only decreases along the route down and then toward the finish', () => {
    const level = notch();
    const fields = buildProgressField(level);
    const start = bodyCentredOn(1, 1);
    const route = [
      ...Array.from({ length: 17 }, (_, i) => ({ ...start, y: start.y + i })),
      ...Array.from({ length: 16 }, (_, i) => ({ ...start, y: start.y + TILE, x: start.x + i + 1 })),
    ];
    const readings = route.map((body) => progressAt(fields, body));

    for (let i = 1; i < readings.length; i++) expect(readings[i]).toBeLessThanOrEqual(readings[i - 1] ?? 0);
  });
});

describe('links', () => {
  const uniform: EntryCost = (cell) => (cell === 'rock' ? Number.POSITIVE_INFINITY : 1);

  it('prices a link start from where it carries a racer, and its neighbours route into it', () => {
    const level = hook();
    const walked = distancesToFinish(level, new Set(), uniform);
    const linked = distancesToFinish(level, new Set(), uniform, [
      { from: { x: 1, y: 4 }, to: { x: 6, y: 1 }, cost: 2 },
    ]);

    expect(at(walked, level, 1, 4)).toBe(9);
    expect(at(linked, level, 1, 4)).toBe(3);
    expect(at(linked, level, 2, 4)).toBe(4);
  });

  it('makes a link that carries a racer back a tile to steer round, not a free way past', () => {
    const level = straight();
    const walked = distancesToFinish(level, new Set(), uniform);
    // A mouth in the middle of the second lane that throws a racer back to the start column.
    const linked = distancesToFinish(level, new Set(), uniform, [
      { from: { x: 3, y: 2 }, to: { x: 1, y: 2 }, cost: 1 },
    ]);

    expect(at(walked, level, 3, 2)).toBe(3);
    // One for the link plus the start column's way to the finish, which now bends round the mouth.
    expect(at(linked, level, 3, 2)).toBeCloseTo(1 + 4 + Math.SQRT2, 5);
    // The tile behind the mouth reaches the finish round it, through the lanes beside.
    expect(at(linked, level, 2, 2)).toBeCloseTo(3 + Math.SQRT2, 5);
  });

  it('ignores a link out of a closed tile, and leaves a start Infinity when its target cannot reach the finish', () => {
    const level = hook();
    const linked = distancesToFinish(level, new Set(), uniform, [
      { from: { x: 0, y: 4 }, to: { x: 6, y: 1 }, cost: 1 },
      { from: { x: 1, y: 4 }, to: { x: 3, y: 3 }, cost: 0 },
    ]);

    expect(at(linked, level, 0, 4)).toBe(Number.POSITIVE_INFINITY);
    expect(at(linked, level, 1, 4)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('progress across a wall only a wormhole crosses', () => {
  // The wall at x = 5 is sealed; the two-way hole carries racers from (3, 2) to (7, 2).
  const sealed = (oneWay: boolean): Level =>
    parseLevel({
      name: 'sealed',
      ascii: `
        ############
        #1...#....F#
        #2...#....F#
        #3...#....F#
        #4...#....F#
        ############
      `,
      wormholes: [{ a: [3, 2], b: [7, 2], oneWay }],
    });

  it.each([false, true])('ranks the near side by the way through the hole (one-way: %s)', (oneWay) => {
    const level = sealed(oneWay);
    const progress = buildProgressField(level).distance;

    expect(at(progress, level, 1, 2)).toBeLessThan(Number.POSITIVE_INFINITY);
    // Approaching the mouth gets closer, and the far side is closer still.
    expect(at(progress, level, 1, 2)).toBeGreaterThan(at(progress, level, 2, 2) ?? 0);
    expect(at(progress, level, 2, 2)).toBeGreaterThan(at(progress, level, 3, 2) ?? 0);
    expect(at(progress, level, 3, 2)).toBeGreaterThan(at(progress, level, 8, 2) ?? 0);
  });

  it('charges only the warp onto the finish column and one extra step from beside it', () => {
    for (const [exitCol, distance] of [
      [10, 1],
      [9, 2],
    ] as const) {
      const course = courseFromLevel(
        {
          name: 'wormhole at the finish',
          ascii: `
          ############
          #1...#.....#
          #2...#....F#
          #3...#.....#
          #4...#.....#
          ############
        `,
          wormholes: [{ a: [3, 2], b: [exitCol, 2], oneWay: false }],
        },
        'drift',
      );
      const log = new EventLog<GameEvent>();
      const world = createWorld(course, log, { seed: 1 });
      world.race.phase = 'racing';
      const player = racerOf(world, 'player');
      expect(at(world.progress.distance, world.level, 3, 2)).toBe(distance);

      placeOnTile(player, 3, 2);
      step(world, log);
      expect(player.finished !== null).toBe(exitCol === world.level.finishX);
    }
  });
});
