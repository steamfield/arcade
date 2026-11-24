/**
 * The theme registry: every theme by id, the lookup scenes use to draw a course, and the boot step
 * that builds every theme's textures through each theme's `registerArt`. Adding a theme is its data
 * file and its `art.ts`, and one line in each map here.
 */
import type Phaser from 'phaser';
import type { Course, ThemeId } from '../../logic/courses/types.ts';
import { registerArt as registerForestArt } from './forest/art.ts';
import { FOREST_THEME } from './forest.ts';
import { registerArt as registerOceanArt } from './ocean/art.ts';
import { OCEAN_THEME } from './ocean.ts';
import { registerArt as registerSkyArt } from './sky/art.ts';
import { SKY_THEME } from './sky.ts';
import { registerArt as registerSpaceArt } from './space/art.ts';
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

/** Each theme's `registerArt`, which draws the textures and loops the theme names; keyed like `THEMES`. */
export const THEME_ART: Readonly<Record<ThemeId, (scene: Phaser.Scene) => void>> = {
  ocean: registerOceanArt,
  forest: registerForestArt,
  space: registerSpaceArt,
  sky: registerSkyArt,
};

/**
 * Builds every theme's textures and animations. Boot calls it once.
 *
 * @throws {Error} When a theme's pixel art is malformed (see `drawSheets`).
 */
export function registerThemeTextures(scene: Phaser.Scene): void {
  for (const registerArt of Object.values(THEME_ART)) registerArt(scene);
}
