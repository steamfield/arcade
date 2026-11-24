/**
 * The lead line's shape: range, rests, leaps, crossings with the second pulse, and how often a
 * motif returns.
 */
import type { Song } from '../notation.ts';

/** Facts about pulse1 across the loop. */
export interface LeadFacts {
  /** Highest minus lowest pitch, in semitones. */
  range: number;
  /** Fraction of the loop's beats where pulse1 is silent, 0..1. */
  restShare: number;
  /** The longest stretch of beats pulse1 sounds without a rest. */
  longestUnbrokenBeats: number;
  /** The largest interval between consecutive notes, in semitones. */
  maxLeap: number;
  /** Where a pulse2 note starts above a sounding pulse1 note; bar and beat are 1-based. */
  crossings: { bar: number; beat: number }[];
}

/** A stretch of pulse1 to look for: `bars` bars from 0-based bar `fromBar`. */
export interface Motif {
  fromBar: number;
  bars: number;
}

/** The lead facts of `song`. */
export function leadFacts(_song: Song): LeadFacts {
  throw new Error('not implemented');
}

/**
 * How many times pulse1 states `motif` across the song, the original included: `exact` matches
 * pitches and rhythm, `rhythm` the rhythm alone, `transposed` the rhythm and the intervals.
 */
export function motifStatements(_song: Song, _motif: Motif, _match: 'exact' | 'rhythm' | 'transposed'): number {
  throw new Error('not implemented');
}

/**
 * How alike two sections are across all four channels, by note onsets and pitches: 1 for
 * identical, 0 for nothing shared.
 *
 * @throws {Error} When the song has no section of either name.
 */
export function sectionSimilarity(_song: Song, _a: string, _b: string): number {
  throw new Error('not implemented');
}
