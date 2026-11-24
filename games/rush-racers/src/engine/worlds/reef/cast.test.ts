/**
 * Reef's own cast rows: its ability wording, and its heads still tell apart on the progress strip.
 * What every world's cast shares is checked in `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { NamedFrame } from '../../art/pixel.ts';
import { REEF_CAST } from './cast.ts';
import { ReefTex } from './keys.ts';
import { REEF_FACE_SHEETS } from './sprites/portraits.ts';

const sheetFor = (key: string) => REEF_FACE_SHEETS.find((sheet) => sheet.key === key);

describe('Reef cast art', () => {
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
