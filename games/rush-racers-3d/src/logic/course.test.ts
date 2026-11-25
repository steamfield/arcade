import { EventLog } from '@arcade/core';
import { expect, it } from 'vitest';
import { assertCourse, CourseError, logAt, pitAt, surfaceAt, validateCourse } from './course.ts';
import { RUN } from './tuning.ts';
import type { Course } from './types.ts';
import { createWorld } from './world.ts';

const straight: Course = {
  id: 'validation-straight',
  name: 'Straight',
  path: [{ kind: 'straight', length: 200 }],
  halfWidth: 5,
  hills: [],
  startS: 5,
  finishS: 190,
  theme: 'forest',
  parTicks: 900,
  features: [],
};

it.each<{ rule: string; patch: Partial<Course>; problem: string }>([
  {
    rule: 'feature before the start',
    patch: { features: [{ kind: 'crate', s: 4, d: 0 }] },
    problem: 'feature 0 (crate) is at s 4, outside [5, 190]',
  },
  {
    rule: 'log extending past the finish',
    patch: { features: [{ kind: 'log', s: 189.5, d0: 0, d1: 1, height: 1 }] },
    problem: 'feature 0 (log) spans s 189.5-190.5, outside [5, 190]',
  },
  {
    rule: 'zero-length span',
    patch: { features: [{ kind: 'mud', s0: 30, s1: 30, d0: 0, d1: 1 }] },
    problem: 'feature 0 (mud) has s0 30, s1 30 and must satisfy s0 < s1',
  },
  {
    rule: 'reversed lateral span',
    patch: { features: [{ kind: 'gust', s0: 30, s1: 40, d0: 1, d1: 0, push: 1 }] },
    problem: 'feature 0 (gust) has d0 1, d1 0 and must satisfy d0 < d1',
  },
  {
    rule: 'span outside the track width',
    patch: { features: [{ kind: 'mud', s0: 30, s1: 40, d0: -6, d1: 0 }] },
    problem: 'feature 0 (mud) spans d -6 to 0, outside track width [-5, 5]',
  },
  {
    rule: 'pit within 20 m of the start',
    patch: { features: [{ kind: 'pit', s0: 24, s1: 35, d0: -1, d1: 1 }] },
    problem: 'feature 0 (pit) starts at s 24, less than 20 m after startS 5 (minimum s 25)',
  },
  {
    rule: 'hills out of order',
    patch: {
      hills: [
        { s: 30, y: 0 },
        { s: 25, y: 1 },
      ],
    },
    problem: 'hill 1 at s 25 comes before hill 0 at s 30',
  },
  {
    rule: 'turn radius equal to half width plus one',
    patch: { path: [...straight.path, { kind: 'turn', radius: 6, angleDeg: 90 }] },
    problem: 'segment 1 radius 6 must exceed halfWidth + 1 = 6',
  },
  {
    rule: 'overlapping log and pit',
    patch: {
      features: [
        { kind: 'pit', s0: 30, s1: 45, d0: -1, d1: 1 },
        { kind: 'log', s: 29.5, d0: 0, d1: 2, height: 0.5 },
      ],
    },
    problem: 'feature 1 (log) at s 29.5-30.5, d 0 to 2 overlaps feature 0 (pit) at s 30-45, d -1 to 1',
  },
  {
    rule: 'finish past the path',
    patch: { finishS: 201 },
    problem: 'startS 5, finishS 201 must satisfy startS < finishS <= course length 200',
  },
  {
    rule: 'start on the finish',
    patch: { startS: 190 },
    problem: 'startS 190, finishS 190 must satisfy startS < finishS <= course length 200',
  },
])('reports $rule', ({ patch, problem }) => {
  expect(validateCourse({ ...straight, ...patch })).toEqual([problem]);
});

it('throws a course error naming the course and the bad feature when building a race', () => {
  const course = { ...straight, features: [{ kind: 'crate', s: 210, d: 0 }] } satisfies Course;
  const build = () => createWorld(new EventLog(), { course, seed: 1, character: 'grit', rivals: false });
  expect(build).toThrow(CourseError);
  expect(build).toThrow('course validation-straight is invalid:\nfeature 0 (crate) is at s 210, outside [5, 190]');
});

it('rejects an unknown theme and names the course and theme', () => {
  const course = { ...straight, theme: 'unknown-theme' as Course['theme'] };
  const problem = 'course validation-straight has unknown theme unknown-theme';
  const assert = () => assertCourse(course);
  expect(validateCourse(course)).toEqual([problem]);
  expect(assert).toThrow(CourseError);
  expect(assert).toThrow(`course validation-straight is invalid:\n${problem}`);
});

it('queries pits, mud, gusts and log footprints at their boundaries', () => {
  const pit = { kind: 'pit', s0: 30, s1: 35, d0: -2, d1: 2 } satisfies Course['features'][number];
  const log = { kind: 'log', s: 60, d0: -2, d1: 2, height: 1 } satisfies Course['features'][number];
  const course: Course = {
    ...straight,
    features: [
      pit,
      log,
      { kind: 'mud', s0: 25, s1: 40, d0: -5, d1: 5 },
      { kind: 'gust', s0: 28, s1: 38, d0: -5, d1: 5, push: -3 },
      { kind: 'gust', s0: 29, s1: 37, d0: -5, d1: 5, push: 1 },
    ],
  };
  expect(pitAt(course, 30, 0)).toBe(pit);
  expect(pitAt(course, 35, 0)).toBeNull();
  expect(pitAt(course, 34, 3)).toBeNull();
  expect(surfaceAt(course, 30, 0)).toEqual({ kind: 'none', push: -2 });
  expect(surfaceAt(course, 35, 0)).toEqual({ kind: 'mud', push: -2 });
  expect(surfaceAt(course, 40, 0)).toEqual({ kind: 'ground', push: 0 });
  expect(logAt(course, 60, 0)).toBe(log);
  expect(logAt(course, 60 + RUN.logDepth, 0)).toBeNull();
  expect(logAt(course, 60, 3)).toBeNull();
});
