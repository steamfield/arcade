/**
 * The hazard art the hazard view draws, which each world's object skin owns: every urchin and jelly
 * slot names a texture and frame its world's hazard sheets build, a looping hazard's loop runs over
 * that texture's `a` and `b` frames, each hazard's body reads 3:1 off every contrast band of the
 * course theme it is raced in, and no world draws another world's hazard.
 */
import { describe, expect, it } from 'vitest';
import { LISTED_COURSES } from '../../logic/courses/index.ts';
import type { AnimLoop } from '../art/index.ts';
import type { ArtSheet } from '../art/sprites/sheet.ts';
import { themeFor } from '../themes/index.ts';
import { SKY_HAZARD_LOOPS, SKY_HAZARD_SHEETS } from '../worlds/cloudreach/sprites/hazards.ts';
import { CLOUDREACH_SKIN } from '../worlds/cloudreach.ts';
import { FAR_HAZARD_LOOPS, FAR_HAZARD_SHEETS } from '../worlds/farside/sprites/hazards.ts';
import { FARSIDE_SKIN } from '../worlds/farside.ts';
import { skinFor } from '../worlds/index.ts';
import { REEF_HAZARD_LOOPS, REEF_HAZARD_SHEETS } from '../worlds/reef/sprites/hazards.ts';
import { REEF_SKIN } from '../worlds/reef.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS } from '../worlds/thornwood/sprites/hazards.ts';
import { THORNWOOD_SKIN } from '../worlds/thornwood.ts';
import type { HazardSkin, WorldSkin } from '../worlds/types.ts';

/** A world's skin with the hazard sheets and loops its `registerTextures` builds. */
interface WorldHazardArt {
  skin: WorldSkin;
  sheets: readonly ArtSheet<string>[];
  loops: readonly AnimLoop[];
}

const WORLD_HAZARD_ART: readonly WorldHazardArt[] = [
  { skin: REEF_SKIN, sheets: REEF_HAZARD_SHEETS, loops: REEF_HAZARD_LOOPS },
  { skin: THORNWOOD_SKIN, sheets: THORN_HAZARD_SHEETS, loops: THORN_HAZARD_LOOPS },
  { skin: CLOUDREACH_SKIN, sheets: SKY_HAZARD_SHEETS, loops: SKY_HAZARD_LOOPS },
  { skin: FARSIDE_SKIN, sheets: FAR_HAZARD_SHEETS, loops: FAR_HAZARD_LOOPS },
];

const HAZARD_SLOTS = ['urchin', 'jelly'] as const;

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

/** A hazard's body colour: the second entry of its palette, after the outline. */
function bodyOf(art: WorldHazardArt, hazard: HazardSkin): number | undefined {
  return sheetOf(art, hazard)?.frames[0]?.palette[1];
}

/** The hazard art for `skin`, failing the test when the table above leaves a world out. */
function artFor(skin: WorldSkin): WorldHazardArt {
  const art = WORLD_HAZARD_ART.find((entry) => entry.skin === skin);
  if (!art) throw new Error(`No hazard art listed for world '${skin.id}'`);
  return art;
}

describe.each(WORLD_HAZARD_ART.map((art) => [art.skin.id, art] as const))('%s hazard art', (_, art) => {
  it.each(HAZARD_SLOTS)('builds the texture and frame the %s slot names', (slot) => {
    const hazard = art.skin.objects.hazards[slot];
    expect(sheetOf(art, hazard)?.frames.map((frame) => frame.name)).toContain(hazard.frame);
  });

  it.each(HAZARD_SLOTS)('loops the %s over frames a and b of its own texture, when it loops', (slot) => {
    const hazard = art.skin.objects.hazards[slot];
    if (hazard.anim === null) return;
    expect(art.loops.find((loop) => loop.key === hazard.anim)?.texture).toBe(hazard.texture);
    expect(sheetOf(art, hazard)?.frames.map((frame) => frame.name)).toEqual(['a', 'b']);
  });

  it('builds no loop that neither hazard plays', () => {
    const played = HAZARD_SLOTS.map((slot) => art.skin.objects.hazards[slot].anim);
    expect(art.loops.map((loop) => loop.key).filter((key) => !played.includes(key))).toEqual([]);
  });
});

describe('hazards on every listed course', () => {
  it.each(LISTED_COURSES.map((course) => [course.id, course] as const))(
    "keeps each hazard's body 3:1 off every contrast band of %s's theme",
    (_, course) => {
      const art = artFor(skinFor(course));
      const { contrastBands } = themeFor(course);
      for (const slot of HAZARD_SLOTS) {
        const body = bodyOf(art, art.skin.objects.hazards[slot]);
        if (body === undefined) throw new Error(`World '${art.skin.id}' builds no sheet for its ${slot}`);
        const weakest = Math.min(...contrastBands.map((band) => contrast(body, band.colour)));
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
