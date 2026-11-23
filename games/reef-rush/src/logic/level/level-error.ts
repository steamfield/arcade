/**
 * The one error bad course data raises, located at the tile at fault when there is one. Its own
 * module so every part of level parsing can throw it without importing the parser.
 */

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
