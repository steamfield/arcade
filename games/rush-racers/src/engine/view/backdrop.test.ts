import { describe, expect, it } from 'vitest';
import { TILE } from '../../logic/types.ts';
import { caveSpans } from './backdrop.ts';

describe('the cave wall', () => {
  it('spans each dark column range edge to edge, top to bottom of the level', () => {
    const spans = caveSpans({
      height: 12,
      dark: [
        [10, 19],
        [40, 40],
      ],
    });
    expect(spans).toEqual([
      { x: 10 * TILE, y: 0, width: 10 * TILE, height: 12 * TILE },
      { x: 40 * TILE, y: 0, width: TILE, height: 12 * TILE },
    ]);
  });

  it('is nowhere on a level without dark stretches', () => {
    expect(caveSpans({ height: 12, dark: [] })).toEqual([]);
  });
});
