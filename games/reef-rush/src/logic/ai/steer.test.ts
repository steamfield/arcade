import { describe, expect, it } from 'vitest';
import { parseLevel } from '../level/parse.ts';
import { buildFlowFields } from '../race/flowfield.ts';
import { SWIM } from '../swim/physics.ts';
import { type Body, type Level, TILE, type Vec } from '../types.ts';
import { steerDirection } from './steer.ts';

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
