/**
 * The open floor a pit medium asks for (`MoveRules.pitBelow`): with it a body falls out of the level
 * through a gap in the last row; without it the bottom edge is solid as it has always been. Placing
 * reads the last row for a body below the level, so progress never turns into Infinity mid-fall.
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../level/parse.ts';
import { type Body, type Level, RACER_SIZE, TILE } from '../types.ts';
import { buildProgressField, progressAt } from './flowfield.ts';
import { moveBody } from './move.ts';

/** A floor with a two-tile gap at columns 4-5 in the last row. */
const GAP: Level = parseLevel({
  name: 'gap',
  ascii: `
    ##########
    #........F
    #........F
    #1234....F
    ####..####
  `,
});

const body = (x: number, y: number, vx: number, vy: number): Body => ({
  x,
  y,
  vx,
  vy,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

function fall(target: Body, pitBelow: boolean, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    moveBody(target, GAP, new Set(), TICK_DT, { pitBelow, solidTiles: new Set(), openLedges: new Set() });
    target.vy = Math.min(320, target.vy + 800 * TICK_DT);
  }
}

describe('a pit', () => {
  it('lets a body fall out below the last row when the floor is open', () => {
    const faller = body(4 * TILE + 2, 3 * TILE, 0, 0);
    fall(faller, true, 60);

    expect(faller.y).toBeGreaterThan(GAP.height * TILE);
  });

  it('keeps the bottom edge solid when the floor is closed', () => {
    const faller = body(4 * TILE + 2, 3 * TILE, 0, 0);
    fall(faller, false, 60);

    expect(faller.y + faller.h).toBeCloseTo(GAP.height * TILE, 6);
  });

  it('still stops a body on the rock either side of the gap', () => {
    const walker = body(TILE + 2, 2 * TILE, 0, 0);
    fall(walker, true, 60);

    expect(walker.y + walker.h).toBeCloseTo(4 * TILE, 6);
  });

  it('reads progress below the level as the last row, never Infinity', () => {
    const field = buildProgressField(GAP);
    const below = body(4 * TILE + 2, (GAP.height + 3) * TILE, 0, 0);
    // Centred on the last row, so its reading is that row's value alone.
    const lastRow = body(4 * TILE + 2, (GAP.height - 0.5) * TILE - RACER_SIZE.height / 2, 0, 0);

    expect(progressAt(field, below)).toBe(progressAt(field, lastRow));
    expect(Number.isFinite(progressAt(field, below))).toBe(true);
  });
});
