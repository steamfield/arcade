/**
 * How a song's notes fit its chord chart and key.
 */
import type { Channel, Song } from '../notation.ts';

/** A note that is neither a tone of the chord under it nor in the key. Bar and beat are 1-based. */
export interface Offender {
  bar: number;
  beat: number;
  /** MIDI note number. */
  pitch: number;
  /** The chord symbol under the note, or null where the chart is silent. */
  chord: string | null;
}

/** How one channel's pitches sit on the chart. */
export interface ChordFit {
  /** Pitches counted (each arpeggio offset counts; drops and drums don't). */
  notes: number;
  /** Of those, how many are tones of the chord covering their start. */
  onChord: number;
  /** Of those, how many are in the song's key. */
  inKey: number;
  offenders: Offender[];
}

/**
 * The fit of `channel`'s pitches. With `strongBeatsOnly`, only notes starting on a bar's first
 * beat (and the third, in bars of four) count.
 *
 * @throws {Error} When `channel` is not a pitched channel.
 */
export function chordFit(_song: Song, _channel: Channel, _options?: { strongBeatsOnly?: boolean }): ChordFit {
  throw new Error('not implemented');
}

/** Whether the bass states each charted bar's chord: the triangle's first pitched, non-drop note of the bar is the root. */
export function bassRoots(_song: Song): { bars: number; rootOnDownbeat: number; offenders: Offender[] } {
  throw new Error('not implemented');
}
