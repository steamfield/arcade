/**
 * Where a beat falls in a song: its 1-based bar and beat, whether it is a strong beat, and which
 * section and loop span it belongs to. Everything is in the song's own beats.
 */
import type { Song } from '../notation.ts';

/** Beat positions closer than this are the same instant; triplets don't sum exactly in floats. */
const SAME_BEAT = 1e-6;
const BEAT_DECIMALS = 1e6;

/** A position for people: 1-based bar and 1-based beat within it (fractional between beats). */
export interface BarBeat {
  bar: number;
  beat: number;
}

/** A stretch of the song in beats, `from` inclusive and `to` exclusive. */
export interface BeatSpan {
  from: number;
  to: number;
}

/** A named section and the beats it covers. */
export interface SectionSpan extends BeatSpan {
  name: string;
}

/** Whether two beat positions are the same instant. */
export function sameBeat(a: number, b: number): boolean {
  return Math.abs(a - b) < SAME_BEAT;
}

/** Whether `beat` lies in `span`, allowing for float error at both ends. */
export function inSpan(beat: number, span: BeatSpan): boolean {
  return beat > span.from - SAME_BEAT && beat < span.to - SAME_BEAT;
}

/** `beat` rounded to the precision positions are compared at, so it can serve as a key. */
export function roundBeat(beat: number): number {
  return Math.round(beat * BEAT_DECIMALS) / BEAT_DECIMALS;
}

/** The 0-based bar `beat` falls in. */
export function barIndexOf(song: Song, beat: number): number {
  return Math.floor(beat / song.beatsPerBar + SAME_BEAT);
}

/** The 1-based bar and beat of a beat position. */
export function positionOf(song: Song, beat: number): BarBeat {
  const bar = barIndexOf(song, beat);
  return { bar: bar + 1, beat: roundBeat(beat - bar * song.beatsPerBar) + 1 };
}

/** Whether `beat` is a bar's first beat or, in bars of four beats, its third. */
export function isStrongBeat(song: Song, beat: number): boolean {
  const withinBar = beat - barIndexOf(song, beat) * song.beatsPerBar;
  return sameBeat(withinBar, 0) || (song.beatsPerBar === 4 && sameBeat(withinBar, 2));
}

/** The number of bars in the song. */
export function barCount(song: Song): number {
  return Math.round(song.lengthBeats / song.beatsPerBar);
}

/** The beats one pass of the loop covers; the whole song for a one-shot. */
export function loopSpan(song: Song): BeatSpan {
  return { from: song.loopStart ?? 0, to: song.lengthBeats };
}

/** Every section with the beats it covers, in song order; each runs to the next or the end. */
export function sectionSpans(song: Song): SectionSpan[] {
  return song.sections.map((section, index) => ({
    name: section.name,
    from: section.bar * song.beatsPerBar,
    to: (song.sections[index + 1]?.bar ?? barCount(song)) * song.beatsPerBar,
  }));
}

/**
 * The beats the section called `name` covers.
 *
 * @throws {Error} When the song has no section of that name; the message lists the ones it has.
 */
export function sectionSpan(song: Song, name: string): SectionSpan {
  const spans = sectionSpans(song);
  const span = spans.find((candidate) => candidate.name === name);
  if (span) return span;
  const known = spans.length > 0 ? spans.map((candidate) => candidate.name).join(', ') : 'none';
  throw new Error(`Song "${song.name}" has no section "${name}"; its sections are ${known}.`);
}
