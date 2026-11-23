/**
 * The level as a runner meets it: what blocks it, what holds it up, and which open tiles are stand
 * tiles (open, with something to stand on under them). Built from a level with the broken coral
 * gone; crates count as solid.
 */
import { isLedge, isSolid } from '../../level/query.ts';
import type { Level } from '../../types.ts';

/** The level's tiles as a runner meets them: what blocks it and what holds it up. */
export interface Terrain {
  width: number;
  height: number;
  /** 1 for rock, unbroken coral and crates, which a runner never passes through. */
  solid: Uint8Array;
  /** 1 for ledges, which hold a runner landing on them from above. */
  ledge: Uint8Array;
}

/** The terrain of `level` with `broken` coral gone. A crate, ready or shut, is solid. */
export function terrainOf(level: Level, broken: ReadonlySet<number>): Terrain {
  const { width, height } = level;
  const terrain: Terrain = {
    width,
    height,
    solid: new Uint8Array(width * height),
    ledge: new Uint8Array(width * height),
  };
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      terrain.solid[row * width + col] = isSolid(level, broken, col, row) ? 1 : 0;
      terrain.ledge[row * width + col] = isLedge(level, col, row) ? 1 : 0;
    }
  }
  for (const crate of level.clams) terrain.solid[crate.y * width + crate.x] = 1;
  return terrain;
}

/** True where a runner can't be: rock, coral, a crate, or beyond the sides and top. Below the last row is open (a pit). */
export function isSolidTile(terrain: Terrain, col: number, row: number): boolean {
  if (col < 0 || col >= terrain.width || row < 0) return true;
  if (row >= terrain.height) return false;
  return terrain.solid[row * terrain.width + col] === 1;
}

/** True when a runner can stand on top of this tile: solid or a ledge. */
export function holdsRunner(terrain: Terrain, col: number, row: number): boolean {
  if (isSolidTile(terrain, col, row)) return true;
  return row < terrain.height && terrain.ledge[row * terrain.width + col] === 1;
}

/** True for an open tile with something to stand on under it. */
export function isStandTile(terrain: Terrain, col: number, row: number): boolean {
  return !isSolidTile(terrain, col, row) && holdsRunner(terrain, col, row + 1);
}

/** Indices (`y * width + x`) of every stand tile in `terrain`, in reading order. */
export function standIndices(terrain: Terrain): number[] {
  const found: number[] = [];
  for (let row = 0; row < terrain.height; row++) {
    for (let col = 0; col < terrain.width; col++) {
      if (isStandTile(terrain, col, row)) found.push(row * terrain.width + col);
    }
  }
  return found;
}

/**
 * The stand tiles of `level`: open tiles with rock, unbroken coral, a ledge or a crate under them.
 *
 * @returns Tile indices, `y * width + x`.
 */
export function standTiles(level: Level, broken: ReadonlySet<number>): ReadonlySet<number> {
  return new Set(standIndices(terrainOf(level, broken)));
}
