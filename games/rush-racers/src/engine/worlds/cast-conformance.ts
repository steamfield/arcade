/**
 * The cast checks every world skin must pass: each slot has a racer with two stroke frames, a
 * portrait and a head named by slot, drawn in the slot's own palette, and the words fit the card.
 */
import { expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { Frame } from '../art/keys.ts';
import type { DrawnSkin, SkinFixture } from './drawn-skin.ts';
import { type BuiltTexture, framePixels } from './recording-scene.ts';
import { REEF_CAST } from './reef/cast.ts';

const RACER_SIZE = { width: 16, height: 12 };
const PORTRAIT_SIZE = 16;
const HEAD_SIZE = 7;

const sizeOf = (texture: BuiltTexture | undefined) => ({ width: texture?.frameWidth, height: texture?.height });
const longest = (strings: readonly string[]) => Math.max(...strings.map((line) => line.length));

/** One frame's pixels as text, positioned within the frame, so two frames compare by drawing. */
function drawing(texture: BuiltTexture | undefined, frame: string): string {
  return framePixels(texture, frame)
    .map((pixel) => `${pixel.x % (texture?.frameWidth ?? 1)},${pixel.y},${pixel.colour}`)
    .sort()
    .join(';');
}

/** Registers the cast checks for one drawn skin. */
export function describeCastArt({ skin, castPalettes }: SkinFixture, drawn: () => DrawnSkin): void {
  const { cast } = skin;
  const textureOf = (key: string) => drawn().art.built.get(key);

  it.each(CHARACTER_IDS)('draws %s as a 16x12 racer with stroke frames a and b', (slot) => {
    const texture = textureOf(cast.racers[slot]);
    expect(texture?.frames).toEqual([Frame.a, Frame.b]);
    expect(sizeOf(texture)).toEqual(RACER_SIZE);
  });

  it.each(CHARACTER_IDS)('moves %s between its two racer frames, so a and b are not the same drawing', (slot) => {
    const texture = textureOf(cast.racers[slot]);
    expect(drawing(texture, Frame.a)).not.toEqual(drawing(texture, Frame.b));
  });

  it.each([
    ['portrait', PORTRAIT_SIZE, cast.portraits],
    ['head', HEAD_SIZE, cast.heads],
  ] as const)('draws a %s of %i pixels for every slot, in a frame named for the slot', (_, size, refs) => {
    for (const slot of CHARACTER_IDS) {
      const texture = textureOf(refs[slot].texture);
      expect(texture?.frames, slot).toContain(refs[slot].frame);
      expect(sizeOf(texture), slot).toEqual({ width: size, height: size });
    }
    const textures = new Set(CHARACTER_IDS.map((slot) => refs[slot].texture));
    expect(textures.size).toBe(1);
    const named = CHARACTER_IDS.map((slot) => refs[slot].frame).sort();
    expect([...(textureOf([...textures][0] ?? '')?.frames ?? [])].sort()).toEqual(named);
  });

  it('gives each slot its own racer texture and its own portrait and head frame', () => {
    const count = (values: readonly string[]) => new Set(values).size;
    expect(count(CHARACTER_IDS.map((slot) => cast.racers[slot]))).toBe(CHARACTER_IDS.length);
    expect(count(CHARACTER_IDS.map((slot) => cast.portraits[slot].frame))).toBe(CHARACTER_IDS.length);
    expect(count(CHARACTER_IDS.map((slot) => cast.heads[slot].frame))).toBe(CHARACTER_IDS.length);
  });

  it('draws each slot in its own palette at all three sizes, so a racer looks the same everywhere', () => {
    for (const slot of CHARACTER_IDS) {
      const palette = new Set<number>(castPalettes[slot]);
      const frames = [
        framePixels(textureOf(cast.racers[slot]), Frame.a),
        framePixels(textureOf(cast.racers[slot]), Frame.b),
        framePixels(textureOf(cast.portraits[slot].texture), cast.portraits[slot].frame),
        framePixels(textureOf(cast.heads[slot].texture), cast.heads[slot].frame),
      ];
      for (const pixels of frames) {
        expect(pixels.length, slot).toBeGreaterThan(0);
        expect(
          pixels.every((pixel) => palette.has(pixel.colour)),
          slot,
        ).toBe(true);
      }
    }
  });

  it('gives every slot four colours and its own main colour', () => {
    for (const slot of CHARACTER_IDS) expect(castPalettes[slot], slot).toHaveLength(4);
    const mains = CHARACTER_IDS.map((slot) => castPalettes[slot][1]);
    expect(new Set(mains).size).toBe(CHARACTER_IDS.length);
  });

  it("keeps every ability name and blurb within the longest of Reef's, so the select card fits", () => {
    const names = (abilities: typeof cast.abilities) => CHARACTER_IDS.map((slot) => abilities[slot].name);
    const blurbs = (abilities: typeof cast.abilities) => CHARACTER_IDS.map((slot) => abilities[slot].blurb);
    expect(longest(names(cast.abilities))).toBeLessThanOrEqual(longest(names(REEF_CAST.abilities)));
    expect(longest(blurbs(cast.abilities))).toBeLessThanOrEqual(longest(blurbs(REEF_CAST.abilities)));
  });
}
