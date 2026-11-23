/**
 * Checks that the engine can draw and play a course: its theme exists and has a tile for every art
 * key its legend names, and its race song exists. Course data is compiled in, so a miss is a
 * programming error, caught by the conformance test and, for the course a session starts on, at boot.
 */
import type { Course } from '../../logic/courses/types.ts';
import { songs } from '../audio/songs/index.ts';
import { themeFor } from './index.ts';
import type { Theme } from './types.ts';

/**
 * Throws unless `course`'s theme, its legend's art and its song all resolve.
 *
 * @throws {Error} When the theme or the song is missing, naming the course and the missing id.
 * @throws {Error} When the theme has no tile for an art key the course's legend names, naming the
 *   course, the glyph and the art key.
 */
export function assertCourseAssets(course: Course): void {
  assertLegendArt(course, themeFor(course));
  if (!Object.hasOwn(songs, course.song)) {
    throw new Error(`Course '${course.id}' names song '${course.song}', which the soundtrack doesn't have`);
  }
}

/** Throws on the first legend glyph whose art key the theme draws no tile for. */
function assertLegendArt(course: Course, theme: Theme): void {
  for (const [glyph, entry] of Object.entries(course.level.legend ?? {})) {
    if (Object.hasOwn(theme.terrain.glyphTiles, entry.art)) continue;
    throw new Error(
      `Course '${course.id}' draws glyph "${glyph}" as art '${entry.art}', which theme '${theme.id}' has no tile for`,
    );
  }
}
