/**
 * A song's loudest instant, estimated from voice levels without rendering audio.
 */
import type { Song } from '../notation.ts';
import { isSoundingAt } from './sounding.ts';
import { positionOf } from './timeline.ts';

/** The loudest instant: the summed level and its 1-based bar and beat. */
export interface PeakLevel {
  /** Sum of `voice.level * velocity` over every note sounding then; 0 for a silent song. */
  level: number;
  bar: number;
  beat: number;
}

/** The summed level of every note sounding at `beat`. */
function levelAt(song: Song, beat: number): number {
  return song.notes
    .filter((note) => isSoundingAt(note, beat))
    .reduce((sum, note) => sum + song.voices[note.channel].level * note.velocity, 0);
}

/**
 * The largest sum over channels of `voice.level * velocity` of notes sounding together, and where
 * (1-based). Sampled at every note onset; the earliest instant wins a tie.
 */
export function peakLevel(song: Song): PeakLevel {
  const onsets = [...new Set(song.notes.map((note) => note.start))].sort((a, b) => a - b);
  let peak = { level: 0, beat: 0 };
  for (const onset of onsets) {
    const level = levelAt(song, onset);
    if (level > peak.level) peak = { level, beat: onset };
  }
  return { level: peak.level, ...positionOf(song, peak.beat) };
}
