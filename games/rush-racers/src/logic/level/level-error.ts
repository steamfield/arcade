/**
 * The one error bad course data raises, located at the tile at fault when there is one. Its own
 * module so every part of level parsing can throw it without importing the parser.
 */
import type { Cell } from '../types.ts';

/** A course that can't be parsed or raced. `row` and `col` are 0-based and null when the whole level is at fault. */
export class LevelError extends Error {
  readonly row: number | null;
  readonly col: number | null;

  constructor(message: string, row: number | null = null, col: number | null = null) {
    super(message);
    this.name = 'LevelError';
    this.row = row;
    this.col = col;
  }
}

/** A LevelError at (row, col) whose message ends with that location. */
export function errorAt(what: string, row: number, col: number): LevelError {
  return new LevelError(`${what} at row ${row}, col ${col}`, row, col);
}

/** Read a tile from the parsed grid or report the allowed coordinates at the bad location. */
export function requireTile(cells: readonly (readonly Cell[])[], what: string, row: number, col: number): Cell {
  const cell = Number.isInteger(row) && Number.isInteger(col) ? cells[row]?.[col] : undefined;
  if (cell !== undefined) return cell;
  throw errorAt(
    `${what}: expected integer coordinates in cols 0–${(cells[0]?.length ?? 0) - 1} and rows 0–${cells.length - 1}, got (${col}, ${row})`,
    row,
    col,
  );
}
