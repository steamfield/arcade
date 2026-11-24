/**
 * The course registry's listed set: course select offers exactly the shipped courses the save rules
 * treat as listed, in menu order, so no course can earn a best and become the last course while
 * missing from the menu. Each listed course also names its zones well enough for the race's section
 * callout.
 */
import { describe, expect, it } from 'vitest';
import { recordRace } from '../records.ts';
import { NEW_GAME } from '../save.ts';
import type { RaceResult } from '../types.ts';
import { COURSES, LISTED_COURSES, levelOf } from './index.ts';

const WIN: RaceResult = { standings: ['player', 'tess', 'squib', 'bo'], playerPlace: 1, playerTicks: 3000 };

/** Whether racing `courseId` once makes it the save's last course, which only a listed course does. */
function becomesLastCourse(courseId: string): boolean {
  return recordRace(NEW_GAME, courseId, 'hard', WIN).lastCourse === courseId;
}

describe('listed courses', () => {
  it('are exactly the shipped courses the save treats as listed, in menu order', () => {
    const savedAsListed = Object.values(COURSES).filter((course) => becomesLastCourse(course.id));

    expect(LISTED_COURSES.map((course) => course.id)).toEqual(savedAsListed.map((course) => course.id));
  });

  it('include Sunlit Shallows, the default course', () => {
    expect(LISTED_COURSES.map((course) => course.id)).toContain('sunlit-shallows');
  });
});

/** The longest section name the race's callout fits in the text face (UI.md "Race HUD"). */
const MAX_SECTION_NAME = 18;

describe('listed course sections', () => {
  it.each(LISTED_COURSES.map((course) => [course.id, course] as const))(
    '%s names its zones in order, from column 0 to inside the level, each short enough for the callout',
    (_, course) => {
      const sections = course.sections ?? [];
      const columns = sections.map((section) => section.fromCol);

      expect(sections.length).toBeGreaterThanOrEqual(3);
      expect(columns[0]).toBe(0);
      expect(columns).toEqual([...new Set(columns)].sort((a, b) => a - b));
      expect(Math.max(...columns)).toBeLessThan(levelOf(course).width);
      for (const { name } of sections) {
        expect(name, name).toBe(name.toUpperCase());
        expect(name.length, name).toBeLessThanOrEqual(MAX_SECTION_NAME);
      }
    },
  );
});
