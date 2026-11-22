/**
 * Draws the two pixel faces into glyph sheets and registers them as Phaser
 * bitmap fonts under their texture keys. Idempotent, so `createLabel` can make
 * sure the fonts exist without depending on boot order.
 */
import type Phaser from 'phaser';
import { drawFrames } from '../pixel.ts';
import { DISPLAY_FACE, fontData, glyphFrames, TEXT_FACE, type Typeface } from './typeface.ts';

/**
 * Builds and registers both faces once; later calls find them and do nothing.
 *
 * @throws {Error} When a glyph is malformed, naming the face, character and row.
 */
export function ensureFonts(scene: Phaser.Scene): void {
  for (const face of [TEXT_FACE, DISPLAY_FACE]) ensureFont(scene, face);
}

function ensureFont(scene: Phaser.Scene, face: Typeface): void {
  if (!scene.textures.exists(face.key)) drawFrames(scene, face.key, glyphFrames(face));
  if (!scene.cache.bitmapFont.exists(face.key)) {
    scene.cache.bitmapFont.add(face.key, { data: fontData(face), texture: face.key, frame: null });
  }
}
