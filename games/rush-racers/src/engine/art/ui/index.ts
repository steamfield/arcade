/**
 * The UI kit's texture entry point: draws the fonts, icons, medals and logo
 * from their pixel text. Panels are drawn per size when created.
 * Safe to call from any scene and any number of times, so boot can build
 * everything up front and kit pieces can make sure of their own textures.
 */
import type Phaser from 'phaser';
import { drawFrames, type NamedFrame } from '../pixel.ts';
import { ensureFonts } from './fonts.ts';
import { iconSheets } from './icons.ts';
import type { UiSheet } from './keys.ts';
import { LOGO_SHEETS } from './logo.ts';

/** Every fixed UI texture other than the fonts, one entry per key, with `itemIcons` in the icon sheet. */
export function uiSheets(itemIcons: readonly NamedFrame[]): readonly UiSheet[] {
  return [...iconSheets(itemIcons), ...LOGO_SHEETS];
}

/**
 * Builds every UI texture that isn't built yet and registers the bitmap fonts. `itemIcons` are the
 * ten power-up frames the icon sheet carries (see `iconSheets`).
 *
 * @throws {Error} When a sheet's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 */
export function buildUiTextures(scene: Phaser.Scene, itemIcons: readonly NamedFrame[]): void {
  ensureFonts(scene);
  for (const sheet of uiSheets(itemIcons)) {
    if (!scene.textures.exists(sheet.key)) drawFrames(scene, sheet.key, sheet.frames);
  }
}
