/**
 * A song's form: how long its intro and loop last and what sections it has.
 */
import type { Song } from '../notation.ts';
import { loopSpan, sectionSpans } from './timeline.ts';

const SECONDS_PER_MINUTE = 60;

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

/** Seconds that `beats` beats last at the song's tempo scale 1. */
function secondsOf(song: Song, beats: number): number {
  return (beats * SECONDS_PER_MINUTE) / song.bpm;
}

/** The form of `song`. */
export function formOf(song: Song): FormFacts {
  const loop = loopSpan(song);
  return {
    introSeconds: secondsOf(song, loop.from),
    loopSeconds: secondsOf(song, loop.to - loop.from),
    loopBars: (loop.to - loop.from) / song.beatsPerBar,
    sections: sectionSpans(song).map((span) => ({
      name: span.name,
      bars: (span.to - span.from) / song.beatsPerBar,
      seconds: secondsOf(song, span.to - span.from),
      inLoop: span.from >= loop.from,
    })),
  };
}
