/**
 * Draws the backdrop's tree silhouettes as pixel rows from short lists of trees, so the 128-pixel
 * layers are described by where their trees stand rather than typed out. Both layers tile
 * horizontally: anything that crosses the right edge continues from the left.
 */
import type { PixelRows } from '../../../art/pixel.ts';

const DARK = '0';
const LIT = '1';
const CLEAR = '.';

/** Rows a pine tier spans, and how many pixels each tier widens its crown by on either side. */
const TIER_ROWS = 4;
const TIER_WIDENING = 2;

/** A far pine: the column it stands in, the row its tip is on and how many tiers its crown has. */
export interface Pine {
  x: number;
  top: number;
  tiers: number;
}

/** A near trunk: its left column and width. */
export interface Trunk {
  x: number;
  width: number;
}

/** A blank `width` by `height` grid of pixels. */
function blankGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => CLEAR));
}

/** Sets a pixel, wrapping the column around the grid's width; rows outside the grid are ignored. */
function plot(grid: string[][], x: number, y: number, pixel: string): void {
  const row = grid[y];
  if (!row) return;
  row[((x % row.length) + row.length) % row.length] = pixel;
}

/** The grid's rows as strings. */
function toRows(grid: string[][]): PixelRows {
  return grid.map((row) => row.join(''));
}

/** Half the width of a pine's crown `row` rows below its tip: the crown widens in stepped tiers. */
function crownHalfWidth(row: number): number {
  const tier = Math.floor(row / TIER_ROWS);
  return 1 + tier * TIER_WIDENING + Math.floor((row % TIER_ROWS) / 2);
}

/** Draws one pine: a stepped crown with its left edge lit, then a two-pixel trunk down to the floor. */
function drawPine(grid: string[][], pine: Pine): void {
  const crownRows = pine.tiers * TIER_ROWS;
  for (let row = 0; row < crownRows; row++) {
    const half = crownHalfWidth(row);
    for (let dx = -half; dx <= half; dx++) plot(grid, pine.x + dx, pine.top + row, dx === -half ? LIT : DARK);
  }
  for (let y = pine.top + crownRows; y < grid.length; y++) {
    plot(grid, pine.x - 1, y, LIT);
    plot(grid, pine.x, y, DARK);
  }
}

/**
 * A ridge of pines `width` by `height`, with a low bank of earth along the bottom so the trees stand
 * on something.
 */
export function pineRidge(width: number, height: number, pines: readonly Pine[], bankRows: number): PixelRows {
  const grid = blankGrid(width, height);
  for (const pine of pines) drawPine(grid, pine);
  for (let y = height - bankRows; y < height; y++) {
    for (let x = 0; x < width; x++) plot(grid, x, y, y === height - bankRows ? LIT : DARK);
  }
  return toRows(grid);
}

/** Rows at the foot of a trunk over which it flares into roots. */
const ROOT_ROWS = 8;

/** How many pixels a trunk has spread on each side `rowsFromFloor` rows above the floor. */
function rootSpread(rowsFromFloor: number): number {
  return rowsFromFloor < ROOT_ROWS ? Math.floor((ROOT_ROWS - rowsFromFloor) / 2) : 0;
}

/** Draws one trunk from the top of the grid to its floor, lit along its left edge and flared at the roots. */
function drawTrunk(grid: string[][], trunk: Trunk): void {
  grid.forEach((_, y) => {
    const spread = rootSpread(grid.length - 1 - y);
    for (let x = trunk.x - spread; x < trunk.x + trunk.width + spread; x++) {
      plot(grid, x, y, x === trunk.x - spread ? LIT : DARK);
    }
  });
}

/** A line of tree trunks `width` by `height`, each running from the top of the layer to its floor. */
export function trunkLine(width: number, height: number, trunks: readonly Trunk[]): PixelRows {
  const grid = blankGrid(width, height);
  for (const trunk of trunks) drawTrunk(grid, trunk);
  return toRows(grid);
}
