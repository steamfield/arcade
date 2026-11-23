import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../logic/level/parse.ts';
import { TILE } from '../../logic/types.ts';
import { wellMarks } from './well-view.ts';

const ROOM = [
  '#'.repeat(30),
  ...Array.from({ length: 12 }, (_, row) => `#${'1234'[row] ?? '.'}${'.'.repeat(26)}F#`),
  '#'.repeat(30),
].join('\n');

describe('what the race screen draws for gravity wells', () => {
  it('is nothing for a level without wells', () => {
    expect(wellMarks(parseLevel({ name: 'none', ascii: ROOM }))).toEqual([]);
  });

  it('is one mark per well, in pixels, with a horizon only for a black hole', () => {
    const level = parseLevel({
      name: 'wells',
      ascii: ROOM,
      wells: [
        { col: 12, row: 6, reach: 4, pull: 300 },
        { col: 20, row: 7, reach: 3, pull: 200, horizon: 1 },
      ],
    });

    expect(wellMarks(level)).toEqual([
      { centre: { x: 12.5 * TILE, y: 6.5 * TILE }, reach: 4 * TILE, horizon: null },
      { centre: { x: 20.5 * TILE, y: 7.5 * TILE }, reach: 3 * TILE, horizon: TILE },
    ]);
  });
});
