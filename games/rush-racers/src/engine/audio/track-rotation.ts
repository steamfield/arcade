/**
 * Which track of a course's set each race plays: the next one every race, so a course doesn't
 * repeat the same song race after race. The rotation is session state; nothing is saved.
 */
import { RACE_TRACKS, type SongName, type SongSet } from './songs/index.ts';

/** Picks race tracks. */
export interface TrackRotation {
  /** The track the race starting now plays; each call moves `set` on to its next track. */
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

/** Creates a rotation in which each set counts its own races. */
export function createTrackRotation(options: TrackRotationOptions): TrackRotation {
  const tracks = options.tracks ?? RACE_TRACKS;
  const racesBySet = new Map<SongSet, number>();
  return {
    next(set) {
      const setTracks = tracks[set];
      if (options.pinned !== null) return setTracks[options.pinned % setTracks.length] as SongName;
      const earlier = racesBySet.get(set) ?? 0;
      racesBySet.set(set, earlier + 1);
      return setTracks[(options.startAt + earlier) % setTracks.length] as SongName;
    },
  };
}
