/**
 * Thornwood's cast is drawn at boot: every slot has a racer with two stride frames, a portrait and
 * a head, in its own palette, and the skin points at textures that were really built.
 */
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { registerThornwoodCast, THORNWOOD_CAST } from './cast.ts';
import { ThornCastFrame, ThornRacerTex, ThornTex } from './keys.ts';
import { ThornwoodPalette } from './sprites/palette.ts';

/** One filled run of pixels, as the pixel builder draws them: a rect in one colour. */
interface Rect {
  x: number;
  y: number;
  colour: number;
}

interface BuiltTexture {
  /** Size of one frame: the texture is the frames side by side. */
  frameWidth: number;
  height: number;
  frames: string[];
  rects: Rect[];
}

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
    fillRect: (x: number, y: number) => {
      rects.push({ x, y, colour });
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
  registerThornwoodCast(scene);
  return { scene, built };
}

describe('Thornwood cast textures', () => {
  it.each(CHARACTER_IDS)('draws %s as a 16x12 racer with run-stride frames a and b', (slot) => {
    const texture = builtCast().built.get(ThornRacerTex[slot]);
    expect(texture?.frames).toEqual([Frame.a, Frame.b]);
    expect([texture?.frameWidth, texture?.height]).toEqual([16, 12]);
  });

  it('draws a 16x16 portrait and a 7x7 head for every slot, named by slot', () => {
    const { built } = builtCast();
    const names = CHARACTER_IDS.map((slot) => ThornCastFrame[slot]);
    for (const [key, size] of [
      [ThornTex.portraits, 16],
      [ThornTex.heads, 7],
    ] as const) {
      const texture = built.get(key);
      expect(texture?.frames, key).toEqual(names);
      expect([texture?.frameWidth, texture?.height], key).toEqual([size, size]);
    }
  });

  it('draws nothing but the cast, so the object skin keeps its own keys', () => {
    const { built } = builtCast();
    expect([...built.keys()].sort()).toEqual(
      [...Object.values(ThornRacerTex), ThornTex.portraits, ThornTex.heads].sort(),
    );
  });

  it('can be registered again without redrawing', () => {
    const { scene, built } = builtCast();
    const first = new Map(built);
    registerThornwoodCast(scene);
    expect(built).toEqual(first);
  });
});

describe('Thornwood cast skin', () => {
  it('points every slot at a racer, portrait and head that registering builds', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      expect(built.has(THORNWOOD_CAST.racers[slot]), slot).toBe(true);
      for (const ref of [THORNWOOD_CAST.portraits[slot], THORNWOOD_CAST.heads[slot]]) {
        expect(built.get(ref.texture)?.frames, slot).toContain(ref.frame);
      }
    }
  });

  it('gives each slot its own racer texture and its own portrait and head frame', () => {
    const racers = CHARACTER_IDS.map((slot) => THORNWOOD_CAST.racers[slot]);
    const portraits = CHARACTER_IDS.map((slot) => THORNWOOD_CAST.portraits[slot].frame);
    expect(new Set(racers).size).toBe(CHARACTER_IDS.length);
    expect(new Set(portraits).size).toBe(CHARACTER_IDS.length);
  });

  it('draws each slot in its own palette at all three sizes, so a critter looks the same everywhere', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      const palette = new Set<number>(ThornwoodPalette[slot]);
      const drawn = [
        framePixels(built.get(ThornRacerTex[slot]), Frame.a),
        framePixels(built.get(ThornRacerTex[slot]), Frame.b),
        framePixels(built.get(ThornTex.portraits), ThornCastFrame[slot]),
        framePixels(built.get(ThornTex.heads), ThornCastFrame[slot]),
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

  it('plants every racer frame on the ground: its lowest drawn row is row 10 of 12', () => {
    const { built } = builtCast();
    for (const slot of CHARACTER_IDS) {
      for (const frame of [Frame.a, Frame.b]) {
        const rows = framePixels(built.get(ThornRacerTex[slot]), frame).map((pixel) => pixel.y);
        expect(Math.max(...rows), `${slot} frame ${frame}`).toBe(10);
      }
    }
  });

  it('gives every slot four colours and its own main colour', () => {
    for (const slot of CHARACTER_IDS) expect(ThornwoodPalette[slot], slot).toHaveLength(4);
    const mains = CHARACTER_IDS.map((slot) => ThornwoodPalette[slot][1]);
    expect(new Set(mains).size).toBe(CHARACTER_IDS.length);
  });

  it("keeps Thornwood's own ability wording for the Spring Jump hare", () => {
    expect(THORNWOOD_CAST.abilities.gil.name).toBe('SPRING JUMP');
  });
});
