/**
 * Checks that the engine can draw and play a course: its theme and its race song both exist. Course
 * data is compiled in, so a miss is a programming error, caught by the conformance test and, for the
 * course a session starts on, at boot.
 */
import type { Course } from '../../logic/courses/types.ts';
import { songs } from '../audio/songs/index.ts';
import { themeFor } from './index.ts';

/**
 * Throws unless `course`'s theme and song both resolve.
 *
 * @throws {Error} When the theme or the song is missing, naming the course and the missing id.
 */
export function assertCourseAssets(course: Course): void {
  themeFor(course);
  if (!Object.hasOwn(songs, course.song)) {
    throw new Error(`Course '${course.id}' names song '${course.song}', which the soundtrack doesn't have`);
  }
}
