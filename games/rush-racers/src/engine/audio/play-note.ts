/**
 * Turns one note event into synth calls at a time on the audio clock. The sequencer and the
 * offline renderer both play songs through it.
 */
import type { NoteEvent, Song } from './notation.ts';
import type { Synth } from './synth.ts';

/**
 * Plays `note` of `song` at `time` (context seconds) into `out`, on its channel's voice.
 *
 * @throws {Error} When WebAudio refuses to create or schedule a node.
 */
export function playNote(
  _synth: Synth,
  _out: AudioNode,
  _song: Song,
  _note: NoteEvent,
  _time: number,
  _secondsPerBeat: number,
): void {
  throw new Error('not implemented');
}
