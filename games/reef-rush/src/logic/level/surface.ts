/**
 * The surface of the sea in a parsed level: checks each surface range against the map, opens the
 * water above it to the air, and makes sure nothing that must swim starts in that air.
 */
import type { Cell, EnemyKind, SurfaceDef, Vec } from '../types.ts';
import { errorAt, LevelError } from './level-error.ts';

/**
 * Copies of the surface ranges, each checked to be a forward range of columns on the map with its
 * surface row inside it (1..height-1, so there is air above and water below).
 *
 * @throws {LevelError} For a range that runs backwards, covers columns off the map, or puts its row
 *   outside 1..height-1.
 */
export function requireSurfacesOnMap(surfaces: readonly SurfaceDef[], width: number, height: number): SurfaceDef[] {
  return surfaces.map(({ from, to, row }, index) => {
    if (from > to) throw new LevelError(`Surface ${index} runs backwards from column ${from} to ${to}`);
    if (from < 0 || to >= width) {
      throw new LevelError(`Surface ${index} covers columns ${from}-${to} but the map has columns 0-${width - 1}`);
    }
    if (row < 1 || row > height - 1) {
      throw new LevelError(`Surface ${index} sits at row ${row} but must be a row from 1 to ${height - 1}`);
    }
    return { from, to, row };
  });
}

/** `cells` with every water tile above a surface's row, in its columns, turned to air. */
export function openToAir(cells: readonly (readonly Cell[])[], surfaces: readonly SurfaceDef[]): Cell[][] {
  return cells.map((row, y) =>
    row.map((cell, x) => (cell === 'water' && surfaces.some((s) => isAbove(s, x, y)) ? 'air' : cell)),
  );
}

function isAbove(surface: SurfaceDef, x: number, y: number): boolean {
  return y < surface.row && x >= surface.from && x <= surface.to;
}

/**
 * Checks that no enemy and no start tile is in the air: enemies never leave the water, and racers
 * start the race swimming.
 *
 * @throws {LevelError} At the first enemy or start tile on an air cell, with its row and col.
 */
export function requireUnderwater(
  cells: readonly (readonly Cell[])[],
  enemies: readonly { kind: EnemyKind; tile: Vec }[],
  starts: readonly Vec[],
): void {
  for (const { kind, tile } of enemies) {
    if (isAir(cells, tile)) throw errorAt(`A ${kind} can't sit in the air above a surface`, tile.y, tile.x);
  }
  starts.forEach((start, slot) => {
    if (isAir(cells, start)) throw errorAt(`Start ${slot + 1} can't sit in the air above a surface`, start.y, start.x);
  });
}

function isAir(cells: readonly (readonly Cell[])[], tile: Vec): boolean {
  return cells[tile.y]?.[tile.x] === 'air';
}
