/**
 * The courses a host may pick in a room, from the courses course select lists and the course in force.
 */
import type { Course } from '../../logic/courses/types.ts';

/**
 * The course ids a host may pick in a room: the listed courses, plus `current` when it is an
 * unlisted one (a `?course=` such as Run Test), so a test can race it online.
 */
export function onlineCourses(listed: readonly Course[], current: Course): readonly string[] {
  const ids = listed.map((course) => course.id);
  return ids.includes(current.id) ? ids : [...ids, current.id];
}
