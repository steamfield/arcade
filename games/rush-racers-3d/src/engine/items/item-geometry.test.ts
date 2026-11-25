import { expect, it } from 'vitest';
import { groundY } from '../../logic/course.ts';
import { THORNWOOD_TRAIL } from '../../logic/courses/thornwood-trail.ts';
import { buildTrackFrames } from '../track/track-geometry.ts';
import { crateGlowGeometry } from './item-geometry.ts';

it('keeps the whole pickup ring above the 300 m slope break', () => {
  const course = THORNWOOD_TRAIL;
  const track = buildTrackFrames(course);
  const glow = crateGlowGeometry(course, track, 300, -4);
  const positions = glow.getAttribute('position');
  const uv = glow.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const s = 300 + (uv.getY(i) - 0.5) * 3.4;
    expect(positions.getY(i)).toBeCloseTo(groundY(course, s) + 0.045, 4);
  }
  expect(positions.count).toBe(6);
  expect(glow.index?.count).toBe(12);
  expect(crateGlowGeometry(course, track, 300, -4).getAttribute('position').array).toEqual(positions.array);
});
