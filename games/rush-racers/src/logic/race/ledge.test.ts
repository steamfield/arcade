/**
 * Ledges (`=`): one-way platforms that hold a body coming down onto them from above and let anything
 * pass up through them or along them.
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../level/parse.ts';
import { type Body, type Level, type MoveRules, RACER_SIZE, TILE } from '../types.ts';
import { moveBody } from './move.ts';

/** A ledge three tiles wide at row 3 (top at y 48), open air above and below it. */
const SHELF: Level = parseLevel({
  name: 'shelf',
  ascii: `
    ##########
    #........F
    #........F
    #...===..F
    #........F
    #........F
    #1234....F
    ##########
  `,
});

const RULES: MoveRules = { pitBelow: false, solidTiles: new Set() };
const LEDGE_TOP = 3 * TILE;

const body = (x: number, y: number, vx: number, vy: number): Body => ({
  x,
  y,
  vx,
  vy,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

function move(target: Body, ticks: number, eachTick: (target: Body) => void = () => {}): void {
  for (let i = 0; i < ticks; i++) {
    moveBody(target, SHELF, new Set(), TICK_DT, RULES);
    eachTick(target);
  }
}

describe('a ledge', () => {
  it('parses as the ledge cell', () => {
    expect(SHELF.cells[3]?.[4]).toBe('ledge');
  });

  it('holds a body falling onto it from above, flush with its top, and reports a floor', () => {
    const falling = body(66, 10, 0, 120);
    let landed = false;
    for (let i = 0; i < 40; i++) landed = moveBody(falling, SHELF, new Set(), TICK_DT, RULES).floor || landed;

    expect(landed).toBe(true);
    expect(falling.y + falling.h).toBeCloseTo(LEDGE_TOP, 6);
    expect(falling.vy).toBe(0);
  });

  it('lets a body rise up through it and land on top of it on the way down', () => {
    const jumper = body(66, 70, 0, -220);
    let highest = jumper.y;
    move(jumper, 90, (b) => {
      highest = Math.min(highest, b.y);
      b.vy += 400 * TICK_DT;
    });

    expect(highest + jumper.h).toBeLessThan(LEDGE_TOP);
    expect(jumper.y + jumper.h).toBeCloseTo(LEDGE_TOP, 6);
  });

  it('lets a body pass through it sideways', () => {
    // Centred on the ledge's row, running right across all three ledge tiles.
    const runner = body(30, LEDGE_TOP + 1, 120, 0);
    move(runner, 45);

    expect(runner.x).toBeGreaterThan(7 * TILE);
    expect(runner.vx).toBe(120);
  });

  it('keeps holding a body standing on it however long gravity pulls', () => {
    const standing = body(66, LEDGE_TOP - RACER_SIZE.height, 0, 0);
    move(standing, 120, (b) => {
      b.vy += 800 * TICK_DT;
    });

    expect(standing.y + standing.h).toBeCloseTo(LEDGE_TOP, 6);
  });

  it('never pushes a body that overlaps it out sideways or down', () => {
    const inside = body(66, LEDGE_TOP + 2, 0, 0);
    move(inside, 1);

    expect(inside.x).toBe(66);
    expect(inside.y).toBe(LEDGE_TOP + 2);
  });
});
