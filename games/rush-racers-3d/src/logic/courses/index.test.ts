import { expect, it } from 'vitest';
import { COURSES, courseById, DEFAULT_COURSE } from './index.ts';
import { THORNWOOD_TRAIL } from './thornwood-trail.ts';

it('looks up Thornwood Trail by id', () => {
  expect(courseById('thornwood-trail')).toBe(THORNWOOD_TRAIL);
});

it('returns null for an unknown course id', () => {
  expect(courseById('unknown-course')).toBeNull();
});

it('gives every registered course a unique id', () => {
  expect(new Set(COURSES.map(({ id }) => id)).size).toBe(COURSES.length);
});

it('includes the default course in the registry', () => {
  expect(COURSES).toContain(DEFAULT_COURSE);
});
