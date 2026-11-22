/**
 * The one entry point for the game's art: builds every texture in `keys.ts`
 * and registers the global animations. Boot calls it once. Placeholder shapes
 * stand in for now; phase 4 swaps the body for pixel art behind the same call.
 */
import type Phaser from 'phaser';
import { Anim, type AnimKey, Frame, Tex, type TexKey } from './keys.ts';
import { drawSheet } from './placeholder.ts';
import { PLACEHOLDER_SHEETS } from './placeholder-sheets.ts';

/** Ambient two-frame loops. Cosmetic only: they run on Phaser's clock, never on logic ticks. */
const LOOPS: readonly { key: AnimKey; texture: TexKey; frameRate: number }[] = [
  { key: Anim.kelpSway, texture: Tex.kelp, frameRate: 2 },
  { key: Anim.currentRight, texture: Tex.currentRight, frameRate: 4 },
  { key: Anim.currentLeft, texture: Tex.currentLeft, frameRate: 4 },
  { key: Anim.currentUp, texture: Tex.currentUp, frameRate: 4 },
  { key: Anim.currentDown, texture: Tex.currentDown, frameRate: 4 },
  { key: Anim.jellyPulse, texture: Tex.jelly, frameRate: 3 },
];

/** Builds every texture key and registers each animation once; calling it again changes nothing. */
export function buildTextures(scene: Phaser.Scene): void {
  for (const sheet of PLACEHOLDER_SHEETS) drawSheet(scene, sheet);
  for (const loop of LOOPS) registerLoop(scene, loop);
}

function registerLoop(scene: Phaser.Scene, loop: (typeof LOOPS)[number]): void {
  if (scene.anims.exists(loop.key)) return;
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
