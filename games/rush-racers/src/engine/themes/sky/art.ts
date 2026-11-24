/**
 * The sky theme's art: `registerArt` draws every sky sheet in `sprites/` and registers the
 * theme's loops. `../sky.ts` names what it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { SkyThemeAnim, SkyThemeTex } from './keys.ts';
import { SKY_SHEETS } from './sprites/index.ts';

/** Fog drifts and winds flow on Phaser's clock, never on logic ticks. */
const SKY_LOOPS = [
  { key: SkyThemeAnim.fogDrift, texture: SkyThemeTex.fog, frameRate: 2 },
  { key: SkyThemeAnim.windRight, texture: SkyThemeTex.windRight, frameRate: 4 },
  { key: SkyThemeAnim.windLeft, texture: SkyThemeTex.windLeft, frameRate: 4 },
  { key: SkyThemeAnim.updraft, texture: SkyThemeTex.updraft, frameRate: 4 },
  { key: SkyThemeAnim.downdraft, texture: SkyThemeTex.downdraft, frameRate: 4 },
] as const;

/**
 * Draws the sky theme's textures and registers its animations; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, SKY_SHEETS, 'sky');
  registerLoops(scene, SKY_LOOPS, 'sky');
}
