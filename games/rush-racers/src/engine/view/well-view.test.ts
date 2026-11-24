import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../logic/level/parse.ts';
import { TILE } from '../../logic/types.ts';
import { planetRadius, wellMarks } from './well-view.ts';

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

  describe("a planet's body", () => {
    // A room like ROOM with a block of rock five tiles square in it, cols 10-14 and rows 5-9.
    const ROCKY = [
      '#'.repeat(30),
      '#1..........................F#',
      '#2..........................F#',
      '#3..........................F#',
      '#4..........................F#',
      '#.........#####.............F#',
      '#.........#####.............F#',
      '#.........#####.............F#',
      '#.........#####.............F#',
      '#.........#####.............F#',
      '#...........................F#',
      '#...........................F#',
      '#...........................F#',
      '#'.repeat(30),
    ].join('\n');
    const radiusFor = (col: number, row: number, reach: number) => {
      const level = parseLevel({ name: 'planet', ascii: ROCKY, wells: [{ col, row, reach, pull: 300 }] });
      const [mark] = wellMarks(level);
      if (!mark) throw new Error('the level has no well');
      return planetRadius(level, mark);
    };

    it('reaches from its centre to the nearest open tile when it sits in rock', () => {
      // Centred on the block's middle tile (12, 7): two and a half tiles to open space on every side.
      expect(radiusFor(12, 7, 10)).toBe(2.5 * TILE);
    });

    it('is capped at half its reach', () => {
      expect(radiusFor(12, 7, 4)).toBe(2 * TILE);
    });

    it('is not drawn when its centre tile is open', () => {
      expect(radiusFor(20, 7, 4)).toBeNull();
    });
  });
});
