/**
 * The water behind the course, back to front: depth bands that darken toward
 * the floor (joined by line dithering), a caustic shimmer just under the
 * surface, a far reef ridge, slow-swaying god rays, a mid kelp forest, and
 * drifting motes. Far layers follow less of the camera's scroll than near ones.
 *
 * Every moving part is a pure function of the world tick and the camera
 * scroll, so captures repeat. With reduced motion the time-driven parts hold
 * still (static rays, no drift or shimmer); scroll parallax stays because it
 * only follows the camera.
 */
import Phaser from 'phaser';
import { type Level, TILE, type Vec } from '../../logic/types.ts';
import { Tex, type TexKey } from '../art/keys.ts';
import { WATER_BANDS, WaterLight } from '../art/palettes.ts';
import { Layer } from './layers.ts';

/** The water behind the course, built once per race. */
export interface Backdrop {
  /**
   * Moves the animated layers to where they are at `tick`.
   *
   * @param tick The world tick, so animated layers repeat in captures.
   */
  update(tick: number): void;
}

/** How the backdrop may move. */
export interface BackdropOptions {
  /** Hold rays, caustics and motes still. */
  reducedMotion: boolean;
}

/** Screen size and how far the camera can scroll over the level, in px. */
interface Viewport {
  screen: { width: number; height: number };
  maxScroll: Vec;
}

/** A backdrop part that changes over time or with the camera. */
interface AnimatedPart {
  update(tick: number, scroll: Vec): void;
}

/** Draw order inside the backdrop, all behind the course tiles. */
const Depth = {
  bands: Layer.backdrop,
  caustics: Layer.backdrop + 1,
  farReef: Layer.parallax,
  rays: Layer.parallax + 1,
  kelpForest: Layer.parallax + 2,
  motes: Layer.parallax + 3,
} as const;

/** The level's top tile row is rock; the water surface is just under it. */
const SURFACE_Y = TILE;

/** Each factor is the fraction of camera scroll the layer follows: far layers move less. */
const PAINTED_LAYERS: readonly { texture: TexKey; height: number; factor: number; depth: number }[] = [
  { texture: Tex.backdropFar, height: 64, factor: 0.15, depth: Depth.farReef },
  { texture: Tex.backdropNear, height: 80, factor: 0.35, depth: Depth.kelpForest },
];

/**
 * Adds the backdrop for `level` behind everything else in `scene`.
 *
 * @param options Defaults to full motion when the caller has no settings to pass.
 */
export function createBackdrop(
  scene: Phaser.Scene,
  level: Level,
  options: BackdropOptions = { reducedMotion: false },
): Backdrop {
  const camera = scene.cameras.main;
  const viewport: Viewport = {
    screen: { width: camera.width, height: camera.height },
    maxScroll: { x: level.width * TILE - camera.width, y: level.height * TILE - camera.height },
  };
  addDepthBands(scene, level, viewport);
  addPaintedLayers(scene, viewport);
  const parts = [createCaustics(scene), createLightRays(scene, viewport), createMotes(scene, viewport)];

  return {
    update(tick) {
      const time = options.reducedMotion ? 0 : tick;
      const scroll = { x: camera.scrollX, y: camera.scrollY };
      for (const part of parts) part.update(time, scroll);
    },
  };
}

/** Line dither between bands: rows of the deeper colour above each boundary, densest nearest it. */
const DITHER_ROWS = [-6, -3, -2] as const;

function addDepthBands(scene: Phaser.Scene, level: Level, viewport: Viewport): void {
  const levelHeight = level.height * TILE;
  const bandHeight = Math.ceil(levelHeight / WATER_BANDS.length);
  const width = viewport.screen.width;
  // Pinned horizontally, scrolling vertically: depth is a property of y, not of where you are along the course.
  const fill = (y: number, height: number, colour: number) =>
    scene.add.rectangle(0, y, width, height, colour).setOrigin(0).setScrollFactor(0, 1).setDepth(Depth.bands);

  WATER_BANDS.forEach((colour, band) => {
    const top = band * bandHeight;
    fill(top, bandHeight, colour);
    const deeper = WATER_BANDS[band + 1];
    if (deeper === undefined) return;
    for (const offset of DITHER_ROWS) fill(top + bandHeight + offset, 1, deeper);
  });
}

function addPaintedLayers(scene: Phaser.Scene, viewport: Viewport): void {
  const { screen, maxScroll } = viewport;
  for (const layer of PAINTED_LAYERS) {
    // Wide enough to cover the screen at the far end of the course, and placed so the
    // layer rests on the bottom edge of the screen when the camera is at the level floor.
    const width = Math.ceil(screen.width + maxScroll.x * layer.factor);
    const y = maxScroll.y * layer.factor + screen.height - layer.height;
    scene.add
      .tileSprite(0, y, width, layer.height, layer.texture)
      .setOrigin(0)
      .setScrollFactor(layer.factor)
      .setDepth(layer.depth);
  }
}

/** Caustic net: one dash per cell, wobbling within its cell, fading with depth below the surface. */
const CAUSTICS = { cell: { w: 12, h: 5 }, rows: 5, factor: 0.5, stepTicks: 6, alpha: 0.22 } as const;

function createCaustics(scene: Phaser.Scene): AnimatedPart {
  const graphics = scene.add
    .graphics()
    .setScrollFactor(0, 1)
    .setDepth(Depth.caustics)
    .setBlendMode(Phaser.BlendModes.ADD);
  const width = scene.cameras.main.width;
  const { cell } = CAUSTICS;

  return {
    update(tick, scroll) {
      // Stepped rather than smooth: the shimmer changes a few times a second, like animated tiles.
      const step = Math.floor(tick / CAUSTICS.stepTicks);
      const shift = Math.floor(scroll.x * CAUSTICS.factor);
      const firstColumn = Math.floor(shift / cell.w);
      graphics.clear();
      for (let row = 0; row < CAUSTICS.rows; row++) {
        graphics.fillStyle(WaterLight.caustic, CAUSTICS.alpha * (1 - row / CAUSTICS.rows));
        for (let column = firstColumn; column * cell.w - shift < width; column++) {
          const seed = hash(column, row);
          const wobble = Math.round(3 * Math.sin(step * 0.7 + seed * 6.28));
          const length = 2 + (seed * 7 >= 3.5 ? 2 : 0);
          const x = column * cell.w - shift + 4 + wobble;
          graphics.fillRect(x, SURFACE_Y + row * cell.h + ((column + row) % 2), length, 1);
        }
      }
    },
  };
}

/** God rays: slanted shafts from the surface, each drawn twice so the top half is brighter. */
const RAYS = {
  spacing: 96,
  length: 190,
  topWidth: 12,
  bottomWidth: 34,
  slant: 40,
  factor: 0.3,
  alpha: 0.05,
  swayPx: 6,
  swayTicks: 480,
} as const;

function createLightRays(scene: Phaser.Scene, viewport: Viewport): AnimatedPart {
  const graphics = scene.add
    .graphics()
    .setScrollFactor(RAYS.factor, 1)
    .setDepth(Depth.rays)
    .setBlendMode(Phaser.BlendModes.ADD);
  const span = viewport.screen.width + viewport.maxScroll.x * RAYS.factor + RAYS.spacing;
  const count = Math.ceil(span / RAYS.spacing);

  return {
    update(tick) {
      graphics.clear();
      graphics.fillStyle(WaterLight.ray, RAYS.alpha);
      for (let ray = 0; ray < count; ray++) {
        const phase = hash(ray, 7) * Math.PI * 2;
        const sway = Math.round(RAYS.swayPx * Math.sin((tick / RAYS.swayTicks) * Math.PI * 2 + phase));
        const x = ray * RAYS.spacing + Math.round(hash(ray, 3) * 30);
        const length = RAYS.length - Math.round(hash(ray, 5) * 60);
        drawShaft(graphics, x, sway, length);
        drawShaft(graphics, x, Math.round(sway / 2), Math.round(length / 2));
      }
    },
  };
}

/** One shaft: narrow at the surface, widening and leaning as it goes down; `sway` moves only its foot. */
function drawShaft(graphics: Phaser.GameObjects.Graphics, x: number, sway: number, length: number): void {
  const grow = length / RAYS.length;
  const foot = x + Math.round(RAYS.slant * grow) + sway;
  const footWidth = Math.round(RAYS.topWidth + (RAYS.bottomWidth - RAYS.topWidth) * grow);
  const bottom = SURFACE_Y + length;
  graphics.fillTriangle(x, SURFACE_Y, x + RAYS.topWidth, SURFACE_Y, foot + footWidth, bottom);
  graphics.fillTriangle(x, SURFACE_Y, foot + footWidth, bottom, foot, bottom);
}

/** Motes: specks of drifting matter nearer than the kelp forest, wrapping around the screen. */
const MOTES = { count: 30, factor: 0.6, alpha: 0.55, driftTicks: 900 } as const;

function createMotes(scene: Phaser.Scene, viewport: Viewport): AnimatedPart {
  const { width, height } = viewport.screen;
  const motes = Array.from({ length: MOTES.count }, (_, index) => {
    const size = hash(index, 11) > 0.8 ? 2 : 1;
    const speck = scene.add
      .rectangle(0, 0, size, size, WaterLight.mote, MOTES.alpha)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(Depth.motes);
    return { speck, home: { x: hash(index, 1) * width, y: hash(index, 2) * height }, speed: 0.5 + hash(index, 4) };
  });

  return {
    update(tick, scroll) {
      for (const { speck, home, speed } of motes) {
        // Drift slowly up and to the left, and slide with the camera a little slower than the course.
        const drift = (tick / MOTES.driftTicks) * speed;
        const x = home.x - drift * 40 - scroll.x * MOTES.factor;
        const y = home.y - drift * 25 - scroll.y * MOTES.factor;
        speck.setPosition(Math.round(wrap(x, width)), Math.round(wrap(y, height)));
      }
    },
  };
}

/** A fixed pseudo-random number in [0, 1) for a pair of integers, so layouts repeat without an rng. */
function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}
