/**
 * A theme is how a course looks: its textures, terrain, backdrop, ambient effects, particle physics,
 * hazard skins and dark tint. Logic names a theme by id (`Course.theme`); the engine maps the id to
 * one of these, never the reverse. This scaffold holds the one member every theme needs now; lane
 * 8/b grows it to the full shape in the phase 8 RFC (section 4.3) as the ocean art moves in.
 */
import type Phaser from 'phaser';
import type { ThemeId } from '../../logic/courses/types.ts';

export interface Theme {
  id: ThemeId;
  /** Builds and registers the theme's own texture keys, sheets and animations. Boot calls it once per theme. */
  registerTextures(scene: Phaser.Scene): void;
}

/** What a theme file writes; `defineTheme` fills defaults for any optional parts. */
export type ThemeSpec = Theme;
