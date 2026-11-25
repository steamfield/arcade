import { EventLog } from '@arcade/core';
import { expect, it } from 'vitest';
import { THORNWOOD_TRAIL } from '../../logic/courses/thornwood-trail.ts';
import { createWorld, playerOf } from '../../logic/world.ts';
import { buildTrackFrames } from '../track/track-geometry.ts';
import { TrailDust } from './trail-dust.ts';

it('replays a landing at the same foot position and clears it after 23 ticks', () => {
  const course = THORNWOOD_TRAIL;
  const track = buildTrackFrames(course);
  const racer = playerOf(createWorld(new EventLog(), { course, seed: 5, character: 'grit', rivals: false }));
  const dust = new TrailDust(5);
  const landing = () => {
    dust.emit(racer, track, 90, 6);
    dust.draw(96);
    expect(dust.points.geometry.drawRange.count).toBe(6);
    return Array.from(dust.points.geometry.getAttribute('position').array);
  };
  const first = landing();
  dust.draw(113);
  expect(dust.points.visible).toBe(false);
  dust.clear();
  expect(landing()).toEqual(first);
  const next = new TrailDust(5);
  next.emit(racer, track, 90, 6);
  next.draw(96);
  expect(Array.from(next.points.geometry.getAttribute('position').array)).toEqual(first);
  dust.emit(racer, track, 97, 60);
  dust.draw(97);
  expect(dust.points.geometry.drawRange.count).toBe(48);
});
