/** The theme registry: the look each `ThemeId` names. */
import type { Course, ThemeId } from '../../logic/types.ts';
import { FOREST } from './forest.ts';
import type { Theme } from './types.ts';

const THEMES: Readonly<Record<ThemeId, Theme>> = { forest: FOREST };

/**
 * The theme `course` names.
 *
 * @throws {Error} When the course names a theme with no entry here; `assertCourse` rejects such a course first.
 */
export function themeFor(course: Course): Theme {
  if (Object.hasOwn(THEMES, course.theme)) return THEMES[course.theme];
  throw new Error(`unknown theme ${course.theme} for course ${course.id}`);
}
