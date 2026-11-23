/**
 * Draws the backdrop's cloud banks as pixel rows from short lists of billows, so the 128-pixel layers
 * are described by where their billows sit rather than typed out. A bank is every billow's disc plus
 * a solid base along the bottom, with its skyline lit: each body pixel within a few rows below open
 * sky takes the lit colour. Banks tile horizontally: a billow that crosses the right edge continues
 * from the left.
 */
import type { PixelRows } from '../../../art/pixel.ts';

const BODY = '0';
const LIT = '1';
const CLEAR = '.';

/** One rounded billow of a bank: its centre column, centre row and radius in px. */
export interface Billow {
  x: number;
  y: number;
  radius: number;
}

/** How a bank is shaped: its billows, the rows of solid base along the bottom and how thick its lit skyline is. */
export interface CloudBankShape {
  billows: readonly Billow[];
  baseRows: number;
  litRows: number;
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

/** Fills one billow's disc with the body colour. */
function drawBillow(grid: string[][], billow: Billow): void {
  const { x, y, radius } = billow;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) plot(grid, x + dx, y + dy, BODY);
    }
  }
}

/** Whether the pixel at (`x`, `y`) has open sky within `rows` pixels straight above it. */
function skyAbove(grid: readonly string[][], x: number, y: number, rows: number): boolean {
  for (let above = 1; above <= rows; above++) {
    if (y - above < 0 || grid[y - above]?.[x] === CLEAR) return true;
  }
  return false;
}

/** Lights the top `rows` pixels of every column of the bank, where the sun catches its skyline. */
function lightSkyline(grid: string[][], rows: number): void {
  // Decide every lit pixel from the unlit bank first, so lighting one row doesn't hide the sky from the next.
  const lit = grid.map((row, y) => row.map((pixel, x) => pixel === BODY && skyAbove(grid, x, y, rows)));
  lit.forEach((row, y) => {
    row.forEach((isLit, x) => {
      if (isLit) plot(grid, x, y, LIT);
    });
  });
}

/** A cloud bank `width` by `height`: billows on a solid base, lit along its skyline. */
export function cloudBank(width: number, height: number, shape: CloudBankShape): PixelRows {
  const grid = blankGrid(width, height);
  for (const billow of shape.billows) drawBillow(grid, billow);
  for (let y = height - shape.baseRows; y < height; y++) {
    for (let x = 0; x < width; x++) plot(grid, x, y, BODY);
  }
  lightSkyline(grid, shape.litRows);
  return grid.map((row) => row.join(''));
}
