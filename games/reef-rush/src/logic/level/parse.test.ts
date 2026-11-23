import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../types.ts';
import { LevelError, parseLevel } from './parse.ts';

const level = (ascii: string, dark?: LevelDef['dark']): LevelDef => ({ name: 'Test Reef', ascii, dark });

/** The LevelError parseLevel throws for `def`; any other outcome fails the test. */
function levelErrorFrom(def: LevelDef): LevelError {
  try {
    parseLevel(def);
  } catch (error) {
    if (error instanceof LevelError) return error;
    throw error;
  }
  throw new Error('parseLevel accepted a level it should have rejected');
}

describe('parseLevel reading tiles', () => {
  it('reads every tile character into its cell, start, finish or object list', () => {
    const parsed = parseLevel(
      level(`
        #C~><^v.F
        1234o?*jF
      `),
    );

    expect(parsed.name).toBe('Test Reef');
    expect(parsed.width).toBe(9);
    expect(parsed.height).toBe(2);
    expect(parsed.cells[0]).toEqual([
      'rock',
      'coral',
      'kelp',
      'current-right',
      'current-left',
      'current-up',
      'current-down',
      'water',
      'water',
    ]);
    expect(parsed.starts).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(parsed.finishX).toBe(8);
    expect(parsed.pearls).toEqual([{ x: 4, y: 1 }]);
    expect(parsed.clams).toEqual([{ x: 5, y: 1 }]);
    expect(parsed.urchins).toEqual([{ x: 6, y: 1 }]);
    expect(parsed.jellies).toEqual([{ x: 7, y: 1 }]);
    expect(parsed.dark).toEqual([]);
  });

  it('makes start, finish and object tiles open water', () => {
    const parsed = parseLevel(level('1234o?*jF'));

    expect(parsed.cells).toEqual([Array(9).fill('water')]);
  });

  it('maps start digits to starts in racer order wherever they appear', () => {
    const parsed = parseLevel(
      level(`
        4..F
        .2.F
        3.1F
      `),
    );

    expect(parsed.starts).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ]);
  });

  it('passes dark zones through as tile-column ranges', () => {
    const parsed = parseLevel(
      level('#1234..F', [
        [1, 3],
        [5, 5],
      ]),
    );

    expect(parsed.dark).toEqual([
      [1, 3],
      [5, 5],
    ]);
  });

  it('trims indentation and blank edge lines and accepts CRLF line endings', () => {
    const parsed = parseLevel(level('\r\n\r\n    #1234F\r\n    #....F   \r\n\r\n'));

    expect(parsed.width).toBe(6);
    expect(parsed.height).toBe(2);
    expect(parsed.cells[1]).toEqual(['rock', 'water', 'water', 'water', 'water', 'water']);
  });
});

describe('parseLevel rejecting bad levels', () => {
  it('rejects a row of a different width and names that row', () => {
    const error = levelErrorFrom(level('#1234F\n####'));

    expect(error.row).toBe(1);
    expect(error.message).toContain('row 1');
  });

  it('rejects an unknown character with its row and column', () => {
    const error = levelErrorFrom(level('#1234F\n#.x..F'));

    expect(error).toMatchObject({ row: 1, col: 2 });
    expect(error.message).toContain('at row 1, col 2');
  });

  it('rejects a level missing a start digit', () => {
    const error = levelErrorFrom(level('#123.F'));

    expect(error).toMatchObject({ row: null, col: null });
  });

  it('rejects a repeated start digit at the second occurrence', () => {
    const error = levelErrorFrom(level('#1234F\n#..2.F'));

    expect(error).toMatchObject({ row: 1, col: 3 });
    expect(error.message).toContain('at row 1, col 3');
  });

  it('rejects a level with no finish tile', () => {
    const error = levelErrorFrom(level('#1234.'));

    expect(error).toMatchObject({ row: null, col: null });
  });

  it('rejects finish tiles in a second column at the first stray tile', () => {
    const error = levelErrorFrom(level('#1234.F\n#....F.'));

    expect(error).toMatchObject({ row: 1, col: 5 });
    expect(error.message).toContain('at row 1, col 5');
  });

  it.each([
    { zone: [2, 8] as const, why: 'past the right edge' },
    { zone: [-1, 2] as const, why: 'before the left edge' },
  ])('rejects a dark zone $why', ({ zone }) => {
    expect(levelErrorFrom(level('#1234..F', [zone]))).toBeInstanceOf(LevelError);
  });

  it('rejects a dark zone whose start column is after its end column', () => {
    expect(levelErrorFrom(level('#1234..F', [[5, 2]]))).toBeInstanceOf(LevelError);
  });
});
