/**
 * The course registry's listed set: course select offers exactly the shipped courses the save rules
 * treat as listed, in menu order, so no course can earn a best and become the last course while
 * missing from the menu.
 */
import { describe, expect, it } from 'vitest';
import { recordRace } from '../records.ts';
import { NEW_GAME } from '../save.ts';
import type { RaceResult } from '../types.ts';
import { COURSES, LISTED_COURSES } from './index.ts';

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
