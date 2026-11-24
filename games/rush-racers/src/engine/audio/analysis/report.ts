/**
 * A plain-text report of a song for composers and reviewers: form, chords, fit, lead and level.
 */
import type { Song } from '../notation.ts';

/** The report for `song`. */
export function describeSong(_song: Song): string {
  throw new Error('not implemented');
}
