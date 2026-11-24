/**
 * The theme registry: every theme by id, the lookup scenes use to draw a course, and the on-demand
 * import of each theme's `art.ts` (`worlds/load.ts` runs it). Adding a theme is its data file and its
 * `art.ts`, and one line in each map here.
 */
import type Phaser from 'phaser';
import type { Course, ThemeId } from '../../logic/courses/types.ts';
import { FOREST_THEME } from './forest.ts';
import { OCEAN_THEME } from './ocean.ts';
import { SKY_THEME } from './sky.ts';
import { SPACE_THEME } from './space.ts';
import type { Theme } from './types.ts';

export { defineTheme } from './define.ts';

/** Every theme by id. */
export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  ocean: OCEAN_THEME,
  forest: FOREST_THEME,
  space: SPACE_THEME,
  sky: SKY_THEME,
};

/**
 * The theme `course` is drawn with.
 *
 * @throws {Error} When the course names a theme the engine doesn't have, naming the course and the theme.
 */
export function themeFor(course: Course): Theme {
  if (!Object.hasOwn(THEMES, course.theme)) {
    throw new Error(`Course '${course.id}' names theme '${course.theme}', which the engine doesn't have`);
  }
  return THEMES[course.theme];
}

/**
 * Each theme's `art.ts`, imported on demand so its sprite rows are a chunk of their own; keyed like
 * `THEMES`. Only `worlds/load.ts` calls these.
 */
export const THEME_ART: Readonly<Record<ThemeId, () => Promise<{ registerArt(scene: Phaser.Scene): void }>>> = {
  ocean: () => import('./ocean/art.ts'),
  forest: () => import('./forest/art.ts'),
  space: () => import('./space/art.ts'),
  sky: () => import('./sky/art.ts'),
};
