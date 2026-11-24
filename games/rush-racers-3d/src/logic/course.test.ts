import { EventLog } from '@arcade/core';
import { expect, it } from 'vitest';
import { CourseError, logAt, pitAt, surfaceAt, validateCourse } from './course.ts';
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
  parTicks: 900,
  features: [],
};

it.each<{ rule: string; patch: Partial<Course>; problem: RegExp }>([
  {
    rule: 'feature before the start',
    patch: { features: [{ kind: 'crate', s: 4, d: 0 }] },
    problem: /feature 0.*start.*finish/,
  },
  {
    rule: 'log extending past the finish',
    patch: { features: [{ kind: 'log', s: 189.5, d0: 0, d1: 1, height: 1 }] },
    problem: /feature 0.*start.*finish/,
  },
  {
    rule: 'zero-length span',
    patch: { features: [{ kind: 'mud', s0: 30, s1: 30, d0: 0, d1: 1 }] },
    problem: /feature 0.*s0.*s1/,
  },
  {
    rule: 'reversed lateral span',
    patch: { features: [{ kind: 'gust', s0: 30, s1: 40, d0: 1, d1: 0, push: 1 }] },
    problem: /feature 0.*d0.*d1/,
  },
  {
    rule: 'span outside the track width',
    patch: { features: [{ kind: 'mud', s0: 30, s1: 40, d0: -6, d1: 0 }] },
    problem: /feature 0.*width/,
  },
  {
    rule: 'pit within 20 m of the start',
    patch: { features: [{ kind: 'pit', s0: 24, s1: 35, d0: -1, d1: 1 }] },
    problem: /feature 0.*20 m/,
  },
  {
    rule: 'hills out of order',
    patch: {
      hills: [
        { s: 30, y: 0 },
        { s: 25, y: 1 },
      ],
    },
    problem: /hill 1.*sorted/,
  },
  {
    rule: 'turn radius equal to half width plus one',
    patch: { path: [...straight.path, { kind: 'turn', radius: 6, angleDeg: 90 }] },
    problem: /segment 1.*radius/,
  },
  {
    rule: 'overlapping log and pit',
    patch: {
      features: [
        { kind: 'pit', s0: 30, s1: 45, d0: -1, d1: 1 },
        { kind: 'log', s: 29.5, d0: 0, d1: 2, height: 0.5 },
      ],
    },
    problem: /feature 1.*overlap.*pit.*0/,
  },
  { rule: 'finish past the path', patch: { finishS: 201 }, problem: /startS.*finishS.*course length/ },
  { rule: 'start on the finish', patch: { startS: 190 }, problem: /startS.*finishS.*course length/ },
])('reports $rule', ({ patch, problem }) => {
  expect(validateCourse({ ...straight, ...patch })).toEqual([expect.stringMatching(problem)]);
});

it('throws a course error naming the course and the bad feature when building a race', () => {
  const course = { ...straight, features: [{ kind: 'crate', s: 210, d: 0 }] } satisfies Course;
  const build = () => createWorld(new EventLog(), { course, seed: 1, character: 'grit', rivals: false });
  expect(build).toThrow(CourseError);
  expect(build).toThrow(/validation-straight[\s\S]*feature 0/);
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
