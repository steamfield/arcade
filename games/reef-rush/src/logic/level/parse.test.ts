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

  it('reads enemies in reading order, each on open water', () => {
    const parsed = parseLevel(level('1234SEKF'));

    expect(parsed.enemies).toEqual([
      { kind: 'shark', tile: { x: 4, y: 0 } },
      { kind: 'eel', tile: { x: 5, y: 0 } },
      { kind: 'crab', tile: { x: 6, y: 0 } },
    ]);
    expect(parsed.cells).toEqual([Array(8).fill('water')]);
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

describe('parseLevel reading a legend', () => {
  /** A level with its own legend. */
  const legendLevel = (ascii: string, legend: LevelDef['legend']): LevelDef => ({ name: 'Wreck Reef', ascii, legend });
  /** A wreck glyph that is rock and a sand glyph that is kelp. */
  const WRECK_AND_SAND = { w: { cell: 'rock', art: 'wreck' }, s: { cell: 'kelp', art: 'sand' } } as const;

  it('reads a legend glyph as its base cell and keeps the glyph written at every tile', () => {
    const parsed = parseLevel(legendLevel('w#s~.1234F', WRECK_AND_SAND));

    expect(parsed.cells[0]).toEqual(['rock', 'rock', 'kelp', 'kelp', ...Array(6).fill('water')]);
    expect(parsed.glyphs).toEqual([['w', '#', 's', '~', '.', '1', '2', '3', '4', 'F']]);
  });

  it('still rejects a character neither built in nor in the legend, listing the legend glyphs too', () => {
    const error = levelErrorFrom(legendLevel('#1234F\n#.x..F', WRECK_AND_SAND));

    expect(error).toMatchObject({ row: 1, col: 2 });
    expect(error.message).toContain('jSEKws)');
  });

  it.each([
    { glyph: '#', why: 'a terrain character' },
    { glyph: 'o', why: 'an object character' },
    { glyph: '1', why: 'a start digit' },
    { glyph: 'F', why: 'the finish' },
  ])('rejects a legend glyph that reuses $why', ({ glyph }) => {
    const error = levelErrorFrom(legendLevel('#1234F', { [glyph]: { cell: 'rock', art: 'wreck' } }));

    expect(error.message).toContain(`Legend glyph "${glyph}" is a built-in tile`);
  });

  it('rejects a legend glyph that maps to a cell that does not exist', () => {
    const legend = { w: { cell: 'lava', art: 'wreck' } } as unknown as LevelDef['legend'];

    expect(levelErrorFrom(legendLevel('#1234F', legend)).message).toContain('unknown cell "lava"');
  });

  it.each([
    { glyph: 'ww', why: 'two characters' },
    { glyph: '🚢', why: 'an emoji, two UTF-16 units wide' },
  ])('rejects a legend key of $why', ({ glyph }) => {
    const error = levelErrorFrom(legendLevel(`#1234${glyph}F`, { [glyph]: { cell: 'rock', art: 'wreck' } }));

    expect(error.message).toContain('exactly one character');
  });

  it('rejects a whitespace legend key, which trimmed rows would lose', () => {
    const error = levelErrorFrom(legendLevel('#1234F', { ' ': { cell: 'rock', art: 'wreck' } }));

    expect(error.message).toContain('is whitespace');
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

describe('parseLevel opening the surface', () => {
  /** Water, rock and objects in rows 0-2, above the starts in row 3. */
  const SEA = `
    ...#.?o....F
    .........#.F
    ...........F
    #1234......F
  `;
  const IN_COLS_2_TO_9 = [{ from: 2, to: 9, row: 3 }];
  const withSurface = (surface: LevelDef['surface'], ascii = SEA): LevelDef => ({ name: 'Open Sea', ascii, surface });

  it('turns the water above the surface row to air in its columns only, leaving rock and objects in place', () => {
    const parsed = parseLevel(withSurface(IN_COLS_2_TO_9));

    const cellRows = parsed.cells.map((row) => row.map((cell) => (cell === 'air' ? 'a' : cell[0])).join(''));
    expect(cellRows).toEqual(['wwaraaaaaaww', 'wwaaaaaaarww', 'wwaaaaaaaaww', 'rwwwwwwwwwww']);
    expect(parsed.clams).toEqual([{ x: 5, y: 0 }]);
    expect(parsed.pearls).toEqual([{ x: 6, y: 0 }]);
    expect(parsed.surface).toEqual(IN_COLS_2_TO_9);
  });

  it('leaves a level with no surface without air', () => {
    const parsed = parseLevel(withSurface(undefined));

    expect(parsed.cells.flat()).not.toContain('air');
    expect(parsed.surface).toEqual([]);
  });

  it.each([
    {
      surface: { from: 9, to: 2, row: 3 },
      why: 'runs backwards',
      message: 'Surface 0 runs backwards from column 9 to 2',
    },
    {
      surface: { from: 2, to: 12, row: 3 },
      why: 'runs off the map',
      message: 'Surface 0 covers columns 2-12 but the map has columns 0-11',
    },
    {
      surface: { from: -1, to: 9, row: 3 },
      why: 'starts before the map',
      message: 'Surface 0 covers columns -1-9 but the map has columns 0-11',
    },
    {
      surface: { from: 2, to: 9, row: 0 },
      why: 'has no air above it',
      message: 'Surface 0 sits at row 0 but must be a row from 1 to 3',
    },
    {
      surface: { from: 2, to: 9, row: 4 },
      why: 'has no water below it',
      message: 'Surface 0 sits at row 4 but must be a row from 1 to 3',
    },
  ])('rejects a surface that $why', ({ surface, message }) => {
    const error = levelErrorFrom(withSurface([surface]));

    expect(error.message).toBe(message);
    expect(error).toMatchObject({ row: null, col: null });
  });

  it.each([
    { glyph: 'S', kind: 'shark' },
    { glyph: 'E', kind: 'eel' },
    { glyph: 'K', kind: 'crab' },
  ])('rejects a $kind in the air at its row and col', ({ glyph, kind }) => {
    const error = levelErrorFrom(withSurface(IN_COLS_2_TO_9, SEA.replace('.........#.F', `....${glyph}....#.F`)));

    expect(error.message).toBe(`A ${kind} can't sit in the air above a surface at row 1, col 4`);
    expect(error).toMatchObject({ row: 1, col: 4 });
  });

  it('accepts an enemy just under the surface', () => {
    const parsed = parseLevel(withSurface(IN_COLS_2_TO_9, SEA.replace('#1234......F', '#1234..S...F')));

    expect(parsed.enemies).toEqual([{ kind: 'shark', tile: { x: 7, y: 3 } }]);
  });

  it('rejects a start tile in the air at its row and col', () => {
    const ascii = '.1.........F\n....234....F\n...........F';
    const error = levelErrorFrom(withSurface([{ from: 0, to: 9, row: 2 }], ascii));

    expect(error.message).toBe("Start 1 can't sit in the air above a surface at row 0, col 1");
    expect(error).toMatchObject({ row: 0, col: 1 });
  });
});
