import { describe, expect, it } from 'vitest';
import type { Cell } from '../../logic/types.ts';
import { waterlineTiles } from './level-view.ts';

/** Cells from a picture: `~` air, `.` water, `#` rock, `*` coral, `k` kelp, `>` a current. */
function cellsOf(picture: string): Cell[][] {
  const glyphCells: Record<string, Cell> = {
    '~': 'air',
    '.': 'water',
    '#': 'rock',
    '*': 'coral',
    k: 'kelp',
    '>': 'current-right',
  };
  return picture
    .trim()
    .split('\n')
    .map((row) =>
      [...row.trim()].map((glyph) => {
        const cell = glyphCells[glyph];
        if (!cell) throw new Error(`No cell for "${glyph}" in the test picture`);
        return cell;
      }),
    );
}

describe('the waterline', () => {
  it('runs along the top of the water under open sky', () => {
    const cells = cellsOf(`
      ######
      #~~~~#
      #....#
      #....#
    `);
    expect(waterlineTiles({ cells })).toEqual([1, 2, 3, 4].map((x) => ({ x, y: 2 })));
  });

  it('follows a surface that sits at different rows in different stretches, and skips columns with no sky', () => {
    const cells = cellsOf(`
      #######
      #~~....
      #..~~..
      #......
    `);
    expect(waterlineTiles({ cells })).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });

  it('rides over kelp and currents at the surface but never over rock or coral', () => {
    const cells = cellsOf(`
      ~~~~
      k>#*
    `);
    expect(waterlineTiles({ cells })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it('draws nothing on a level with no sky', () => {
    const cells = cellsOf(`
      ####
      #..#
      #..#
    `);
    expect(waterlineTiles({ cells })).toEqual([]);
  });
});
