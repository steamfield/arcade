/**
 * A grid of pixel characters that shape-drawing sprites paint into before turning it into pixel
 * rows, so a backdrop layer is described by where its shapes sit rather than typed out. Columns wrap
 * around the grid's width, so anything drawn across the right edge continues from the left and the
 * layer tiles horizontally.
 */
import type { PixelRows } from '../../../art/pixel.ts';

/** Rows of single pixel characters, `grid[y][x]`. */
export type PixelGrid = string[][];

/** The transparent pixel. */
const CLEAR = '.';

/** The column `x` wrapped into a row `width` wide. */
function wrapColumn(x: number, width: number): number {
  return ((x % width) + width) % width;
}

/** A transparent `width` by `height` grid. */
export function blankGrid(width: number, height: number): PixelGrid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => CLEAR));
}

/** Sets a pixel, wrapping the column around the grid's width; rows outside the grid are ignored. */
export function plot(grid: PixelGrid, x: number, y: number, pixel: string): void {
  const row = grid[y];
  if (!row) return;
  row[wrapColumn(x, row.length)] = pixel;
}

/** True when the pixel at (`x`, `y`) is painted; columns wrap and rows outside the grid count as clear. */
export function isPainted(grid: PixelGrid, x: number, y: number): boolean {
  const row = grid[y];
  if (!row) return false;
  return row[wrapColumn(x, row.length)] !== CLEAR;
}

/** The grid's rows as strings. */
export function toRows(grid: PixelGrid): PixelRows {
  return grid.map((row) => row.join(''));
}
