/**
 * The space theme's art: `registerArt` draws every space sheet in `sprites/` and registers the
 * theme's loops. `../space.ts` names what it draws without importing a sprite.
 */
import type Phaser from 'phaser';
import { drawSheets, registerLoops } from '../../art/index.ts';
import { SpaceAnim, SpaceTex } from './keys.ts';
import { SPACE_SHEETS } from './sprites/index.ts';

/** Dust sway and wind animate on Phaser's clock, never on logic ticks. */
const SPACE_LOOPS = [
  { key: SpaceAnim.dustSwirl, texture: SpaceTex.dust, frameRate: 2 },
  { key: SpaceAnim.windRight, texture: SpaceTex.windRight, frameRate: 4 },
  { key: SpaceAnim.windLeft, texture: SpaceTex.windLeft, frameRate: 4 },
  { key: SpaceAnim.windUp, texture: SpaceTex.windUp, frameRate: 4 },
  { key: SpaceAnim.windDown, texture: SpaceTex.windDown, frameRate: 4 },
] as const;

/**
 * Draws the space theme's textures and registers its animations; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed or a key belongs to another owner (see `drawSheets`).
 */
export function registerArt(scene: Phaser.Scene): void {
  drawSheets(scene, SPACE_SHEETS, 'space');
  registerLoops(scene, SPACE_LOOPS, 'space');
}
