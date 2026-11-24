/**
 * Track space to world space. The course path starts at the origin heading -z; a `turn` with
 * positive `angleDeg` turns right along an arc. `frameAt(s)` gives the centreline point at `s` with
 * its ground height and the unit tangent and right vectors on the ground plane; `toWorld` adds a
 * sideways offset `d` and a height. Pure math with no three.js, so Vitest covers it; engine only,
 * since logic never needs world x/z.
 */
import { groundY } from '../logic/course.ts';
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
  /** The frame at `s`, clamped to `0..length`. Pass an output frame to reuse it. */
  frameAt(s: number, out?: TrackFrame): TrackFrame;
  /** The world point at track coordinates `s`, `d`, height `y` (absolute, not above ground). */
  toWorld(s: number, d: number, y: number): { x: number; y: number; z: number };
}

/** Samples `course.path` every `step` meters (and at every segment joint) into frames. */
export function buildTrackFrames(course: Course, step = 1): TrackFrames {
  if (!Number.isFinite(step) || step <= 0) throw new RangeError('Track sample spacing must be positive and finite');

  const origin = { s: 0, x: 0, z: 0, heading: 0 };
  const samples = [origin];
  let last = origin;

  for (const segment of course.path) {
    const length =
      segment.kind === 'straight' ? segment.length : (segment.radius * Math.abs(segment.angleDeg) * Math.PI) / 180;
    const curvature = segment.kind === 'turn' ? Math.sign(segment.angleDeg) / segment.radius : 0;
    const { s, x, z, heading } = last;
    for (let distance = Math.min(step, length); distance > 0; distance = Math.min(distance + step, length)) {
      const angle = heading + curvature * distance;
      last = {
        s: s + distance,
        x: x + (curvature ? (Math.cos(heading) - Math.cos(angle)) / curvature : distance * Math.sin(heading)),
        z: z + (curvature ? (Math.sin(heading) - Math.sin(angle)) / curvature : -distance * Math.cos(heading)),
        heading: angle,
      };
      samples.push(last);
      if (distance === length) break;
    }
  }

  const length = last.s;
  function frameAt(s: number, out: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 }): TrackFrame {
    const at = Math.max(0, Math.min(length, s));
    let lo = 0;
    let hi = samples.length - 1;
    let a = origin;
    let b = last;
    while (hi - lo > 1) {
      const mid = (hi + lo) >>> 1;
      const sample = samples[mid];
      if (!sample) throw new RangeError('Track sample index out of bounds');
      if (sample.s <= at) {
        lo = mid;
        a = sample;
      } else {
        hi = mid;
        b = sample;
      }
    }
    const t = a === b ? 0 : (at - a.s) / (b.s - a.s);
    const heading = a.heading + (b.heading - a.heading) * t;
    out.x = a.x + (b.x - a.x) * t;
    out.y = groundY(course, at);
    out.z = a.z + (b.z - a.z) * t;
    out.tx = Math.sin(heading);
    out.tz = -Math.cos(heading);
    out.rx = -out.tz;
    out.rz = out.tx;
    return out;
  }

  return {
    length,
    frameAt,
    toWorld(s, d, y) {
      const { x, z, rx, rz } = frameAt(s);
      return { x: x + d * rx, y, z: z + d * rz };
    },
  };
}
