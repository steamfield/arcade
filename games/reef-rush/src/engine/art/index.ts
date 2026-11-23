/**
 * The entry point for the global world art: builds every texture in `keys.ts` from the
 * palette-indexed pixel text in `sprites/`. Boot calls it once. It also exports the two builders
 * a theme uses for its own art (`drawSheets`, `registerLoops`), so every texture in the game is
 * made the same way.
 */
import type Phaser from 'phaser';
import { Frame } from './keys.ts';
import { drawFrames } from './pixel.ts';
import { ART_SHEETS } from './sprites/index.ts';
import type { ArtSheet } from './sprites/sheet.ts';

/** An ambient two-frame loop over frames `a` and `b` of one texture. Cosmetic only: it runs on Phaser's clock, never on logic ticks. */
export interface AnimLoop {
  key: string;
  texture: string;
  frameRate: number;
}

/**
 * Builds every global texture key; calling it again changes nothing.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 */
export function buildTextures(scene: Phaser.Scene): void {
  drawSheets(scene, ART_SHEETS);
}

/**
 * Draws each sheet into its texture unless it already exists.
 *
 * @throws {Error} When a sprite's pixel text is malformed (see `drawFrames`), naming the key, frame and row.
 */
export function drawSheets(scene: Phaser.Scene, sheets: readonly ArtSheet<string>[]): void {
  for (const sheet of sheets) {
    // Textures are global to the game, so a second call finds them built; that is fine here, unlike a key clash.
    if (!scene.textures.exists(sheet.key)) drawFrames(scene, sheet.key, sheet.frames);
  }
}

/** Registers each loop once; a loop already registered is left as it is. */
export function registerLoops(scene: Phaser.Scene, loops: readonly AnimLoop[]): void {
  for (const loop of loops) {
    if (scene.anims.exists(loop.key)) continue;
    scene.anims.create({
      key: loop.key,
      frames: [
        { key: loop.texture, frame: Frame.a },
        { key: loop.texture, frame: Frame.b },
      ],
      frameRate: loop.frameRate,
      repeat: -1,
    });
  }
}
