/**
 * The forest theme's art: `registerArt` draws every forest sheet in `sprites/` and registers the
 * theme's loops. `../forest.ts` names what it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { ForestAnim, ForestTex } from './keys.ts';
import { FOREST_SHEETS } from './sprites/index.ts';

/** Mud bubbles and wind animate on Phaser's clock, never on logic ticks. */
const FOREST_LOOPS = [
  { key: ForestAnim.mudBubble, texture: ForestTex.mud, frameRate: 2 },
  { key: ForestAnim.windRight, texture: ForestTex.windRight, frameRate: 4 },
  { key: ForestAnim.windLeft, texture: ForestTex.windLeft, frameRate: 4 },
  { key: ForestAnim.windUp, texture: ForestTex.windUp, frameRate: 4 },
  { key: ForestAnim.windDown, texture: ForestTex.windDown, frameRate: 4 },
] as const;

/**
 * Draws the forest theme's textures and registers its animations; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, FOREST_SHEETS, 'forest');
  registerLoops(scene, FOREST_LOOPS, 'forest');
}
