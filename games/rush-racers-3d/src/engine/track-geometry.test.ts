import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { courseLength, groundY } from '../logic/course.ts';
import { THORNWOOD_TRAIL } from '../logic/courses/thornwood-trail.ts';
import type { Course } from '../logic/types.ts';
import { createWorld, playerOf } from '../logic/world.ts';
import { CameraRig } from './camera-rig.ts';
import { buildTrackFrames } from './track-geometry.ts';

function flatCourse(path: Course['path']): Course {
  return { ...THORNWOOD_TRAIL, path, hills: [], features: [], startS: 0, finishS: 10 };
}

describe('track frames', () => {
  it('keeps positions and tangents continuous at every segment joint', () => {
    const course = THORNWOOD_TRAIL;
    const track = buildTrackFrames(course, 3);
    for (let i = 1; i < course.path.length; i++) {
      const s = courseLength({ ...course, path: course.path.slice(0, i) });
      const before = track.frameAt(s - 1e-7);
      const after = track.frameAt(s + 1e-7);
      for (const key of ['x', 'y', 'z', 'tx', 'tz'] as const) {
        expect(Math.abs(before[key] - after[key]), `joint ${i}, ${key}`).toBeLessThan(1e-6);
      }
    }
  });

  it('has the same total length as the logic course', () => {
    expect(buildTrackFrames(THORNWOOD_TRAIL).length).toBe(courseLength(THORNWOOD_TRAIL));
  });

  it('ends a radius-20 quarter turn 20 m to the right, heading right', () => {
    const track = buildTrackFrames(flatCourse([{ kind: 'turn', angleDeg: 90, radius: 20 }]));
    const { x, y, z, tx, tz } = track.frameAt(track.length);
    expect(x).toBeCloseTo(20, 9);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-20, 9);
    expect(tx).toBeCloseTo(1, 9);
    expect(tz).toBeCloseTo(0, 9);
  });

  it('follows a straight from the origin down the negative z axis', () => {
    const track = buildTrackFrames(flatCourse([{ kind: 'straight', length: 10 }]));
    expect(track.frameAt(0)).toEqual({ x: 0, y: 0, z: 0, tx: 0, tz: -1, rx: 1, rz: 0 });
    expect(track.toWorld(10, 0, 0)).toEqual({ x: 0, y: 0, z: -10 });
  });

  it('interpolates the centreline between samples', () => {
    const track = buildTrackFrames(flatCourse([{ kind: 'turn', angleDeg: 90, radius: 20 }]), 8);
    const a = track.frameAt(0);
    const b = track.frameAt(8);
    const mid = track.frameAt(4);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2, 9);
    expect(mid.z).toBeCloseTo((a.z + b.z) / 2, 9);
    expect(Math.atan2(mid.tx, -mid.tz)).toBeCloseTo(0.2, 9);
  });

  it('keeps tangent and right unit length and perpendicular between samples', () => {
    const track = buildTrackFrames(THORNWOOD_TRAIL);
    for (const s of [0, 145.3, 285.8, 814.6, track.length]) {
      const { tx, tz, rx, rz } = track.frameAt(s);
      expect(Math.hypot(tx, tz)).toBeCloseTo(1, 9);
      expect(Math.hypot(rx, rz)).toBeCloseTo(1, 9);
      expect(tx * rx + tz * rz).toBeCloseTo(0, 9);
    }
  });

  it('clamps positions before the start and past the end', () => {
    const track = buildTrackFrames(THORNWOOD_TRAIL);
    expect(track.frameAt(-10)).toEqual(track.frameAt(0));
    expect(track.frameAt(track.length + 10)).toEqual(track.frameAt(track.length));
  });

  it('keeps the height equal to the logic ground on and between hill knots', () => {
    const track = buildTrackFrames(THORNWOOD_TRAIL, 7);
    for (const s of [0, 150, 175.3, 260.2, 609.4, 860, 1000.8, 1140]) {
      expect(track.frameAt(s).y).toBeCloseTo(groundY(THORNWOOD_TRAIL, s), 9);
    }
  });

  it('offsets along the right vector on a curve and uses the supplied absolute height', () => {
    const track = buildTrackFrames(THORNWOOD_TRAIL);
    const { x, z, tx, tz } = track.frameAt(155.3);
    const point = track.toWorld(155.3, 2, 12);
    expect(point.x - x).toBeCloseTo(-2 * tz, 9);
    expect(point.z - z).toBeCloseTo(2 * tx, 9);
    expect(point.y).toBe(12);
  });
});

it('holds its trail-relative camera height when the racer jumps under the start arch', () => {
  const course = THORNWOOD_TRAIL;
  const world = createWorld(new EventLog(), { course, seed: 1, character: 'grit', rivals: false });
  const racer = playerOf(world);
  racer.s += 9;
  const rig = new CameraRig(buildTrackFrames(course));
  rig.tick(racer, true);
  const groundedCameraY = rig.camera.position.y;

  racer.grounded = false;
  racer.y += 2.4;
  for (let i = 0; i < 12; i++) rig.tick(racer);

  expect(rig.camera.position.y).toBeCloseTo(groundedCameraY, 6);
});
