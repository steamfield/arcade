/**
 * The hazard art the hazard view draws, which each world's object skin owns: every hazard sheet is
 * well-formed, every urchin and jelly slot names a texture and frame its world builds, a looping
 * hazard's loop runs over that texture's `a` and `b` frames and is registered with it, each hazard's
 * body reads 3:1 off every contrast band of the course theme it is raced in, and no world draws
 * another world's hazard.
 */
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { LISTED_COURSES } from '../../logic/courses/index.ts';
import type { AnimLoop } from '../art/index.ts';
import { measureFrames } from '../art/pixel.ts';
import type { ArtSheet } from '../art/sprites/sheet.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import { themeFor } from '../themes/index.ts';
import { registerArt as registerCloudreachArt } from '../worlds/cloudreach/art.ts';
import { SkyHazardPalette } from '../worlds/cloudreach/palettes.ts';
import { SKY_HAZARD_LOOPS, SKY_HAZARD_SHEETS } from '../worlds/cloudreach/sprites/hazards.ts';
import { CLOUDREACH_SKIN } from '../worlds/cloudreach.ts';
import { registerArt as registerFarsideArt } from '../worlds/farside/art.ts';
import { FAR_HAZARD_LOOPS, FAR_HAZARD_SHEETS, FarHazardPalette } from '../worlds/farside/sprites/hazards.ts';
import { FARSIDE_SKIN } from '../worlds/farside.ts';
import { assertSkinTextures, skinFor } from '../worlds/index.ts';
import type { HazardSkin } from '../worlds/object-skin.ts';
import { registerArt as registerReefArt } from '../worlds/reef/art.ts';
import { REEF_HAZARD_LOOPS, REEF_HAZARD_SHEETS, ReefHazardPalette } from '../worlds/reef/sprites/hazards.ts';
import { REEF_ITEM_ICON_FRAMES } from '../worlds/reef/sprites/icons.ts';
import { REEF_SKIN } from '../worlds/reef.ts';
import { registerArt as registerThornwoodArt } from '../worlds/thornwood/art.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS, ThornHazardPalette } from '../worlds/thornwood/sprites/hazards.ts';
import { THORNWOOD_SKIN } from '../worlds/thornwood.ts';
import type { WorldSkin } from '../worlds/types.ts';

const HAZARD_SLOTS = ['urchin', 'jelly'] as const;
type HazardSlot = (typeof HAZARD_SLOTS)[number];

/** A world's skin and `registerArt` with its hazard sheets and loops, which slots stand still, and each hazard's body colour. */
interface WorldHazardArt {
  skin: WorldSkin;
  registerArt: (scene: Phaser.Scene) => void;
  sheets: readonly ArtSheet<string>[];
  loops: readonly AnimLoop[];
  still: readonly HazardSlot[];
  bodies: Readonly<Record<HazardSlot, number>>;
}

const WORLD_HAZARD_ART: readonly WorldHazardArt[] = [
  {
    skin: REEF_SKIN,
    registerArt: registerReefArt,
    sheets: REEF_HAZARD_SHEETS,
    loops: REEF_HAZARD_LOOPS,
    still: ['urchin'],
    bodies: { urchin: ReefHazardPalette.urchin[1], jelly: ReefHazardPalette.jelly[1] },
  },
  {
    skin: THORNWOOD_SKIN,
    registerArt: registerThornwoodArt,
    sheets: THORN_HAZARD_SHEETS,
    loops: THORN_HAZARD_LOOPS,
    still: ['urchin'],
    bodies: { urchin: ThornHazardPalette.thornBush[1], jelly: ThornHazardPalette.wasp[1] },
  },
  {
    skin: CLOUDREACH_SKIN,
    registerArt: registerCloudreachArt,
    sheets: SKY_HAZARD_SHEETS,
    loops: SKY_HAZARD_LOOPS,
    still: [],
    bodies: { urchin: SkyHazardPalette.sparkCloud[1], jelly: SkyHazardPalette.staticWisp[1] },
  },
  {
    skin: FARSIDE_SKIN,
    registerArt: registerFarsideArt,
    sheets: FAR_HAZARD_SHEETS,
    loops: FAR_HAZARD_LOOPS,
    still: ['urchin'],
    bodies: { urchin: FarHazardPalette.mine[1], jelly: FarHazardPalette.orb[1] },
  },
];

/** WCAG contrast ratio of two 0xRRGGBB colours. */
function contrast(a: number, b: number): number {
  const luminance = (colour: number) => {
    const [r = 0, g = 0, bl = 0] = [16, 8, 0].map((shift) => {
      const c = ((colour >> shift) & 0xff) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The sheet `art` builds for `hazard`'s texture. */
function sheetOf(art: WorldHazardArt, hazard: HazardSkin): ArtSheet<string> | undefined {
  return art.sheets.find((sheet) => sheet.key === hazard.texture);
}

/** The hazard art for `skin`, failing the test when the table above leaves a world out. */
function artFor(skin: WorldSkin): WorldHazardArt {
  const art = WORLD_HAZARD_ART.find((entry) => entry.skin === skin);
  if (!art) throw new Error(`No hazard art listed for world '${skin.id}'`);
  return art;
}

/**
 * The parts of a Phaser scene boot's art builders touch, recording each texture's frames and each
 * animation made. Only Phaser is faked; the builders and the skins are the real ones.
 */
function recordingScene() {
  const built = new Map<string, string[]>();
  const anims = new Set<string>();
  const fonts = new Set<string>();
  const graphics = {
    fillStyle: () => graphics,
    fillRect: () => graphics,
    generateTexture: (key: string) => built.set(key, []),
    destroy: () => {},
  };
  const textures = {
    exists: (key: string) => built.has(key),
    get: (key: string) => ({
      add: (frame: string) => built.get(key)?.push(frame),
      has: (frame: string) => built.get(key)?.includes(frame) ?? false,
    }),
  };
  const scene = {
    textures,
    make: { graphics: () => graphics },
    anims: { exists: (key: string) => anims.has(key), create: ({ key }: { key: string }) => anims.add(key) },
    cache: { bitmapFont: { exists: (key: string) => fonts.has(key), add: (key: string) => fonts.add(key) } },
  } as unknown as Phaser.Scene;
  return { scene, textures, anims };
}

describe.each(WORLD_HAZARD_ART.map((art) => [art.skin.id, art] as const))('%s hazard art', (_, art) => {
  const { hazards } = art.skin.objects;
  const looping = HAZARD_SLOTS.filter((slot) => !art.still.includes(slot));

  it.each(art.sheets.map((sheet) => [sheet.key, sheet] as const))(
    '%s is well-formed pixel text of at most four colours',
    (key, sheet) => {
      expect(() => measureFrames(key, sheet.frames)).not.toThrow();
      for (const frame of sheet.frames) expect(frame.palette.length, frame.name).toBeLessThanOrEqual(4);
    },
  );

  it.each(HAZARD_SLOTS)('builds the texture and frame the %s slot names', (slot) => {
    expect(sheetOf(art, hazards[slot])?.frames.map((frame) => frame.name)).toContain(hazards[slot].frame);
  });

  it('leaves its still hazards unanimated', () => {
    expect(HAZARD_SLOTS.filter((slot) => hazards[slot].anim === null)).toEqual(art.still);
  });

  it.each(looping)('loops the %s over frames a and b of its own texture', (slot) => {
    const hazard = hazards[slot];
    expect(art.loops.find((loop) => loop.key === hazard.anim)?.texture).toBe(hazard.texture);
    expect(sheetOf(art, hazard)?.frames.map((frame) => frame.name)).toEqual(['a', 'b']);
  });

  it('builds no loop that neither hazard plays', () => {
    const played = HAZARD_SLOTS.map((slot) => hazards[slot].anim);
    expect(art.loops.map((loop) => loop.key).filter((key) => !played.includes(key))).toEqual([]);
  });

  it('registers every hazard texture, frame and loop with the skin, passing the boot texture check', () => {
    const { scene, textures, anims } = recordingScene();
    buildUiTextures(scene, REEF_ITEM_ICON_FRAMES);
    art.registerArt(scene);
    expect(() => assertSkinTextures(textures, art.skin, { exists: (key) => anims.has(key) })).not.toThrow();
  });
});

describe('hazards on every listed course', () => {
  it.each(LISTED_COURSES.map((course) => [course.id, course] as const))(
    "keeps each hazard's body 3:1 off every contrast band of %s's theme",
    (_, course) => {
      const art = artFor(skinFor(course));
      const { contrastBands } = themeFor(course);
      for (const slot of HAZARD_SLOTS) {
        const weakest = Math.min(...contrastBands.map((band) => contrast(art.bodies[slot], band.colour)));
        expect(weakest, slot).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("draws no hazard frame another world draws, and reuses no other world's hazard key", () => {
    const framesOf = (art: WorldHazardArt) =>
      art.sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.rows.join('\n')));
    const keys = WORLD_HAZARD_ART.flatMap((art) => art.sheets.map((sheet) => sheet.key));
    const frames = WORLD_HAZARD_ART.flatMap((art) => [...new Set(framesOf(art))]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(frames).size).toBe(frames.length);
  });
});
