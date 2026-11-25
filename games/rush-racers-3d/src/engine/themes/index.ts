/** The theme registry: the look each `ThemeId` names. */
import type { Course } from '../../logic/types.ts';
import type { Theme } from './types.ts';

/**
 * The theme `course` names.
 *
 * @throws {Error} When the course names a theme with no entry here; `assertCourse` rejects such a course first.
 */
export function themeFor(_course: Course): Theme {
  throw new Error('not implemented');
}
