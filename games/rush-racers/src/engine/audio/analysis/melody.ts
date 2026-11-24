/**
 * The lead line's shape: range, rests, leaps, crossings with the second pulse, and how often a
 * motif returns.
 */
import type { NoteEvent, Song } from '../notation.ts';
import { isSoundingAt, type PitchedNote, pitchedNotes } from './sounding.ts';
import {
  type BarBeat,
  type BeatSpan,
  inSpan,
  loopSpan,
  positionOf,
  roundBeat,
  sameBeat,
  sectionSpan,
} from './timeline.ts';

/** Facts about pulse1 across the loop. */
export interface LeadFacts {
  /** Highest minus lowest pitch, in semitones; 0 with no notes. */
  range: number;
  /** Fraction of the loop's beats where pulse1 is silent, 0..1. */
  restShare: number;
  /** The longest stretch of beats pulse1 sounds without a rest. */
  longestUnbrokenBeats: number;
  /** The largest interval between consecutive notes, in semitones. */
  maxLeap: number;
  /** Where a pulse2 note starts above a sounding pulse1 note; bar and beat are 1-based. */
  crossings: BarBeat[];
}

/** A stretch of pulse1 to look for: `bars` bars from 0-based bar `fromBar`. */
export interface Motif {
  fromBar: number;
  bars: number;
}

/** What a motif statement must share with the original. */
export type MotifMatch = 'exact' | 'rhythm' | 'transposed';

/** Notes starting inside `span`, in start order. */
function startingIn<T extends NoteEvent>(notes: T[], span: BeatSpan): T[] {
  return notes.filter((note) => inSpan(note.start, span));
}

/** The stretches of `span` where some note sounds, merged where notes touch or overlap. */
function soundingRuns(notes: NoteEvent[], span: BeatSpan): BeatSpan[] {
  const clipped = notes
    .map((note) => ({ from: Math.max(note.start, span.from), to: Math.min(note.start + note.length, span.to) }))
    .filter((run) => run.to > run.from)
    .sort((a, b) => a.from - b.from);
  const runs: BeatSpan[] = [];
  for (const run of clipped) {
    const last = runs.at(-1);
    if (last && (run.from < last.to || sameBeat(run.from, last.to))) last.to = Math.max(last.to, run.to);
    else runs.push({ ...run });
  }
  return runs;
}

function largestLeap(notes: PitchedNote[]): number {
  return notes.slice(1).reduce((leap, note, index) => {
    const previous = notes[index]?.pitch ?? note.pitch;
    return Math.max(leap, Math.abs(note.pitch - previous));
  }, 0);
}

/** Pulse2 onsets in `span` that start above a pulse1 note sounding at that instant. */
function crossingsIn(song: Song, span: BeatSpan): BarBeat[] {
  const lead = pitchedNotes(song, 'pulse1');
  return startingIn(pitchedNotes(song, 'pulse2'), span)
    .filter((counter) => lead.some((note) => isSoundingAt(note, counter.start) && counter.pitch > note.pitch))
    .map((counter) => positionOf(song, counter.start));
}

/** The lead facts of `song`, measured over one pass of the loop (the whole of a one-shot). */
export function leadFacts(song: Song): LeadFacts {
  const loop = loopSpan(song);
  const lead = pitchedNotes(song, 'pulse1');
  const inLoop = startingIn(lead, loop);
  const pitches = inLoop.map((note) => note.pitch);
  const runs = soundingRuns(lead, loop);
  const soundingBeats = runs.reduce((sum, run) => sum + run.to - run.from, 0);
  const loopBeats = loop.to - loop.from;
  return {
    range: pitches.length > 0 ? Math.max(...pitches) - Math.min(...pitches) : 0,
    restShare: loopBeats > 0 ? 1 - soundingBeats / loopBeats : 0,
    longestUnbrokenBeats: runs.reduce((longest, run) => Math.max(longest, run.to - run.from), 0),
    maxLeap: largestLeap(inLoop),
    crossings: crossingsIn(song, loop),
  };
}

/** Whether `candidate` states `motif` under `match`: same onsets and lengths, then pitches as asked. */
function statesMotif(candidate: PitchedNote[], motif: PitchedNote[], match: MotifMatch): boolean {
  const [firstCandidate, firstMotif] = [candidate[0], motif[0]];
  if (!firstCandidate || !firstMotif || candidate.length !== motif.length) return false;
  const transposition = firstCandidate.pitch - firstMotif.pitch;
  return motif.every((want, index) => {
    const note = candidate[index];
    if (!note) return false;
    const sameRhythm =
      sameBeat(note.start - firstCandidate.start, want.start - firstMotif.start) && sameBeat(note.length, want.length);
    if (!sameRhythm || match === 'rhythm') return sameRhythm;
    return note.pitch === want.pitch + (match === 'exact' ? 0 : transposition);
  });
}

/**
 * How many times pulse1 states `motif` across the song, the original included: `exact` matches
 * pitches and rhythm, `rhythm` the rhythm alone, `transposed` the rhythm and the intervals.
 * Statements don't overlap: the search resumes after each one. A motif with no notes counts 0.
 */
export function motifStatements(song: Song, motif: Motif, match: MotifMatch): number {
  const lead = pitchedNotes(song, 'pulse1');
  const original = startingIn(lead, {
    from: motif.fromBar * song.beatsPerBar,
    to: (motif.fromBar + motif.bars) * song.beatsPerBar,
  });
  if (original.length === 0) return 0;
  let statements = 0;
  let index = 0;
  while (index + original.length <= lead.length) {
    if (statesMotif(lead.slice(index, index + original.length), original, match)) {
      statements += 1;
      index += original.length;
    } else {
      index += 1;
    }
  }
  return statements;
}

/** The section's onsets as `channel@offset` keys, and with pitch or drum as `channel@offset:pitch`. */
function onsetKeys(song: Song, name: string): { rhythm: Set<string>; notes: Set<string> } {
  const span = sectionSpan(song, name);
  const rhythm = new Set<string>();
  const notes = new Set<string>();
  for (const note of startingIn(song.notes, span)) {
    const onset = `${note.channel}@${roundBeat(note.start - span.from)}`;
    rhythm.add(onset);
    notes.add(`${onset}:${note.pitch}`);
  }
  return { rhythm, notes };
}

/** Shared over total of two sets; two empty sets are identical. */
function jaccard(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((key) => b.has(key)).length;
  const total = a.size + b.size - shared;
  return total === 0 ? 1 : shared / total;
}

/**
 * How alike two sections are across all four channels, by note onsets and pitches: 1 for
 * identical, 0 for nothing shared. It is the mean of two overlaps, onsets per channel alone and
 * onsets with their pitch or drum, so a section that keeps the rhythm but changes notes scores
 * between the two.
 *
 * @throws {Error} When the song has no section of either name.
 */
export function sectionSimilarity(song: Song, a: string, b: string): number {
  const first = onsetKeys(song, a);
  const second = onsetKeys(song, b);
  return (jaccard(first.rhythm, second.rhythm) + jaccard(first.notes, second.notes)) / 2;
}
