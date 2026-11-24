/**
 * Draws the far backdrop's starfield as pixel rows: a seeded scatter of faint and lit single-pixel
 * stars and a few bright ones with a short cross of glints. The same arguments always give the same
 * field, and it tiles horizontally.
 */
import { createRng } from '@arcade/core';
import type { PixelRows } from '../../../art/pixel.ts';
import { blankGrid, type PixelGrid, plot, toRows } from './grid.ts';

/** Pixel characters by brightness, indexing the far layer's palette. */
const FAINT = '0';
const LIT = '1';
const BRIGHT = '2';

/** The four pixels around a bright star that carry its glint. */
const GLINT_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** How many stars of each brightness one field holds. */
export interface StarCounts {
  faint: number;
  lit: number;
  bright: number;
}

/** A pixel position in the field. */
interface Spot {
  x: number;
  y: number;
}

/** A bright star: a bright centre pixel with a lit glint on each side. */
function drawBrightStar(grid: PixelGrid, at: Spot): void {
  plot(grid, at.x, at.y, BRIGHT);
  for (const [dx, dy] of GLINT_OFFSETS) plot(grid, at.x + dx, at.y + dy, LIT);
}

/** A `width` by `height` starfield holding `counts` stars, placed by `seed`. */
export function starField(width: number, height: number, counts: StarCounts, seed: number): PixelRows {
  const grid = blankGrid(width, height);
  const rng = createRng(seed);
  // One row of margin top and bottom keeps every glint inside the layer, which doesn't tile vertically.
  const spot = (): Spot => ({ x: rng.int(0, width - 1), y: rng.int(1, height - 2) });
  for (let star = 0; star < counts.faint; star++) {
    const at = spot();
    plot(grid, at.x, at.y, FAINT);
  }
  for (let star = 0; star < counts.lit; star++) {
    const at = spot();
    plot(grid, at.x, at.y, LIT);
  }
  for (let star = 0; star < counts.bright; star++) drawBrightStar(grid, spot());
  return toRows(grid);
}
