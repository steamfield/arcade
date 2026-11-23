import { describe, expect, it } from 'vitest';
import { SWIM } from '../swim/physics.ts';
import { type Body, type Level, TILE, type Vec } from '../types.ts';
import { parseLevel } from './parse.ts';
import { bodyTiles, cellAt, inDark, isSolid, overlapsTile, sampleEnvironment, tileIndex } from './query.ts';

/** Every cell kind on the top row; starts and finish below. */
const reef = (): Level =>
  parseLevel({
    name: 'query',
    ascii: `
      #C~><^v.F
      1234....F
    `,
  });

/** A racer-sized body whose centre sits at the middle of tile (tx, ty). */
const bodyCentredOn = (tx: number, ty: number): Body => ({
  x: tx * TILE + (TILE - SWIM.width) / 2,
  y: ty * TILE + (TILE - SWIM.height) / 2,
  vx: 0,
  vy: 0,
  w: SWIM.width,
  h: SWIM.height,
});

/** Drops negative zero so direction vectors compare by value. */
const plain = (v: Vec | null) => (v ? { x: v.x + 0, y: v.y + 0 } : null);

describe('tile lookups', () => {
  it('reads the cell at a tile', () => {
    const level = reef();

    expect([0, 1, 2, 3, 7].map((x) => cellAt(level, x, 0))).toEqual([
      'rock',
      'coral',
      'kelp',
      'current-right',
      'water',
    ]);
    expect(cellAt(level, 0, 1)).toBe('water');
  });

  it('treats every tile outside the map as solid rock on all four sides', () => {
    const level = reef();
    const outside = [
      [-1, 0],
      [9, 1],
      [4, -1],
      [4, 2],
    ] as const;

    for (const [x, y] of outside) {
      expect(cellAt(level, x, y)).toBe('rock');
      expect(isSolid(level, new Set(), x, y)).toBe(true);
    }
  });

  it('numbers tiles in row-major order', () => {
    const level = reef();

    expect(tileIndex(level, 0, 0)).toBe(0);
    expect(tileIndex(level, 1, 0)).toBe(1);
    expect(tileIndex(level, 0, 1)).toBe(9);
    expect(tileIndex(level, 8, 1)).toBe(17);
  });
});

describe('solidity', () => {
  it('makes coral solid until its tile index is in the broken set', () => {
    const level = reef();

    expect(isSolid(level, new Set(), 1, 0)).toBe(true);
    expect(isSolid(level, new Set([tileIndex(level, 1, 0)]), 1, 0)).toBe(false);
  });

  it('keeps rock solid even when its index is in the broken set', () => {
    const level = reef();

    expect(isSolid(level, new Set([tileIndex(level, 0, 0)]), 0, 0)).toBe(true);
  });

  it('lets racers through kelp, every current and open water', () => {
    const level = reef();

    for (const x of [2, 3, 4, 5, 6, 7, 8]) expect(isSolid(level, new Set(), x, 0)).toBe(false);
  });
});

describe('body overlap', () => {
  it('lists the inclusive tile range a body spans', () => {
    const body: Body = { x: 10, y: 20, vx: 0, vy: 0, w: 12, h: 10 };

    expect(bodyTiles(body)).toEqual({ left: 0, right: 1, top: 1, bottom: 1 });
  });

  it('leaves out a tile the body only touches at its edge', () => {
    const body: Body = { x: 4, y: 6, vx: 0, vy: 0, w: 12, h: 10 };

    expect(bodyTiles(body)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(overlapsTile(body, 0, 0)).toBe(true);
    expect(overlapsTile(body, 1, 0)).toBe(false);
    expect(overlapsTile(body, 0, 1)).toBe(false);
  });

  it('counts any positive overlap with a tile', () => {
    const body: Body = { x: 4.5, y: 6.5, vx: 0, vy: 0, w: 12, h: 10 };

    expect(overlapsTile(body, 1, 1)).toBe(true);
    expect(overlapsTile(body, 2, 1)).toBe(false);
  });
});

describe('environment sampling', () => {
  it.each([
    { tx: 3, current: { x: 1, y: 0 } },
    { tx: 4, current: { x: -1, y: 0 } },
    { tx: 5, current: { x: 0, y: -1 } },
    { tx: 6, current: { x: 0, y: 1 } },
  ])('reports the current direction $current at the body centre', ({ tx, current }) => {
    const env = sampleEnvironment(reef(), bodyCentredOn(tx, 0));

    expect(plain(env.current)).toEqual(current);
    expect(env.inKelp).toBe(false);
  });

  it('reports kelp with no current', () => {
    const env = sampleEnvironment(reef(), bodyCentredOn(2, 0));

    expect(env).toEqual({ current: null, inKelp: true });
  });

  it('samples only the tile under the centre, not tiles the body edge overlaps', () => {
    const body = bodyCentredOn(7, 0);
    body.x -= 5;

    expect(sampleEnvironment(reef(), body)).toEqual({ current: null, inKelp: false });
  });
});

describe('dark zones', () => {
  /** Ten columns wide, dark over columns 3-4 and 7 only. */
  const twilight = (): Level =>
    parseLevel({
      name: 'dark',
      ascii: `
        1234.....F
        .........F
      `,
      dark: [
        [3, 4],
        [7, 7],
      ],
    });

  it('is dark where the centre sits in a dark column, including both ends of a range', () => {
    const level = twilight();
    const dark = Array.from({ length: level.width }, (_, x) => inDark(level, bodyCentredOn(x, 1)));

    expect(dark).toEqual([false, false, false, true, true, false, false, true, false, false]);
  });

  it('goes by the centre, not the edges: a body reaching into a dark column is lit', () => {
    const level = twilight();
    const leaning = { ...bodyCentredOn(2, 0), x: 3 * TILE - SWIM.width / 2 - 1 };

    expect(inDark(level, leaning)).toBe(false);
    expect(inDark(level, { ...leaning, x: leaning.x + 2 })).toBe(true);
  });

  it('is never dark on a level without dark zones', () => {
    expect(inDark(reef(), bodyCentredOn(4, 1))).toBe(false);
  });
});
