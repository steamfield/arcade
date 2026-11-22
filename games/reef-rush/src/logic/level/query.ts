/**
 * Read-only questions about a Level's tiles: what is at a tile, what is solid,
 * which tiles a body covers, and what the water does at a body's centre.
 */
import type { Body, Cell, Environment, Level } from '../types.ts';

/** The cell at a tile; anything outside the grid is rock. */
export function cellAt(level: Level, tx: number, ty: number): Cell {
  void level;
  void tx;
  void ty;
  throw new Error('not implemented');
}

/** Index of a tile in row-major order, used as the key in `World.broken` and flow fields. */
export function tileIndex(level: Level, tx: number, ty: number): number {
  void level;
  void tx;
  void ty;
  throw new Error('not implemented');
}

/** True for rock (including outside the grid) and for coral that hasn't been broken. */
export function isSolid(level: Level, broken: ReadonlySet<number>, tx: number, ty: number): boolean {
  void level;
  void broken;
  void tx;
  void ty;
  throw new Error('not implemented');
}

/** Inclusive tile range a body overlaps. */
export function bodyTiles(body: Body): { left: number; right: number; top: number; bottom: number } {
  void body;
  throw new Error('not implemented');
}

/** True when a body overlaps a tile by any positive area. */
export function overlapsTile(body: Body, tx: number, ty: number): boolean {
  void body;
  void tx;
  void ty;
  throw new Error('not implemented');
}

/** The current and kelp at the tile under the body's centre. */
export function sampleEnvironment(level: Level, body: Body): Environment {
  void level;
  void body;
  throw new Error('not implemented');
}
