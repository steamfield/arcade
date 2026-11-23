/**
 * What sits behind the course, back to front, in the course theme's look: colour bands down the
 * level (joined by line dithering), a caustic shimmer just under the top, painted layers behind
 * the light rays, slow-swaying rays, painted layers in front of them, and drifting motes. For the
 * ocean that is water darkening toward the floor, a far reef ridge, god rays and a mid kelp forest.
 * A theme leaves out caustics, rays or motes by giving no colour for them, and may add thin haze
 * streaks drifting sideways over the bands (the sky's evening haze). Far layers follow less
 * of the camera's scroll than near ones. In front of all of that and still behind the terrain, a
 * theme with a cave wall tiles it down every dark column range, so a dark stretch reads as a cave
 * under the dark veil.
 *
 * Every moving part is a pure function of the world tick and the camera
 * scroll, so captures repeat. With reduced motion the time-driven parts hold
 * still (static rays, no drift, haze or shimmer); scroll parallax stays because it
 * only follows the camera.
 */
import type Phaser from 'phaser';
import { type Level, TILE, type Vec } from '../../logic/types.ts';
import type { BackdropSpec, HazeSpec, PaintedLayer, Theme } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** The backdrop behind the course, built once per screen. */
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
  /** Hold rays, caustics, haze and motes still. */
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
  haze: Layer.backdrop + 2,
  behindRays: Layer.parallax,
  rays: Layer.parallax + 1,
  aboveRays: Layer.parallax + 2,
  motes: Layer.parallax + 3,
  cave: Layer.parallax + 4,
} as const;

/** Phaser's additive blend mode by name, which keeps this module free of a runtime Phaser import. */
const ADDITIVE = 'ADD';

/**
 * Where the light starts, one tile down, whatever the top row holds: under rock it is the water's
 * surface, and over open sky (a level surface) the rays simply begin in the air above the waterline.
 */
const SURFACE_Y = TILE;

/**
 * Adds the backdrop for `level`, in `theme`'s look, behind everything else in `scene`.
 *
 * @param options Defaults to full motion when the caller has no settings to pass.
 */
export function createBackdrop(
  scene: Phaser.Scene,
  level: Level,
  theme: Pick<Theme, 'backdrop' | 'ambient'>,
  options: BackdropOptions = { reducedMotion: false },
): Backdrop {
  const camera = scene.cameras.main;
  const viewport: Viewport = {
    screen: { width: camera.width, height: camera.height },
    maxScroll: { x: level.width * TILE - camera.width, y: level.height * TILE - camera.height },
  };
  const { backdrop } = theme;
  addDepthBands(scene, level, viewport, backdrop.bands);
  addPaintedLayers(scene, level, viewport, backdrop.layers);
  if (backdrop.cave) addCaveWalls(scene, level, backdrop.cave.texture);
  const parts: AnimatedPart[] = [];
  if (backdrop.caustics !== null) parts.push(createCaustics(scene, backdrop.caustics));
  if (backdrop.haze) parts.push(createHaze(scene, level, backdrop.haze));
  if (backdrop.rays !== null) parts.push(createLightRays(scene, viewport, backdrop.rays));
  if (theme.ambient.motes !== null) parts.push(createMotes(scene, viewport, theme.ambient.motes));
  // update runs every rendered frame, so it reuses one scroll object rather than allocating per frame.
  const scroll = { x: 0, y: 0 };

  return {
    update(tick) {
      const time = options.reducedMotion ? 0 : tick;
      scroll.x = camera.scrollX;
      scroll.y = camera.scrollY;
      for (const part of parts) part.update(time, scroll);
    },
  };
}

/**
 * Ordered dither above each band boundary, as pixel masks over a 2x2 cell: the rows furthest from the
 * boundary take a quarter of the deeper colour, the nearest rows half, so bands blend without hard lines.
 */
const DITHER = [
  { rowsAbove: [6, 5, 4], hit: (x: number, y: number) => x % 2 === 0 && y % 2 === 0 },
  { rowsAbove: [3, 2, 1], hit: (x: number, y: number) => (x + y) % 2 === 0 },
] as const;

function addDepthBands(scene: Phaser.Scene, level: Level, viewport: Viewport, colours: BackdropSpec['bands']): void {
  const levelHeight = level.height * TILE;
  const bandHeight = Math.ceil(levelHeight / colours.length);
  const width = viewport.screen.width;
  const graphics = scene.make.graphics({}, false);

  colours.forEach((colour, band) => {
    const top = band * bandHeight;
    graphics.fillStyle(colour, 1).fillRect(0, top, width, bandHeight);
    const deeper = colours[band + 1];
    if (deeper === undefined) return;
    graphics.fillStyle(deeper, 1);
    for (const { rowsAbove, hit } of DITHER) {
      for (const above of rowsAbove) {
        const y = top + bandHeight - above;
        for (let x = 0; x < width; x++) if (hit(x, y)) graphics.fillRect(x, y, 1, 1);
      }
    }
  });

  // Baked once into a render texture: the dither is thousands of pixels, too many to redraw every frame.
  // Pinned horizontally, scrolling vertically: depth is a property of y, not of where you are along the course.
  const bands = scene.add.renderTexture(0, 0, width, levelHeight).setOrigin(0).setScrollFactor(0, 1);
  bands.setDepth(Depth.bands).draw(graphics).render();
  graphics.destroy();
}

function addPaintedLayers(
  scene: Phaser.Scene,
  level: Level,
  viewport: Viewport,
  layers: readonly PaintedLayer[],
): void {
  const { screen, maxScroll } = viewport;
  const floorY = floorTop(level);
  for (const layer of layers) {
    // Wide enough to cover the screen at the far end of the course, and placed so the layer
    // stands on the course's rock floor (not hidden behind it) when the camera is at the bottom.
    const width = Math.ceil(screen.width + maxScroll.x * layer.factor);
    const y = floorY - maxScroll.y * (1 - layer.factor) - layer.height + FLOOR_OVERLAP;
    scene.add
      .tileSprite(0, y, width, layer.height, layer.texture)
      .setOrigin(0)
      .setScrollFactor(layer.factor)
      .setDepth(layer.aboveRays ? Depth.aboveRays : Depth.behindRays);
  }
}

/** Pixels each painted layer tucks behind the floor, so no band shows between them. */
const FLOOR_OVERLAP = 4;

/** World y of the top of the solid rock rows at the bottom of the level (its height if there are none). */
function floorTop(level: Level): number {
  let row = level.height;
  while (row > 0 && level.cells[row - 1]?.every((cell) => cell === 'rock')) row--;
  return row * TILE;
}

/** A world-space rectangle in px. */
export interface CaveSpan {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the cave wall goes: one span per dark column range, the full height of the level. */
export function caveSpans(level: Pick<Level, 'dark' | 'height'>): CaveSpan[] {
  return level.dark.map(([from, to]) => ({
    x: from * TILE,
    y: 0,
    width: (to - from + 1) * TILE,
    height: level.height * TILE,
  }));
}

function addCaveWalls(scene: Phaser.Scene, level: Level, texture: string): void {
  for (const span of caveSpans(level)) {
    scene.add.tileSprite(span.x, span.y, span.width, span.height, texture).setOrigin(0).setDepth(Depth.cave);
  }
}

/** Caustic net: one dash per cell, wobbling within its cell, fading with depth below the surface. */
const CAUSTICS = { cell: { w: 12, h: 5 }, rows: 5, factor: 0.5, stepTicks: 6, alpha: 0.22 } as const;

function createCaustics(scene: Phaser.Scene, colour: number): AnimatedPart {
  const graphics = scene.add.graphics().setScrollFactor(0, 1).setDepth(Depth.caustics).setBlendMode(ADDITIVE);
  const width = scene.cameras.main.width;
  const { cell } = CAUSTICS;
  let drawn = '';

  return {
    update(tick, scroll) {
      // Stepped rather than smooth: the shimmer changes a few times a second, like animated tiles.
      const step = Math.floor(tick / CAUSTICS.stepTicks);
      const shift = Math.floor(scroll.x * CAUSTICS.factor);
      // The pattern depends only on these two, so most frames have nothing to redraw.
      const key = `${step}:${shift}`;
      if (key === drawn) return;
      drawn = key;
      const firstColumn = Math.floor(shift / cell.w);
      graphics.clear();
      for (let row = 0; row < CAUSTICS.rows; row++) {
        graphics.fillStyle(colour, CAUSTICS.alpha * (1 - row / CAUSTICS.rows));
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

/**
 * Haze: long thin streaks spread down the level, pinned to it like the bands and drifting slowly
 * sideways at their own speeds, wrapping around the screen. Each streak keeps to its own `spacing`
 * px slot of level height, so streaks never overlap and the haze is one even opacity over the bands.
 */
const HAZE = { spacing: 12, minLength: 24, maxLength: 88, pxPerTick: 1 / 12 } as const;

function createHaze(scene: Phaser.Scene, level: Level, haze: HazeSpec): AnimatedPart {
  const graphics = scene.add.graphics().setScrollFactor(0, 1).setDepth(Depth.haze);
  const width = scene.cameras.main.width;
  const levelHeight = level.height * TILE;
  const streaks = Array.from({ length: Math.floor(levelHeight / HAZE.spacing) }, (_, index) => ({
    home: hash(index, 13) * width,
    y: index * HAZE.spacing + Math.floor(hash(index, 17) * (HAZE.spacing - 2)),
    length: Math.round(HAZE.minLength + hash(index, 19) * (HAZE.maxLength - HAZE.minLength)),
    thickness: hash(index, 23) > 0.7 ? 2 : 1,
    speed: 0.5 + hash(index, 29),
  }));
  let drawn = '';

  return {
    update(tick) {
      const lefts = streaks.map((streak) =>
        Math.round(wrap(streak.home + tick * HAZE.pxPerTick * streak.speed, width + streak.length) - streak.length),
      );
      // Streaks move a pixel every several ticks; redraw only when one has.
      const key = lefts.join(',');
      if (key === drawn) return;
      drawn = key;
      graphics.clear();
      graphics.fillStyle(haze.colour, haze.alpha);
      streaks.forEach((streak, index) => {
        graphics.fillRect(lefts[index] ?? 0, streak.y, streak.length, streak.thickness);
      });
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

function createLightRays(scene: Phaser.Scene, viewport: Viewport, colour: number): AnimatedPart {
  const graphics = scene.add.graphics().setScrollFactor(RAYS.factor, 1).setDepth(Depth.rays).setBlendMode(ADDITIVE);
  const span = viewport.screen.width + viewport.maxScroll.x * RAYS.factor + RAYS.spacing;
  const count = Math.ceil(span / RAYS.spacing);
  const shafts = Array.from({ length: count }, (_, ray) => ({
    x: ray * RAYS.spacing + Math.round(hash(ray, 3) * 30),
    length: RAYS.length - Math.round(hash(ray, 5) * 60),
    phase: hash(ray, 7) * Math.PI * 2,
  }));
  let drawn = '';

  return {
    update(tick, scroll) {
      // Only shafts whose top can reach the screen, given how far they lean and spread.
      const offset = scroll.x * RAYS.factor;
      const visible = shafts.filter(
        (shaft) => shaft.x - offset >= -RAYS.spacing - RAYS.slant && shaft.x - offset <= viewport.screen.width,
      );
      const sways = visible.map((shaft) =>
        Math.round(RAYS.swayPx * Math.sin((tick / RAYS.swayTicks) * Math.PI * 2 + shaft.phase)),
      );
      // Whole-pixel sway changes a few times a second; redraw only then or when the visible set changes.
      const key = `${visible[0]?.x}:${visible.length}:${sways.join(',')}`;
      if (key === drawn) return;
      drawn = key;

      graphics.clear();
      graphics.fillStyle(colour, RAYS.alpha);
      visible.forEach((shaft, index) => {
        const sway = sways[index] ?? 0;
        drawShaft(graphics, shaft.x, sway, shaft.length);
        drawShaft(graphics, shaft.x, Math.round(sway / 2), Math.round(shaft.length / 2));
      });
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

/** Motes: specks of drifting matter nearer than every painted layer, wrapping around the screen. */
const MOTES = { count: 30, factor: 0.6, alpha: 0.55, driftTicks: 900 } as const;

function createMotes(scene: Phaser.Scene, viewport: Viewport, colour: number): AnimatedPart {
  const { width, height } = viewport.screen;
  const motes = Array.from({ length: MOTES.count }, (_, index) => {
    const size = hash(index, 11) > 0.8 ? 2 : 1;
    const speck = scene.add
      .rectangle(0, 0, size, size, colour, MOTES.alpha)
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
