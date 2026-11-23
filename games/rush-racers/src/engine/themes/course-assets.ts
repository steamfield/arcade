/**
 * Checks that the engine can draw and play a course: its theme exists and has a tile for every art
 * key its legend names and every base cell it uses, and its race song exists. Course data is compiled in, so a miss is a
 * programming error, caught by the conformance test and, for the course a session starts on, at boot.
 */
import { levelOf } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import type { Cell } from '../../logic/types.ts';
import { songs } from '../audio/songs/index.ts';
import { themeFor } from './index.ts';
import type { Theme } from './types.ts';

/**
 * Throws unless `course`'s theme, its legend's art, the art for every base cell it uses and its song
 * all resolve.
 *
 * @throws {Error} When the theme or the song is missing, naming the course and the missing id.
 * @throws {Error} When the theme has no tile for an art key the course's legend names, naming the
 *   course, the glyph and the art key.
 * @throws {Error} When the course uses a base cell the theme draws neither a tile nor a looping
 *   sprite for, naming the course, the cell, the theme and where the cell first appears.
 */
export function assertCourseAssets(course: Course): void {
  const theme = themeFor(course);
  assertLegendArt(course, theme);
  if (!Object.hasOwn(songs, course.song)) {
    throw new Error(`Course '${course.id}' names song '${course.song}', which the soundtrack doesn't have`);
  }
  // Last, since it is the one check that parses the level.
  assertCellArt(course, theme);
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

/**
 * Cells that are fine with no art of their own: open water shows the backdrop, and air above a
 * surface shows it too when the theme has no sky tile.
 */
const BARE_CELLS: ReadonlySet<Cell> = new Set<Cell>(['water', 'air']);

/**
 * Throws on the first tile, in reading order, whose base cell the theme has no tile or looping sprite
 * for. Legend glyphs are left to `assertLegendArt`, since they draw their own art.
 */
function assertCellArt(course: Course, theme: Theme): void {
  const level = levelOf(course);
  const legend = course.level.legend ?? {};
  level.cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (BARE_CELLS.has(cell) || Object.hasOwn(legend, level.glyphs[y]?.[x] ?? '')) return;
      if (Object.hasOwn(theme.terrain.tiles, cell) || Object.hasOwn(theme.terrain.flowing, cell)) return;
      throw new Error(
        `Course '${course.id}' uses cell '${cell}' (first at row ${y}, col ${x}), which theme '${theme.id}' has no tile for`,
      );
    });
  });
}
