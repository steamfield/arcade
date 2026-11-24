/**
 * A song's form: how long its intro and loop last and what sections it has.
 */
import type { Song } from '../notation.ts';

/** One section of a song. */
export interface SectionFacts {
  name: string;
  bars: number;
  seconds: number;
  /** Whether the section is inside the loop (always true for a one-shot). */
  inLoop: boolean;
}

/** A song's timing and sections at its own tempo. */
export interface FormFacts {
  /** Seconds before the loop point; 0 for a one-shot. */
  introSeconds: number;
  /** Seconds of one pass of the loop; the whole length for a one-shot. */
  loopSeconds: number;
  loopBars: number;
  sections: SectionFacts[];
}

/** The form of `song`. */
export function formOf(_song: Song): FormFacts {
  throw new Error('not implemented');
}
