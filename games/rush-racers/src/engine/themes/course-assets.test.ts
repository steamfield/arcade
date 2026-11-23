import { describe, expect, it } from 'vitest';
import { COURSES, LISTED_COURSES } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import { courseFromLevel } from '../../logic/test-world.ts';
import { DISPLAY_FACE, measureText, TEXT_FACE } from '../art/ui/typeface.ts';
import { RESULTS_COURSE_NAME_AT, RESULTS_HEADING } from '../scenes/results-layout.ts';
import { COURSE_NAME_WIDTH } from '../view/course-view.ts';
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

  it('names the course, the glyph and the art key when the theme has no tile for legend art', () => {
    const course = courseFromLevel({
      name: 'wreck',
      ascii: '#1wF#',
      legend: { w: { cell: 'rock', art: 'wreck-hull' } },
    });
    expect(() => assertCourseAssets(course)).toThrow(
      `Course '${course.id}' draws glyph "w" as art 'wreck-hull', which theme 'ocean' has no tile for`,
    );
  });

  it('draws cave rock, stalactites and stalagmites in the ocean theme', () => {
    const course = courseFromLevel({
      name: 'cave',
      ascii: '#1RTLF#',
      legend: {
        R: { cell: 'rock', art: 'caveRock' },
        T: { cell: 'rock', art: 'stalactite' },
        L: { cell: 'rock', art: 'stalagmite' },
      },
    });
    expect(() => assertCourseAssets(course)).not.toThrow();
  });

  it('names the course and the missing song', () => {
    const course = { ...courseFromLevel('#1F#'), song: 'nope' } as unknown as Course;
    expect(() => assertCourseAssets(course)).toThrow(`Course '${course.id}' names song 'nope'`);
  });
});

describe('listed course names', () => {
  const headingLeft = RESULTS_HEADING.x - measureText(DISPLAY_FACE, RESULTS_HEADING.text).width / 2;

  it.each(LISTED_COURSES.map((course) => [course.name] as const))(
    '%s fits its course select row and ends before the results heading',
    (name) => {
      expect(measureText(TEXT_FACE, name).width).toBeLessThanOrEqual(COURSE_NAME_WIDTH);
      // The outline adds a pixel on the right; it must still clear the heading's first glyph.
      const nameRight = RESULTS_COURSE_NAME_AT.x + measureText(TEXT_FACE, name.toUpperCase()).width + 1;
      expect(nameRight).toBeLessThan(headingLeft);
    },
  );
});
