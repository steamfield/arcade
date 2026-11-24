/**
 * Track space to world space. The course path starts at the origin heading -z; a `turn` with
 * positive `angleDeg` turns right along an arc. `frameAt(s)` gives the centreline point at `s` with
 * its ground height and the unit tangent and right vectors on the ground plane; `toWorld` adds a
 * sideways offset `d` and a height. Pure math with no three.js, so Vitest covers it; engine only,
 * since logic never needs world x/z.
 */
import type { Course } from '../logic/types.ts';

/** The centreline at one `s`: position (y from `groundY`), tangent (tx, tz) and right (rx, rz), both unit length. */
export interface TrackFrame {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
}

export interface TrackFrames {
  /** The course length, meters (equals `courseLength`). */
  length: number;
  /** The frame at `s`, clamped to `0..length`. */
  frameAt(s: number): TrackFrame;
  /** The world point at track coordinates `s`, `d`, height `y` (absolute, not above ground). */
  toWorld(s: number, d: number, y: number): { x: number; y: number; z: number };
}

/** Samples `course.path` every `step` meters (and at every segment joint) into frames. */
export function buildTrackFrames(course: Course, step = 1): TrackFrames {
  void course;
  void step;
  throw new Error('not implemented');
}
