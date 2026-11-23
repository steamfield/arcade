import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../logic/level/parse.ts';
import type { TerrainArt } from '../themes/types.ts';
import { EMPTY_TILE, type Legend, tileAt } from './terrain-tile.ts';

const ROCK_TILE = 0;
const CORAL_TILE = 1;
const WRECK_TILE = 7;

const TERRAIN: TerrainArt = {
  tileset: 'tiles',
  tiles: { rock: ROCK_TILE, coral: CORAL_TILE },
  glyphTiles: { wreck: WRECK_TILE },
  flowing: {},
  finishGate: 'gate',
  debris: 'debris',
};

/** `w` is rock drawn as a wreck; `s` is rock whose art the theme has no tile for. */
const LEGEND: Legend = { w: { cell: 'rock', art: 'wreck' }, s: { cell: 'rock', art: 'sand' } };

const LEVEL = parseLevel({
  name: 'tiles',
  ascii: `
    #ws.F
    #1C.F
    #2..F
    #3..F
    #4..F
    #####
  `,
  legend: LEGEND,
});

describe('the tile a theme draws', () => {
  it.each([
    ['a legend glyph with art the theme has', 1, 0, WRECK_TILE],
    ['a legend glyph whose art the theme lacks, as its base cell', 2, 0, ROCK_TILE],
    ['a built-in glyph, as its cell', 0, 0, ROCK_TILE],
    ['coral, as its cell', 2, 1, CORAL_TILE],
    ['open water, as nothing', 3, 0, EMPTY_TILE],
    ['a position outside the level, as nothing', 9, 9, EMPTY_TILE],
  ])('draws %s', (_, x, y, tile) => {
    expect(tileAt(LEVEL, TERRAIN, LEGEND, x, y)).toBe(tile);
  });
});
