/**
 * Reef's cast art: every slot has a 16x12 racer with two stroke frames, a 16x16 portrait and a 7x7
 * head named by slot, and the heads still tell apart on the progress strip.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { measureFrames, type NamedFrame } from '../../art/pixel.ts';
import { REEF_CAST } from './cast.ts';
import { ReefCastFrame, ReefRacerTex, ReefTex } from './keys.ts';
import { REEF_FACE_SHEETS } from './sprites/portraits.ts';
import { REEF_RACER_SHEETS } from './sprites/racers.ts';

const SHEETS = [...REEF_RACER_SHEETS, ...REEF_FACE_SHEETS];
const sheetFor = (key: string) => SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);
const sizeOf = (key: string) => measureFrames(key, sheetFor(key)?.frames ?? []);

describe('Reef cast art', () => {
  it.each(CHARACTER_IDS)('draws %s as a 16x12 racer with swim-stroke frames a and b', (slot) => {
    expect(frameNames(ReefRacerTex[slot])).toEqual([Frame.a, Frame.b]);
    expect(sizeOf(ReefRacerTex[slot])).toEqual({ width: 16, height: 12 });
  });

  it('draws a 16x16 portrait and a 7x7 head for every slot, named by slot', () => {
    const names = CHARACTER_IDS.map((slot) => ReefCastFrame[slot]);
    expect(frameNames(ReefTex.portraits)).toEqual(names);
    expect(frameNames(ReefTex.heads)).toEqual(names);
    expect(sizeOf(ReefTex.portraits)).toEqual({ width: 16, height: 16 });
    expect(sizeOf(ReefTex.heads)).toEqual({ width: 7, height: 7 });
  });

  it('points the cast skin at the sheets it draws', () => {
    for (const slot of CHARACTER_IDS) {
      expect(sheetFor(REEF_CAST.racers[slot]), slot).toBeDefined();
      for (const ref of [REEF_CAST.portraits[slot], REEF_CAST.heads[slot]]) {
        expect(frameNames(ref.texture), slot).toContain(ref.frame);
      }
    }
  });

  it("keeps Reef's own ability wording for the Spring Kick seahorse", () => {
    expect(REEF_CAST.abilities.gil.name).toBe('SPRING KICK');
  });
});

describe('Reef progress-strip heads', () => {
  const heads = sheetFor(ReefTex.heads)?.frames ?? [];
  const pairs = heads.flatMap((a, i) => heads.slice(i + 1).map((b) => [a.name, b.name, a, b] as const));
  /** Pixels where two equal-sized frames disagree, after mapping each pixel through `look`. */
  const difference = (a: NamedFrame, b: NamedFrame, look: (frame: NamedFrame, pixel: string) => number) => {
    const left = [...a.rows.join('')];
    const right = [...b.rows.join('')];
    return left.filter((pixel, index) => look(a, pixel) !== look(b, right[index] ?? '.')).length;
  };
  // The strip well is near black, so the outline colour reads as background there, not shape.
  const silhouette = (_: NamedFrame, pixel: string) => (pixel === '.' || pixel === '0' ? 0 : 1);
  /** Four gray levels by Rec. 709 luma, with transparent as its own level, the way a grayscale capture reads. */
  const grayLevel = (frame: NamedFrame, pixel: string) => {
    if (pixel === '.') return -1;
    const colour = frame.palette[Number(pixel)] ?? 0;
    const luma = 0.2126 * ((colour >> 16) & 0xff) + 0.7152 * ((colour >> 8) & 0xff) + 0.0722 * (colour & 0xff);
    return Math.min(3, Math.floor(luma / 64));
  };

  it.each(pairs)('%s and %s have different outline shapes', (_, __, a, b) => {
    expect(difference(a, b, silhouette)).toBeGreaterThanOrEqual(8);
  });

  it.each(pairs)('%s and %s still tell apart in grayscale', (_, __, a, b) => {
    expect(difference(a, b, grayLevel)).toBeGreaterThanOrEqual(16);
  });
});
