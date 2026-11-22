/**
 * Turns palette-indexed text into textures: one string per pixel row, one
 * character per pixel, `.` transparent and digits indexing the palette. Every
 * sprite, tile, icon and glyph in the game is authored this way.
 */
import type Phaser from 'phaser';

/** Colours for one sprite: index 0 is the first digit, `0`. At most 4 entries by the art spec. */
export type Palette = readonly number[];

/** One frame of pixel rows, all the same width. */
export type PixelRows = readonly string[];

/**
 * Draws one sprite into a texture under `key`.
 *
 * @throws {Error} Naming the key and row when rows differ in width or a digit has no palette entry.
 */
export function drawSprite(scene: Phaser.Scene, key: string, rows: PixelRows, palette: Palette): void {
  void scene;
  void key;
  void rows;
  void palette;
  throw new Error('not implemented');
}

/**
 * Draws equal-sized frames side by side into one texture under `key`, adding a frame per entry
 * (named by its index as a string) so animations and sprites can address them.
 *
 * @throws {Error} Naming the key, frame and row when frames differ in size or a digit has no palette entry.
 */
export function drawSheet(scene: Phaser.Scene, key: string, frames: readonly PixelRows[], palette: Palette): void {
  void scene;
  void key;
  void frames;
  void palette;
  throw new Error('not implemented');
}
