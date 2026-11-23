import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import { courseFromLevel } from '../../logic/test-world.ts';
import { assertCourseAssets } from './course-assets.ts';

describe('engine conformance', () => {
  it.each(Object.values(COURSES).map((course) => [course.id, course] as const))(
    "%s's theme and song resolve",
    (_, course) => {
      expect(() => assertCourseAssets(course)).not.toThrow();
    },
  );

  it('names the course and the missing theme', () => {
    const course = { ...courseFromLevel('#1F#'), theme: 'sky' } as unknown as Course;
    expect(() => assertCourseAssets(course)).toThrow(`Course '${course.id}' names theme 'sky'`);
  });

  it('names the course and the missing song', () => {
    const course = { ...courseFromLevel('#1F#'), song: 'nope' } as unknown as Course;
    expect(() => assertCourseAssets(course)).toThrow(`Course '${course.id}' names song 'nope'`);
  });
});
