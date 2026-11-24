/**
 * The object checks every world skin must pass: everything the skin names was drawn once, well
 * formed, at Reef's sizes and with Reef's frame names, items and icons tell apart, and the words
 * fit the HUD and How to Play.
 */
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, POWER_UP_KINDS } from '../../logic/types.ts';
import { type DrawnSkin, drawSkin, type SkinFixture } from './drawn-skin.ts';
import { assertSkinTextures } from './index.ts';
import type { ObjectSkin } from './object-skin.ts';
import { type BuiltTexture, framePixels, pixelCount } from './recording-scene.ts';
import { REEF_OBJECT_SHEETS, REEF_OBJECTS } from './reef/objects.ts';
import { REEF_SKIN } from './reef.ts';

const ICON_SIZE = 9;
/** The fewest drawn pixels a 9x9 icon may have and still read as a shape in the HUD well. */
const MIN_ICON_PIXELS = 30;
/** The lowest contrast ratio an enemy or pickup body may have against its world's bands. */
const MIN_CONTRAST = 3;
const MAX_COLOURS_PER_FRAME = 4;

const reef = drawSkin(REEF_SKIN);

/** WCAG relative luminance of a 0xRRGGBB colour. */
function luminance(colour: number): number {
  const [red = 0, green = 0, blue = 0] = [16, 8, 0].map((shift) => {
    const channel = ((colour >> shift) & 0xff) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: number, b: number): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const sizeOf = (texture: BuiltTexture | undefined) => ({ width: texture?.frameWidth, height: texture?.height });
const longest = (strings: readonly string[]) => Math.max(...strings.map((line) => line.length));

/** Every in-world texture an object skin names, labelled by the slot it fills, so two skins can be lined up slot by slot. */
function labelledTextures(objects: ObjectSkin): [string, string][] {
  return [
    ...POWER_UP_KINDS.map((kind): [string, string] => [`item ${kind}`, objects.itemTextures[kind]]),
    ...Object.entries(objects.attack).map(([name, key]): [string, string] => [`attack ${name}`, key]),
    ...Object.entries(objects.pickups).map(([name, key]): [string, string] => [`pickup ${name}`, key]),
    ...ENEMY_KINDS.map((kind): [string, string] => [`enemy ${kind}`, objects.enemies.bodies[kind]]),
    ['enemy eelBody', objects.enemies.eelBody],
    ['enemy marks', objects.enemies.marks],
  ];
}

/** The HUD and How to Play words of an object skin, grouped by where they have to fit. */
function wordGroups(objects: ObjectSkin): Record<string, string[]> {
  const { text } = objects;
  return {
    'HUD lines': [text.slowedBy, text.trapped],
    'enemy captions': Object.values(text.enemyCaptions),
    headings: [text.cratesHeading, text.pearlsHeading],
  };
}

/** Registers the object checks for one drawn skin. */
export function describeObjectArt({ contrast: rule }: SkinFixture, drawn: DrawnSkin): void {
  const { skin, art } = drawn;
  const { objects } = skin;
  const built = art.built;

  it('draws every texture the skin names, with the frames boot asks for', () => {
    expect(() => assertSkinTextures(art.textures, skin)).not.toThrow();
  });

  it('can be registered again without redrawing', () => {
    const before = new Map(built);
    const drawCount = art.drawOrder.length;
    skin.registerTextures(art.scene);
    expect(built).toEqual(before);
    expect(art.drawOrder).toHaveLength(drawCount);
  });

  it('draws every frame as well-formed pixel text of at most four colours', () => {
    for (const key of drawn.skinKeys) {
      const texture = built.get(key);
      for (const frame of texture?.frames ?? []) {
        const colours = new Set(framePixels(texture, frame).map((pixel) => pixel.colour));
        expect(colours.size, `${key} frame ${frame}`).toBeLessThanOrEqual(MAX_COLOURS_PER_FRAME);
      }
    }
  });

  it("sizes each texture like Reef's in the same slot, and gives it the frames Reef's has, since views ask for them by name", () => {
    const reefTextures = new Map(labelledTextures(REEF_OBJECTS));
    for (const [label, key] of labelledTextures(objects)) {
      const reefTexture = reef.art.built.get(reefTextures.get(label) ?? '');
      expect(sizeOf(built.get(key)), `${label} size`).toEqual(sizeOf(reefTexture));
      expect(built.get(key)?.frames, `${label} frames`).toEqual(reefTexture?.frames);
    }
  });

  it('draws one 9x9 icon per item, in the frame the skin names', () => {
    for (const kind of POWER_UP_KINDS) {
      const { texture, frame } = objects.itemIcons[kind];
      expect(built.get(texture)?.frames, kind).toContain(frame);
      expect(sizeOf(built.get(texture)), kind).toEqual({ width: ICON_SIZE, height: ICON_SIZE });
    }
  });

  it('fills most of each 9x9 icon so it reads in the HUD well', () => {
    for (const kind of POWER_UP_KINDS) {
      const { texture, frame } = objects.itemIcons[kind];
      expect(pixelCount(framePixels(built.get(texture), frame)), kind).toBeGreaterThanOrEqual(MIN_ICON_PIXELS);
    }
  });

  it('gives no two items the same art, in the world or in the HUD', () => {
    const textures = POWER_UP_KINDS.map((kind) => objects.itemTextures[kind]);
    const icons = POWER_UP_KINDS.map((kind) => objects.itemIcons[kind].frame);
    expect(new Set(textures).size).toBe(POWER_UP_KINDS.length);
    expect(new Set(icons).size).toBe(POWER_UP_KINDS.length);
  });

  it('gives each hazard glint a key of its own, a colour, and an alpha between 0 and 1', () => {
    const glints = Object.values(objects.glints);
    expect(new Set(glints.map((glint) => glint.key)).size).toBe(glints.length);
    for (const glint of glints) {
      expect(glint.colour).toBeGreaterThanOrEqual(0);
      expect(glint.colour).toBeLessThanOrEqual(0xffffff);
      expect(glint.alpha).toBeGreaterThan(0);
      expect(glint.alpha).toBeLessThanOrEqual(1);
    }
  });

  it.each(Object.keys(wordGroups(REEF_OBJECTS)))("keeps the %s within the longest of Reef's, so they fit", (group) => {
    const words = wordGroups(objects)[group] ?? [];
    expect(longest(words)).toBeLessThanOrEqual(longest(wordGroups(REEF_OBJECTS)[group] ?? []));
  });

  describe.runIf(rule)('against the world backdrop', () => {
    const weakest = (colour: number) => Math.min(...(rule?.backdrop ?? []).map((band) => contrast(colour, band)));

    it.each(ENEMY_KINDS)('stands the %s body colour 3:1 off the backdrop', (kind) => {
      expect(weakest(rule?.enemyBodies[kind] ?? 0)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });

    it('keeps the pickup body at least as bright as the pearl and 3:1 off the backdrop', () => {
      const pearlBody = REEF_OBJECT_SHEETS.find((sheet) => sheet.key === REEF_OBJECTS.pickups.pearl)?.frames[0]
        ?.palette[1];
      expect(luminance(rule?.pickupBody ?? 0)).toBeGreaterThanOrEqual(luminance(pearlBody ?? 0));
      expect(weakest(rule?.pickupBody ?? 0)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  });
}
