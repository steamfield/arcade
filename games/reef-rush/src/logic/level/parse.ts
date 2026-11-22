/**
 * Turns a course's ASCII rows into a Level. The only place level text is read.
 *
 *   #  rock          C  coral (breakable)   ~  kelp            .  open water
 *   >  <  ^  v       currents pushing in that direction
 *   1  2  3  4       start tiles in RACER_IDS order (player first)
 *   F  finish line (every F sits in one column)
 *   o  pearl         ?  clam                *  urchin          j  jellyfish
 *
 * Start, finish and object tiles are open water. Every row must be the same width.
 */
import type { Level, LevelDef } from '../types.ts';

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

/**
 * Parses a course definition.
 *
 * @throws {LevelError} For ragged rows, unknown characters, missing or duplicate start digits,
 *   no finish tile, finish tiles in more than one column, or a dark zone outside the map or reversed.
 */
export function parseLevel(def: LevelDef): Level {
  void def;
  throw new Error('not implemented');
}
