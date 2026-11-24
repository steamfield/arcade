/**
 * Farside's own cast rows: its ability wording, and racers, portraits and heads that are its own
 * drawings in its own palettes, not Thornwood's. What every world's cast shares is checked in
 * `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { ThornwoodPalette } from '../thornwood/sprites/palette.ts';
import { THORNWOOD_FACE_SHEETS } from '../thornwood/sprites/portraits.ts';
import { THORNWOOD_RACER_SHEETS } from '../thornwood/sprites/racers.ts';
import { FARSIDE_CAST } from './cast.ts';
import { FarsidePalette } from './sprites/palette.ts';
import { FARSIDE_FACE_SHEETS } from './sprites/portraits.ts';
import { FARSIDE_RACER_SHEETS } from './sprites/racers.ts';

describe('Farside cast', () => {
  it("words the spring slot's ability as a burn, since space has no jump", () => {
    expect(FARSIDE_CAST.abilities.gil.name).toBe('SPRING BURN');
  });

  it("draws its own racers, portraits and heads: no frame is one of Thornwood's", () => {
    const drawn = (sheets: readonly { frames: readonly { rows: readonly string[] }[] }[]) =>
      sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.rows.join('\n')));
    const thornwood = new Set(drawn([...THORNWOOD_RACER_SHEETS, ...THORNWOOD_FACE_SHEETS]));
    const copied = drawn([...FARSIDE_RACER_SHEETS, ...FARSIDE_FACE_SHEETS]).filter((rows) => thornwood.has(rows));

    expect(copied).toHaveLength(0);
  });

  it("colours every slot in a palette of its own, not Thornwood's", () => {
    for (const slot of CHARACTER_IDS) expect(FarsidePalette[slot], slot).not.toEqual(ThornwoodPalette[slot]);
  });
});
