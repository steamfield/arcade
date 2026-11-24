/**
 * Which of a song's notes carry pitch and what they sound: drums and triangle drops are thumps,
 * not pitches, and an arpeggio sounds each of its offsets.
 */
import type { Channel, NoteEvent, Song } from '../notation.ts';
import { sameBeat } from './timeline.ts';

/** A note with a MIDI pitch rather than a drum. */
export type PitchedNote = NoteEvent & { pitch: number };

/** Whether `note` carries a pitch: not a drum and not a pitch-dropped thump. */
export function isPitched(note: NoteEvent): note is PitchedNote {
  return typeof note.pitch === 'number' && note.drop !== true;
}

/** `channel`'s pitched notes in start order. */
export function pitchedNotes(song: Song, channel: Channel): PitchedNote[] {
  return song.notes
    .filter((note): note is PitchedNote => note.channel === channel && isPitched(note))
    .sort((a, b) => a.start - b.start);
}

/** The distinct MIDI pitches a note sounds: its arpeggio's `pitch + offset`s, or its pitch. */
export function soundingPitches(note: PitchedNote): number[] {
  if (!note.arp) return [note.pitch];
  return [...new Set(note.arp.map((offset) => note.pitch + offset))];
}

/** Whether `note` is sounding at `beat`: started at or before it and not yet ended. */
export function isSoundingAt(note: NoteEvent, beat: number): boolean {
  return (
    (note.start <= beat || sameBeat(note.start, beat)) &&
    beat < note.start + note.length &&
    !sameBeat(beat, note.start + note.length)
  );
}

/** The pitch class, 0 (C) to 11 (B), of a MIDI pitch. */
export function pitchClassOf(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}
