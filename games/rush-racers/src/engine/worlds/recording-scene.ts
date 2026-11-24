/**
 * A stand-in for the parts of a Phaser scene the art builders touch, so tests can register a world's
 * art and read back what was drawn: each texture's frames, frame size and filled pixels. Only
 * Phaser is faked; the skins, their sprites and the pixel builders are the real ones.
 */
import type Phaser from 'phaser';
import type { TextureLookup } from './index.ts';

/** One filled run of pixels, as the pixel builder draws them: a rect in one colour. */
export interface DrawnPixel {
  x: number;
  y: number;
  /** Pixels wide. */
  width: number;
  colour: number;
}

/** What one `generateTexture` call produced. */
export interface BuiltTexture {
  /** Width of one frame: the texture is its frames side by side. */
  frameWidth: number;
  height: number;
  /** Frame names in the order they were added. */
  frames: string[];
  pixels: DrawnPixel[];
}

/** A recording scene, the texture lookup boot's checks take, and everything drawn so far. */
export interface RecordingScene {
  scene: Phaser.Scene;
  textures: TextureLookup;
  /** Every texture by key. Drawing a key twice replaces its entry. */
  built: Map<string, BuiltTexture>;
  /** Keys in the order they were drawn, one entry per `generateTexture` call, so a key drawn twice shows up twice. */
  drawOrder: string[];
}

/** Creates a scene that records every texture drawn into it. */
export function recordingScene(): RecordingScene {
  const built = new Map<string, BuiltTexture>();
  const drawOrder: string[] = [];
  const fonts = new Set<string>();
  let colour = 0;
  let pixels: DrawnPixel[] = [];
  const graphics = {
    fillStyle: (next: number) => {
      colour = next;
      return graphics;
    },
    fillRect: (x: number, y: number, width: number) => {
      pixels.push({ x, y, width, colour });
      return graphics;
    },
    generateTexture: (key: string, width: number, height: number) => {
      built.set(key, { frameWidth: width, height, frames: [], pixels });
      drawOrder.push(key);
      pixels = [];
    },
    destroy: () => {},
  };
  const textures: TextureLookup & { get(key: string): { add(...args: unknown[]): void; has(frame: string): boolean } } =
    {
      exists: (key) => built.has(key),
      get: (key) => ({
        add: (name: unknown, _source: unknown, x: unknown, _y: unknown, width: unknown) => {
          const texture = built.get(key);
          texture?.frames.push(name as string);
          if (texture && x === 0) texture.frameWidth = width as number;
        },
        has: (frame) => built.get(key)?.frames.includes(frame) ?? false,
      }),
    };
  const scene = {
    textures,
    make: { graphics: () => graphics },
    anims: { create: () => {} },
    cache: { bitmapFont: { exists: (key: string) => fonts.has(key), add: (key: string) => fonts.add(key) } },
  } as unknown as Phaser.Scene;
  return { scene, textures, built, drawOrder };
}

/** How many pixels a set of runs fills. */
export function pixelCount(runs: readonly DrawnPixel[]): number {
  return runs.reduce((sum, run) => sum + run.width, 0);
}

/** The pixels of one named frame of a built texture. */
export function framePixels(texture: BuiltTexture | undefined, frame: string): DrawnPixel[] {
  const index = texture?.frames.indexOf(frame) ?? -1;
  if (!texture || index < 0) throw new Error(`Texture has no frame '${frame}'`);
  return texture.pixels.filter((pixel) => Math.floor(pixel.x / texture.frameWidth) === index);
}
