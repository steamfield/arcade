import { describe, expect, it } from 'vitest';
import { TILE } from '../../logic/types.ts';
import { FOREST_THEME } from '../themes/forest.ts';
import { OCEAN_THEME } from '../themes/ocean.ts';
import { SKY_THEME } from '../themes/sky.ts';
import type { Theme } from '../themes/types.ts';
import { caveSpans, movingParts } from './backdrop.ts';
import { hazeRects, hazeStreaks } from './backdrop-haze.ts';

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

/** A level 24 tiles tall, the height of Sky Test, on the 320 px wide base screen. */
const LEVEL_HEIGHT = 24 * TILE;
const SCREEN_WIDTH = 320;

describe('the backdrop haze', () => {
  const streaks = hazeStreaks(LEVEL_HEIGHT, SCREEN_WIDTH);

  it('lays streaks all the way down the level, one per row, none overlapping the next', () => {
    const rows = hazeRects(streaks, 0, SCREEN_WIDTH)
      .map((rect) => ({ top: rect.y, bottom: rect.y + rect.height }))
      .sort((a, b) => a.top - b.top);
    expect(rows.length).toBeGreaterThanOrEqual(LEVEL_HEIGHT / (2 * TILE));
    const overlapping = rows.filter((row, index) => index > 0 && row.top < (rows[index - 1]?.bottom ?? 0));
    expect(overlapping).toEqual([]);
    expect(rows[0]?.top).toBeLessThan(2 * TILE);
    expect(rows.at(-1)?.bottom).toBeGreaterThan(LEVEL_HEIGHT - 2 * TILE);
    expect(rows.at(-1)?.bottom).toBeLessThanOrEqual(LEVEL_HEIGHT);
  });

  it('drifts every streak sideways with time and never up or down, wrapping round the screen', () => {
    const start = hazeRects(streaks, 0, SCREEN_WIDTH);
    const later = hazeRects(streaks, 600, SCREEN_WIDTH);
    expect(later.map((rect) => rect.y)).toEqual(start.map((rect) => rect.y));
    expect(later.filter((rect, index) => rect.x === start[index]?.x)).toEqual([]);
    for (const rect of later) {
      expect(rect.x).toBeGreaterThanOrEqual(-rect.width);
      expect(rect.x).toBeLessThan(SCREEN_WIDTH);
    }
  });

  it('lays rows out in level px, so a taller level adds streaks below and leaves the ones above where they were', () => {
    const taller = hazeRects(hazeStreaks(2 * LEVEL_HEIGHT, SCREEN_WIDTH), 0, SCREEN_WIDTH);
    expect(taller.length).toBe(2 * streaks.length);
    expect(taller.slice(0, streaks.length)).toEqual(hazeRects(streaks, 0, SCREEN_WIDTH));
  });
});

describe('the backdrop moving parts', () => {
  const kinds = (theme: Pick<Theme, 'backdrop' | 'ambient'>) => movingParts(theme).map((part) => part.kind);

  it('draws haze only for a theme that sets it, and keeps the ocean and forest parts as they were', () => {
    expect(kinds(OCEAN_THEME)).toEqual(['caustics', 'rays', 'motes']);
    expect(kinds(FOREST_THEME)).toEqual(['caustics', 'rays', 'motes']);
    expect(movingParts(SKY_THEME)).toEqual([{ kind: 'haze', haze: SKY_THEME.backdrop.haze }]);
  });
});
