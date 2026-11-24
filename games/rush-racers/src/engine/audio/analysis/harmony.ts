/**
 * How a song's notes fit its chord chart and key.
 */
import type { Channel, ChordSpan, Song } from '../notation.ts';
import { type PitchedNote, pitchClassOf, pitchedNotes, soundingPitches } from './sounding.ts';
import { barCount, inSpan, isStrongBeat, positionOf } from './timeline.ts';

const PITCHED_CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle'];

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
  /**
   * Pitches that are neither, in song order. A pitch is judged only against the annotations
   * present: with no chord over it and no key, it can't be an offender.
   */
  offenders: Offender[];
}

/** Whether the bass states each charted bar's chord. */
export interface BassRoots {
  /** Bars whose downbeat the chord chart covers. */
  bars: number;
  /** Of those, how many have the chord's root as the bass's first pitched note in the bar. */
  rootOnDownbeat: number;
  /** The first bass note of each charted bar that isn't the root; silent bars have none. */
  offenders: Offender[];
}

/** The chord span covering `beat`, or null where the chart is silent. */
function chordAt(song: Song, beat: number): ChordSpan | null {
  return song.chords.find((span) => inSpan(beat, { from: span.start, to: span.start + span.length })) ?? null;
}

function offenderAt(song: Song, note: PitchedNote, pitch: number, chord: ChordSpan | null): Offender {
  return { ...positionOf(song, note.start), pitch, chord: chord?.symbol ?? null };
}

/**
 * The fit of `channel`'s pitches. With `strongBeatsOnly`, only notes starting on a bar's first
 * beat (and the third, in bars of four) count.
 *
 * @throws {Error} When `channel` is not a pitched channel.
 */
export function chordFit(song: Song, channel: Channel, options: { strongBeatsOnly?: boolean } = {}): ChordFit {
  if (!PITCHED_CHANNELS.includes(channel)) {
    throw new Error(`Channel "${channel}" has no pitches; chordFit takes pulse1, pulse2 or triangle.`);
  }
  const fit: ChordFit = { notes: 0, onChord: 0, inKey: 0, offenders: [] };
  for (const note of pitchedNotes(song, channel)) {
    if (options.strongBeatsOnly && !isStrongBeat(song, note.start)) continue;
    const chord = chordAt(song, note.start);
    for (const pitch of soundingPitches(note)) {
      const pitchClass = pitchClassOf(pitch);
      const isChordTone = chord?.tones.includes(pitchClass) ?? false;
      const isKeyTone = song.key?.scale.includes(pitchClass) ?? false;
      fit.notes += 1;
      if (isChordTone) fit.onChord += 1;
      if (isKeyTone) fit.inKey += 1;
      const judged = chord !== null || song.key !== null;
      if (judged && !isChordTone && !isKeyTone) fit.offenders.push(offenderAt(song, note, pitch, chord));
    }
  }
  return fit;
}

/** Whether the bass states each charted bar's chord: the triangle's first pitched, non-drop note of the bar is the root. */
export function bassRoots(song: Song): BassRoots {
  const bass = pitchedNotes(song, 'triangle');
  const roots: BassRoots = { bars: 0, rootOnDownbeat: 0, offenders: [] };
  for (let bar = 0; bar < barCount(song); bar++) {
    const barSpan = { from: bar * song.beatsPerBar, to: (bar + 1) * song.beatsPerBar };
    const chord = chordAt(song, barSpan.from);
    if (!chord) continue;
    roots.bars += 1;
    const first = bass.find((note) => inSpan(note.start, barSpan));
    if (!first) continue;
    if (pitchClassOf(first.pitch) === chord.root) roots.rootOnDownbeat += 1;
    else roots.offenders.push(offenderAt(song, first, first.pitch, chord));
  }
  return roots;
}
