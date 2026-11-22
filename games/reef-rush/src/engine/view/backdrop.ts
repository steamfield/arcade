/**
 * The water behind the course: colour bands that darken with depth, and two
 * placeholder silhouette layers that scroll slower than the course for
 * parallax. Phase 4 replaces this body with painted layers, light shafts and
 * caustics behind the same `createBackdrop` and `Backdrop`.
 */
import type Phaser from 'phaser';
import { type Level, TILE } from '../../logic/types.ts';
import { Tex, type TexKey } from '../art/keys.ts';
import { Layer } from './layers.ts';

export interface Backdrop {
  /**
   * Advances any animated part of the backdrop. The placeholder has none yet.
   *
   * @param tick The world tick, so animated layers repeat in captures.
   */
  update(tick: number): void;
}

/** Shallow to deep, one band per BAND_TILES rows of the level. */
const BAND_COLOURS = [0x1a6fa0, 0x155f8c, 0x104f78, 0x0c4064, 0x083050] as const;
const BAND_TILES = 4;

/** Far layers move less: each factor is the fraction of camera scroll the layer follows. */
const PARALLAX: readonly { texture: TexKey; height: number; factor: number; alpha: number }[] = [
  { texture: Tex.backdropFar, height: 48, factor: 0.2, alpha: 0.8 },
  { texture: Tex.backdropNear, height: 40, factor: 0.45, alpha: 0.9 },
];

/** Adds the backdrop for `level` behind everything else in `scene`. */
export function createBackdrop(scene: Phaser.Scene, level: Level): Backdrop {
  const screenWidth = scene.cameras.main.width;
  addDepthBands(scene, level, screenWidth);
  addParallaxLayers(scene, level, screenWidth);
  return { update() {} };
}

function addDepthBands(scene: Phaser.Scene, level: Level, screenWidth: number): void {
  const bandHeight = BAND_TILES * TILE;
  const bands = Math.ceil(level.height / BAND_TILES);
  for (let band = 0; band < bands; band++) {
    const colour = BAND_COLOURS[Math.min(band, BAND_COLOURS.length - 1)] ?? BAND_COLOURS[0];
    // Pinned horizontally, scrolling vertically: depth is a property of y, not of where you are along the course.
    scene.add
      .rectangle(0, band * bandHeight, screenWidth, bandHeight, colour)
      .setOrigin(0)
      .setScrollFactor(0, 1)
      .setDepth(Layer.backdrop);
  }
}

function addParallaxLayers(scene: Phaser.Scene, level: Level, screenWidth: number): void {
  const screenHeight = scene.cameras.main.height;
  const maxScroll = { x: level.width * TILE - screenWidth, y: level.height * TILE - screenHeight };
  for (const layer of PARALLAX) {
    // Wide enough to cover the screen at the far end of the course, and placed so the
    // layer rests on the bottom edge of the screen when the camera is at the level floor.
    const width = Math.ceil(screenWidth + maxScroll.x * layer.factor);
    const y = maxScroll.y * layer.factor + screenHeight - layer.height;
    scene.add
      .tileSprite(0, y, width, layer.height, layer.texture)
      .setOrigin(0)
      .setScrollFactor(layer.factor)
      .setAlpha(layer.alpha)
      .setDepth(Layer.parallax);
  }
}
