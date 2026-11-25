import { assert, expect, it } from 'vitest';
import { COURSES, DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { ThemeId } from '../../logic/types.ts';
import { FOREST } from './forest.ts';
import { themeFor } from './index.ts';

it('uses the forest theme for Thornwood Trail', () => {
  const thornwood = COURSES.find((course) => course.id === 'thornwood-trail');
  assert(thornwood);
  expect(themeFor(thornwood)).toBe(FOREST);
});

it('names the course and theme when the course has an unknown theme', () => {
  const course = { ...DEFAULT_COURSE, id: 'unknown-theme-course', theme: 'toString' as ThemeId };
  expect(() => themeFor(course)).toThrow('unknown theme toString for course unknown-theme-course');
});
