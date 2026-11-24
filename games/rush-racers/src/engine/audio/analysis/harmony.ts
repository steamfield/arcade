/**
 * How a song's notes fit its chord chart and key.
 */
import type { Channel, ChordSpan, Song } from '../notation.ts';
import { isSoundingAt, type PitchedNote, pitchClassOf, pitchedNotes, soundingPitches } from './sounding.ts';
import { type BeatSpan, barCount, inSpan, isStrongBeat, positionOf } from './timeline.ts';

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
  /**
   * Bars where the bass is heard and the chart covers the judged instant: the start of the bar's
   * first pitched, non-drop triangle note, or the downbeat when the only bass in the bar is a note
   * held over the bar line. Bars where the bass rests throughout are left out, not missed.
   */
  bars: number;
  /** Of those, how many have the root of the chord under the judged instant. */
  rootOnDownbeat: number;
  /**
   * The judged bass note of each counted bar that isn't the root, against the chord under it. A
   * held note is reported at the downbeat it was judged on.
   */
  offenders: Offender[];
}

/** Where a bar's bass is judged: the note and the beat it is judged at. */
interface BassJudgement {
  note: PitchedNote;
  beat: number;
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

/**
 * The bass note a bar is judged by: the first one starting in it, else one held over its
 * downbeat, else none when the bass rests all bar.
 */
function judgedBass(bass: PitchedNote[], barSpan: BeatSpan): BassJudgement | null {
  const first = bass.find((note) => inSpan(note.start, barSpan));
  if (first) return { note: first, beat: first.start };
  const held = bass.find((note) => isSoundingAt(note, barSpan.from));
  return held ? { note: held, beat: barSpan.from } : null;
}

/** Whether the bass states each charted bar's chord: the bar's judged bass note is the root of the chord under it. */
export function bassRoots(song: Song): BassRoots {
  const bass = pitchedNotes(song, 'triangle');
  const roots: BassRoots = { bars: 0, rootOnDownbeat: 0, offenders: [] };
  for (let bar = 0; bar < barCount(song); bar++) {
    const judged = judgedBass(bass, { from: bar * song.beatsPerBar, to: (bar + 1) * song.beatsPerBar });
    const chord = judged && chordAt(song, judged.beat);
    if (!judged || !chord) continue;
    roots.bars += 1;
    if (pitchClassOf(judged.note.pitch) === chord.root) roots.rootOnDownbeat += 1;
    else roots.offenders.push({ ...positionOf(song, judged.beat), pitch: judged.note.pitch, chord: chord.symbol });
  }
  return roots;
}
