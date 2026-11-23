/**
 * Which tileset tile the theme draws at a level position. Kept free of Phaser so the choice between
 * a legend glyph's own art, its base cell's tile and no tile can be tested on its own.
 */
import type { LegendEntry, Level } from '../../logic/types.ts';
import type { TerrainArt } from '../themes/types.ts';

/** A course's glyph legend (`LevelDef.legend`): extra glyph to its base cell and art name. */
export type Legend = Readonly<Record<string, LegendEntry>>;

/** The tile index Phaser's tilemap reads as "draw nothing here". */
export const EMPTY_TILE = -1;

/**
 * The tile the theme draws at (x, y): the glyph's own art when the legend names art the theme has a
 * tile for, else its cell's tile.
 *
 * @returns `EMPTY_TILE` when the position is outside the level or its cell has no tile (open water).
 */
export function tileAt(level: Level, terrain: TerrainArt, legend: Legend, x: number, y: number): number {
  const glyph = level.glyphs[y]?.[x];
  const art = glyph !== undefined && Object.hasOwn(legend, glyph) ? legend[glyph]?.art : undefined;
  if (art !== undefined && Object.hasOwn(terrain.glyphTiles, art)) return terrain.glyphTiles[art] ?? EMPTY_TILE;
  const cell = level.cells[y]?.[x];
  if (cell === undefined) return EMPTY_TILE;
  return terrain.tiles[cell] ?? EMPTY_TILE;
}
