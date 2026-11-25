import { configureLogging, createLogger, type LogEntry } from '@arcade/core';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Course } from '../logic/types.ts';
import { courseFor } from './capture-stages.ts';

const first: Course = {
  id: 'short-straight',
  name: 'Short straight',
  theme: 'forest',
  path: [{ kind: 'straight', length: 100 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 95,
  parTicks: 450,
  features: [],
};
const second: Course = { ...first, id: 'wide-straight', name: 'Wide straight', halfWidth: 8 };
const courses = [first, second];
const log = createLogger('course-launch-test');
const entries: LogEntry[] = [];

beforeEach(() => {
  entries.length = 0;
  configureLogging((entry) => entries.push(entry));
});
afterEach(() => configureLogging(() => {}));

it('selects the course named in the launch URL', () => {
  expect(courseFor('?course=short-straight', courses, second, log)).toBe(first);
  expect(entries).toEqual([]);
});

it('warns once with the available ids and returns the fallback course for an unknown id', () => {
  expect(courseFor('?course=missing', courses, second, log)).toBe(second);
  expect(entries).toEqual([
    {
      level: 'warn',
      namespace: 'course-launch-test',
      message: 'unknown ?course=missing; valid courses: short-straight, wide-straight',
    },
  ]);
});

it('uses the fallback course without a warning when the launch URL has no course param', () => {
  expect(courseFor('?scene=race', courses, second, log)).toBe(second);
  expect(entries).toEqual([]);
});
