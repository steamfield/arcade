/**
 * The theme registry: every theme by id, and the lookup scenes use to draw a course.
 */
import type { Course, ThemeId } from '../../logic/courses/types.ts';
import { OCEAN_THEME } from './ocean.ts';
import type { Theme } from './types.ts';

export { defineTheme } from './define.ts';

/** Every theme by id. */
export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  ocean: OCEAN_THEME,
};

/** The theme `course` is drawn with. */
export function themeFor(course: Course): Theme {
  return THEMES[course.theme];
}
