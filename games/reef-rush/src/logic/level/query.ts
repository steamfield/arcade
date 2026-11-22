/**
 * Read-only questions about a Level's tiles: what is at a tile, what is solid,
 * which tiles a body covers, and what the water does at a body's centre.
 */
import { type Body, type Cell, type Environment, type Level, TILE, type Vec } from '../types.ts';

const CURRENT_DIRECTIONS: ReadonlyMap<Cell, Vec> = new Map([
  ['current-right', { x: 1, y: 0 }],
  ['current-left', { x: -1, y: 0 }],
  ['current-up', { x: 0, y: -1 }],
  ['current-down', { x: 0, y: 1 }],
]);

/** The cell at a tile; anything outside the grid is rock. */
export function cellAt(level: Level, tx: number, ty: number): Cell {
  return level.cells[ty]?.[tx] ?? 'rock';
}

/** Index of a tile in row-major order, used as the key in `World.broken` and flow fields. */
export function tileIndex(level: Level, tx: number, ty: number): number {
  return ty * level.width + tx;
}

/** True for rock (including outside the grid) and for coral that hasn't been broken. */
export function isSolid(level: Level, broken: ReadonlySet<number>, tx: number, ty: number): boolean {
  const cell = cellAt(level, tx, ty);
  if (cell === 'rock') return true;
  return cell === 'coral' && !broken.has(tileIndex(level, tx, ty));
}

/**
 * Inclusive tile range a body overlaps.
 * A tile the body only touches along an edge is not included.
 */
export function bodyTiles(body: Body): { left: number; right: number; top: number; bottom: number } {
  return {
    left: Math.floor(body.x / TILE),
    right: Math.ceil((body.x + body.w) / TILE) - 1,
    top: Math.floor(body.y / TILE),
    bottom: Math.ceil((body.y + body.h) / TILE) - 1,
  };
}

/** True when a body overlaps a tile by any positive area. */
export function overlapsTile(body: Body, tx: number, ty: number): boolean {
  return (
    body.x < (tx + 1) * TILE && body.x + body.w > tx * TILE && body.y < (ty + 1) * TILE && body.y + body.h > ty * TILE
  );
}

/** The current and kelp at the tile under the body's centre. */
export function sampleEnvironment(level: Level, body: Body): Environment {
  const cell = cellAt(level, Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h / 2) / TILE));
  const current = CURRENT_DIRECTIONS.get(cell);
  return { current: current ? { ...current } : null, inKelp: cell === 'kelp' };
}
