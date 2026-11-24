/**
 * Which track of a course's set each race plays: the next one every race, so a course doesn't
 * repeat the same song race after race.
 */
import type { SongName, SongSet } from './songs/index.ts';

/** Picks race tracks. */
export interface TrackRotation {
  /** The track the race starting now plays; each call moves `set` on to its next track. */
  next(set: SongSet): SongName;
}

/**
 * Creates a rotation. `startAt` offsets every set's first pick, so sessions don't all open on
 * track 1; `pinned` (0-based) makes every pick that track of the set, wrapping.
 */
export function createTrackRotation(_options: { startAt: number; pinned: number | null }): TrackRotation {
  throw new Error('not implemented');
}
