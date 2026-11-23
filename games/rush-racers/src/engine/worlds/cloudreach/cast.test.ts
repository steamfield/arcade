/**
 * Cloudreach's cast is drawn at boot: every slot has a flyer with two wing-beat frames, a portrait
 * and a head, in its own palette, and the skin points at textures that were really built.
 */
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { CLOUDREACH_CAST, registerCloudreachCast } from './cast.ts';
import { SkyPortraitFrame, SkyRacerTex, SkyTex } from './keys.ts';
import { CloudreachPalette } from './sprites/palette.ts';

/** One filled run of pixels, as the pixel builder draws them: a rect in one colour. */
interface Rect {
  x: number;
  y: number;
  width: number;
  colour: number;
}

interface BuiltTexture {
  /** Size of one frame: the texture is the frames side by side. */
  frameWidth: number;
  height: number;
  frames: string[];
  rects: Rect[];
}

/** Rows 0 to 5 of a 12-row racer frame: where raised wings show. */
const RACER_TOP_HALF = 6;

/**
 * The parts of a Phaser scene the art builders touch, recording what each texture was made of.
 * Only Phaser is faked; the cast, its sprites and the builders are the real ones.
 */
function recordingScene() {
  const built = new Map<string, BuiltTexture>();
  let colour = 0;
  let rects: Rect[] = [];
  const graphics = {
    fillStyle: (next: number) => {
      colour = next;
      return graphics;
    },
    fillRect: (x: number, y: number, width: number) => {
      rects.push({ x, y, width, colour });
      return graphics;
    },
    generateTexture: (key: string, width: number, height: number) => {
      built.set(key, { frameWidth: width, height, frames: [], rects });
      rects = [];
    },
    destroy: () => {},
  };
  const scene = {
    textures: {
      exists: (key: string) => built.has(key),
      get: (key: string) => ({
        add: (name: string, _source: number, x: number, _y: number, width: number) => {
          const texture = built.get(key);
          texture?.frames.push(name);
          if (texture && x === 0) texture.frameWidth = width;
        },
      }),
    },
    make: { graphics: () => graphics },
  } as unknown as Phaser.Scene;
  return { scene, built };
}

/** The drawn pixels of one named frame of a built texture. */
function framePixels(texture: BuiltTexture | undefined, frame: string): Rect[] {
  const index = texture?.frames.indexOf(frame) ?? -1;
  if (!texture || index < 0) throw new Error(`Texture has no frame '${frame}'`);
  return texture.rects.filter((rect) => Math.floor(rect.x / texture.frameWidth) === index);
}

/** Registers the cast on a fresh scene and returns what was built. */
function builtCast() {
  const { scene, built } = recordingScene();
  registerCloudreachCast(scene);
  return { scene, built };
}

describe('Cloudreach cast textures', () => {
  it.each(CHARACTER_IDS)('draws %s as a 16x12 racer with wing-beat frames a and b', (slot) => {
    const texture = builtCast().built.get(SkyRacerTex[slot]);
    expect(texture?.frames).toEqual([Frame.a, Frame.b]);
    expect([texture?.frameWidth, texture?.height]).toEqual([16, 12]);
  });

  it('draws a 16x16 portrait and a 7x7 head for every slot, named by slot', () => {
    const { built } = builtCast();
    const names = CHARACTER_IDS.map((slot) => SkyPortraitFrame[slot]);
    for (const [key, size] of [
      [SkyTex.portraits, 16],
      [SkyTex.heads, 7],
    ] as const) {
      const texture = built.get(key);
      expect(texture?.frames, key).toEqual(names);
      expect([texture?.frameWidth, texture?.height], key).toEqual([size, size]);
    }
  });

  it('draws nothing but the cast, so the object skin keeps its own keys', () => {
    const { built } = builtCast();
    expect([...built.keys()].sort()).toEqual([...Object.values(SkyRacerTex), SkyTex.portraits, SkyTex.heads].sort());
  });

  it('can be registered again without redrawing', () => {
    const { scene, built } = builtCast();
    const first = new Map(built);
    registerCloudreachCast(scene);
    expect(built).toEqual(first);
  });
});

describe('Cloudreach cast skin', () => {
  it('points every slot at a racer, portrait and head that registering builds', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      expect(built.has(CLOUDREACH_CAST.racers[slot]), slot).toBe(true);
      for (const ref of [CLOUDREACH_CAST.portraits[slot], CLOUDREACH_CAST.heads[slot]]) {
        expect(built.get(ref.texture)?.frames, slot).toContain(ref.frame);
      }
    }
  });

  it('gives each slot its own racer texture and its own portrait and head frame', () => {
    const racers = CHARACTER_IDS.map((slot) => CLOUDREACH_CAST.racers[slot]);
    const portraits = CHARACTER_IDS.map((slot) => CLOUDREACH_CAST.portraits[slot].frame);
    expect(new Set(racers).size).toBe(CHARACTER_IDS.length);
    expect(new Set(portraits).size).toBe(CHARACTER_IDS.length);
  });

  it('draws each slot in its own palette at all three sizes, so a flyer looks the same everywhere', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      const palette = new Set<number>(CloudreachPalette[slot]);
      const drawn = [
        framePixels(built.get(SkyRacerTex[slot]), Frame.a),
        framePixels(built.get(SkyRacerTex[slot]), Frame.b),
        framePixels(built.get(SkyTex.portraits), SkyPortraitFrame[slot]),
        framePixels(built.get(SkyTex.heads), SkyPortraitFrame[slot]),
      ];
      for (const pixels of drawn) {
        expect(pixels.length, slot).toBeGreaterThan(0);
        expect(
          pixels.every((pixel) => palette.has(pixel.colour)),
          slot,
        ).toBe(true);
      }
    }
  });

  it('beats every wing up in frame a and down in frame b: more of a sits in the top half, more of b below', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      const texture = built.get(SkyRacerTex[slot]);
      const [upTop, upBottom, downTop, downBottom] = [Frame.a, Frame.b].flatMap((frame) => {
        const runs = framePixels(texture, frame);
        const area = (inHalf: (y: number) => boolean) =>
          runs.filter((run) => inHalf(run.y)).reduce((sum, run) => sum + run.width, 0);
        return [area((y) => y < RACER_TOP_HALF), area((y) => y >= RACER_TOP_HALF)];
      });
      expect(upTop, `${slot} top half`).toBeGreaterThan(downTop ?? 0);
      expect(downBottom, `${slot} bottom half`).toBeGreaterThan(upBottom ?? 0);
    }
  });

  it('gives every slot four colours and its own main colour', () => {
    for (const slot of CHARACTER_IDS) expect(CloudreachPalette[slot], slot).toHaveLength(4);
    const mains = CHARACTER_IDS.map((slot) => CloudreachPalette[slot][1]);
    expect(new Set(mains).size).toBe(CHARACTER_IDS.length);
  });

  it("keeps Cloudreach's own ability wording for the Spring Flap hummingbird", () => {
    expect(CLOUDREACH_CAST.abilities.gil.name).toBe('SPRING FLAP');
  });
});
