/**
 * Which track of a course's set each race plays: the next one every race, so a course doesn't
 * repeat the same song race after race. The rotation is session state; nothing is saved.
 */
import { RACE_TRACKS, type SongName, type SongSet } from './songs/index.ts';

/** Picks race tracks. */
export interface TrackRotation {
  /**
   * The track the race starting now plays; each call moves `set` on to its next track.
   *
   * @throws {Error} When `set` has no tracks.
   */
  next(set: SongSet): SongName;
}

/** The tracks of each set, in rotation order. */
export type TrackTable = Readonly<Record<SongSet, readonly SongName[]>>;

/** How a rotation starts. */
export interface TrackRotationOptions {
  /** Offsets every set's first pick, so sessions don't all open on track 1. */
  startAt: number;
  /** A 0-based track every pick plays instead, wrapping round the set; null to rotate. */
  pinned: number | null;
  /** The sets to rotate through; `RACE_TRACKS` when omitted. */
  tracks?: TrackTable;
}

/**
 * The track at `position` of `set`, counting round the set in either direction; fractions round down.
 *
 * @throws {Error} When `set` has no tracks.
 */
function trackAt(tracks: TrackTable, set: SongSet, position: number): SongName {
  const setTracks = tracks[set];
  const count = setTracks.length;
  const index = ((Math.floor(position) % count) + count) % count;
  const track = setTracks[index];
  if (track === undefined) throw new Error(`Race track set "${set}" has no tracks; give it at least one.`);
  return track;
}

/**
 * Creates a rotation in which each set counts its own races. Any finite `startAt` or `pinned`
 * picks a track: negatives count back from the end and fractions round down.
 */
export function createTrackRotation(options: TrackRotationOptions): TrackRotation {
  const tracks = options.tracks ?? RACE_TRACKS;
  const racesBySet = new Map<SongSet, number>();
  return {
    next(set) {
      if (options.pinned !== null) return trackAt(tracks, set, options.pinned);
      const earlier = racesBySet.get(set) ?? 0;
      const track = trackAt(tracks, set, Math.floor(options.startAt) + earlier);
      racesBySet.set(set, earlier + 1);
      return track;
    },
  };
}
