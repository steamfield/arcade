/**
 * Draws the near backdrop as pixel rows: the limb of a cratered moon along the bottom and a few
 * distant asteroids floating above it, all dark silhouettes lit along their upper-left edges. The
 * horizon's swells are whole waves across the layer's width and the asteroids wrap, so the layer
 * tiles horizontally.
 */
import type { PixelRows } from '../../../art/pixel.ts';
import { blankGrid, isPainted, type PixelGrid, plot, toRows } from './grid.ts';

const DARK = '0';
const LIT = '1';

/** A distant asteroid: its centre and radius in px. */
export interface Asteroid {
  x: number;
  y: number;
  radius: number;
}

/** A crater bitten out of the horizon: its centre column, half-width and depth in px. */
interface Crater {
  x: number;
  halfWidth: number;
  depth: number;
}

/** The moon's horizon: how high it stands above the layer's floor, how much it rolls, and the craters in it. */
export interface Horizon {
  baseRows: number;
  /** Height in px of the two rolling swells, the first once and the second three times across the layer. */
  swell: readonly [number, number];
  craters: readonly Crater[];
}

/** How far a crater lowers the ground at column `x`, in px: a rounded bowl, deepest at its centre. */
function craterDip(craters: readonly Crater[], x: number, width: number): number {
  let dip = 0;
  for (const crater of craters) {
    const offset = Math.abs(x - crater.x);
    // Measured both ways round the layer, so a crater near one edge carries on past the other.
    const distance = Math.min(offset, width - offset);
    if (distance >= crater.halfWidth) continue;
    const across = distance / crater.halfWidth;
    dip = Math.max(dip, Math.round(crater.depth * (1 - across * across)));
  }
  return dip;
}

/** The row the moon's surface starts on at column `x`. */
function surfaceRow(horizon: Horizon, x: number, width: number, height: number): number {
  const turn = (2 * Math.PI * x) / width;
  const [long, short] = horizon.swell;
  const rise = horizon.baseRows + Math.round(long * Math.sin(turn) + short * Math.sin(3 * turn + 1));
  return height - rise + craterDip(horizon.craters, x, width);
}

/** Fills the moon below its surface line. */
function drawHorizon(grid: PixelGrid, horizon: Horizon): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  for (let x = 0; x < width; x++) {
    for (let y = surfaceRow(horizon, x, width, height); y < height; y++) plot(grid, x, y, DARK);
  }
}

/** Fills one asteroid's disc, a pixel wider than it is tall each side so it reads as a rock rather than a ball. */
function drawAsteroid(grid: PixelGrid, asteroid: Asteroid): void {
  const { x, y, radius } = asteroid;
  const squash = radius / (radius + 1);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius - 1; dx <= radius + 1; dx++) {
      const across = dx * squash;
      if (across * across + dy * dy <= radius * radius) plot(grid, x + dx, y + dy, DARK);
    }
  }
}

/** Lights every painted pixel with a clear neighbour above or to its left: the edges facing the sun. */
function lightUpperLeftEdges(grid: PixelGrid): void {
  const edges: [number, number][] = [];
  grid.forEach((row, y) => {
    row.forEach((_, x) => {
      if (!isPainted(grid, x, y)) return;
      if (!isPainted(grid, x, y - 1) || !isPainted(grid, x - 1, y)) edges.push([x, y]);
    });
  });
  for (const [x, y] of edges) plot(grid, x, y, LIT);
}

/** A `width` by `height` layer: the moon's horizon along the bottom with `asteroids` above it. */
export function moonLimb(width: number, height: number, horizon: Horizon, asteroids: readonly Asteroid[]): PixelRows {
  const grid = blankGrid(width, height);
  drawHorizon(grid, horizon);
  for (const asteroid of asteroids) drawAsteroid(grid, asteroid);
  lightUpperLeftEdges(grid);
  return toRows(grid);
}
