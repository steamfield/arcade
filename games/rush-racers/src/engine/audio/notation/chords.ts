/**
 * Chord charts: reads chord symbols and a section's `chords:` lines into the `ChordSpan`s that
 * annotate a song for analysis.
 */
import type { Line } from './types.ts';

/**
 * Reads one chord symbol, e.g. `Dm`, `G7` or `Bbmaj7`, into its root and tones as pitch classes.
 *
 * @throws {Error} Naming the line and the symbol when the symbol is unknown.
 */
export function parseChordSymbol(_symbol: string, _line: Line): { root: number; tones: readonly number[] } {
  throw new Error('not implemented');
}
