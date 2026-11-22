import { describe, expect, it } from 'vitest';
import { parseLevel } from '../level/parse.ts';
import { tileIndex } from '../level/query.ts';
import { SWIM } from '../swim/physics.ts';
import { type Body, type Level, TILE, type Vec } from '../types.ts';
import { buildFlowFields, progressAt, steerDirection, unreachableStarts } from './flowfield.ts';

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

const bodyCentredOn = (tx: number, ty: number): Body => ({
  x: tx * TILE + (TILE - SWIM.width) / 2,
  y: ty * TILE + (TILE - SWIM.height) / 2,
  vx: 0,
  vy: 0,
  w: SWIM.width,
  h: SWIM.height,
});

/** True when walking `distance` px from the body centre along `dir` enters a rock tile. */
function rayHitsRock(level: Level, body: Body, dir: Vec, distance: number): boolean {
  for (let step = 1; step <= distance; step++) {
    const x = Math.floor((body.x + body.w / 2 + dir.x * step) / TILE);
    const y = Math.floor((body.y + body.h / 2 + dir.y * step) / TILE);
    if (level.cells[y]?.[x] !== 'water') return true;
  }
  return false;
}

describe('the progress field', () => {
  it('is zero on finish tiles and grows by one tile per step away', () => {
    const level = straight();
    const { progress } = buildFlowFields(level, new Set());

    for (const y of [1, 2, 3, 4]) expect(at(progress, level, 6, y)).toBe(0);
    expect(at(progress, level, 5, 2)).toBeCloseTo(1, 5);
    expect(at(progress, level, 3, 2)).toBeCloseTo(3, 5);
    expect(at(progress, level, 1, 1)).toBeCloseTo(5, 5);
  });

  it('measures the route around walls, not the straight-line distance', () => {
    const level = hook();
    const { progress } = buildFlowFields(level, new Set());

    expect(at(progress, level, 1, 4)).toBeCloseTo(9, 5);
  });

  it('marks rock unreachable in every field', () => {
    const level = straight();
    const fields = buildFlowFields(level, new Set());

    for (const field of [fields.progress, fields.steer, fields.smash]) {
      expect(at(field, level, 0, 0)).toBe(Number.POSITIVE_INFINITY);
      expect(at(field, level, 7, 2)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it('places racers through coral even though swimmers cannot steer through it', () => {
    const level = straight('C');
    const fields = buildFlowFields(level, new Set());

    expect(at(fields.progress, level, 1, 1)).toBeCloseTo(5, 5);
    expect(at(fields.steer, level, 1, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(at(fields.steer, level, 4, 1)).toBeCloseTo(2, 5);
  });

  it('opens the steer field through coral once it is broken', () => {
    const level = straight('C');
    const broken = new Set([1, 2, 3, 4].map((y) => tileIndex(level, 3, y)));
    const fields = buildFlowFields(level, broken);

    expect(at(fields.steer, level, 1, 1)).toBeCloseTo(5, 5);
  });

  it('lets the smash field cross unbroken coral at a higher cost', () => {
    const level = straight('C');
    const fields = buildFlowFields(level, new Set());
    const smash = at(fields.smash, level, 1, 1) ?? Number.NaN;

    expect(Number.isFinite(smash)).toBe(true);
    expect(smash).toBeGreaterThan(5);
  });
});

describe('the steer field', () => {
  it('matches progress in open water', () => {
    const level = straight();
    const fields = buildFlowFields(level, new Set());

    expect(at(fields.steer, level, 1, 2)).toBeCloseTo(at(fields.progress, level, 1, 2) ?? Number.NaN, 5);
  });

  it('charges more to swim through kelp', () => {
    const level = straight('~');
    const fields = buildFlowFields(level, new Set());

    expect(at(fields.steer, level, 1, 2)).toBeGreaterThan(5.5);
  });

  it('charges more to swim against a current and less to ride one', () => {
    const against = straight('<');
    const riding = straight('>');

    expect(at(buildFlowFields(against, new Set()).steer, against, 1, 2)).toBeGreaterThan(5.2);
    expect(at(buildFlowFields(riding, new Set()).steer, riding, 1, 2)).toBeLessThan(4.9);
  });
});

describe('steering', () => {
  it('points along the only open route toward the finish', () => {
    const level = hook();
    const fields = buildFlowFields(level, new Set());
    const steer = (tx: number, ty: number) =>
      steerDirection(fields.steer, fields, level, new Set(), bodyCentredOn(tx, ty), 3);

    const up = steer(1, 4);
    expect(up.x).toBeCloseTo(0, 5);
    expect(up.y).toBeCloseTo(-1, 5);
    const right = steer(2, 1);
    expect(right.x).toBeCloseTo(1, 5);
    expect(right.y).toBeCloseTo(0, 5);
  });

  it('never aims across a solid corner', () => {
    const level = hook();
    const fields = buildFlowFields(level, new Set());
    const body = bodyCentredOn(1, 3);
    const dir = steerDirection(fields.steer, fields, level, new Set(), body, 3);

    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 5);
    expect(dir.y).toBeLessThan(0);
    expect(rayHitsRock(level, body, dir, 1.5 * TILE)).toBe(false);
  });

  it('stops steering on a finish tile', () => {
    const level = hook();
    const fields = buildFlowFields(level, new Set());
    const dir = steerDirection(fields.steer, fields, level, new Set(), bodyCentredOn(7, 1), 3);

    expect(Math.hypot(dir.x, dir.y)).toBe(0);
  });
});

describe('progress lookups', () => {
  it('reads lower for a body further along the same tile', () => {
    const level = straight();
    const fields = buildFlowFields(level, new Set());
    const middle = bodyCentredOn(2, 2);
    const further = { ...middle, x: middle.x + 4 };

    expect(progressAt(fields, level, middle)).toBeCloseTo(4, 5);
    expect(progressAt(fields, level, further)).toBeLessThan(progressAt(fields, level, middle));
    expect(progressAt(fields, level, further)).toBeGreaterThanOrEqual(3);
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

    expect(unreachableStarts(level, buildFlowFields(level, new Set()))).toEqual([2]);
  });

  it('lists nothing when every start can reach the finish', () => {
    const level = straight();

    expect(unreachableStarts(level, buildFlowFields(level, new Set()))).toEqual([]);
  });
});

describe('steering a whole body', () => {
  /**
   * From (1,1) the descent is (2,1), (3,1), then diagonally to (4,2). The centre line to (4,2)
   * grazes the top-right corner of the rock at (2,2), so a 12x10 body following it would clip it.
   */
  const grazing = (): Level =>
    parseLevel({
      name: 'grazing',
      ascii: `
        #######
        #1...##
        #.#..F#
        #234.F#
        #######
      `,
    });

  it('stops short of a tile the body could only reach by clipping a rock corner', () => {
    const level = grazing();
    const fields = buildFlowFields(level, new Set());
    const dir = steerDirection(fields.steer, fields, level, new Set(), bodyCentredOn(1, 1), 3);

    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
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
    const fields = buildFlowFields(level, new Set());
    const centred = bodyCentredOn(1, 1);
    const againstWall = { ...centred, x: centred.x + 2 };

    expect(progressAt(fields, level, againstWall)).toBeCloseTo(progressAt(fields, level, centred), 5);
  });

  it('only decreases along the route down and then toward the finish', () => {
    const level = notch();
    const fields = buildFlowFields(level, new Set());
    const start = bodyCentredOn(1, 1);
    const route = [
      ...Array.from({ length: 17 }, (_, i) => ({ ...start, y: start.y + i })),
      ...Array.from({ length: 16 }, (_, i) => ({ ...start, y: start.y + TILE, x: start.x + i + 1 })),
    ];
    const readings = route.map((body) => progressAt(fields, level, body));

    for (let i = 1; i < readings.length; i++) expect(readings[i]).toBeLessThanOrEqual(readings[i - 1] ?? 0);
  });
});
