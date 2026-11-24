/**
 * The ocean theme's art: `registerArt` draws every ocean sheet in `sprites/` and registers the
 * theme's loops. `../ocean.ts` names what it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { OceanAnim, OceanTex } from './keys.ts';
import { OCEAN_SHEETS } from './sprites/index.ts';

/** Kelp sways, currents flow and the waterline rolls on Phaser's clock, never on logic ticks. */
const OCEAN_LOOPS = [
  { key: OceanAnim.kelpSway, texture: OceanTex.kelp, frameRate: 2 },
  { key: OceanAnim.currentRight, texture: OceanTex.currentRight, frameRate: 4 },
  { key: OceanAnim.currentLeft, texture: OceanTex.currentLeft, frameRate: 4 },
  { key: OceanAnim.currentUp, texture: OceanTex.currentUp, frameRate: 4 },
  { key: OceanAnim.currentDown, texture: OceanTex.currentDown, frameRate: 4 },
  { key: OceanAnim.waterlineRoll, texture: OceanTex.waterline, frameRate: 3 },
] as const;

/**
 * Draws the ocean theme's textures and registers its animations; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, OCEAN_SHEETS, 'ocean');
  registerLoops(scene, OCEAN_LOOPS, 'ocean');
}
