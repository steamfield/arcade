import { describe, expect, it } from 'vitest';
import { Tex } from '../art/keys.ts';
import { measureFrames } from '../art/pixel.ts';
import { OceanTex, OceanTile } from './ocean/keys.ts';
import { HazardPalette } from './ocean/palettes.ts';
import { OCEAN_SHEETS } from './ocean/sprites/index.ts';
import { OCEAN_THEME } from './ocean.ts';

/**
 * Every texture key the game built at the end of phase 7, before the ocean art moved into its theme,
 * plus the Cannonball item's icon (v2 phase 1).
 */
const PHASE_7_KEYS = [
  'tiles',
  'coral-debris',
  'kelp',
  'current-right',
  'current-left',
  'current-up',
  'current-down',
  'finish-gate',
  'racer-rudy',
  'racer-gil',
  'racer-streak',
  'racer-onyx',
  'racer-nib',
  'racer-baron',
  'racer-selene',
  'racer-rook',
  'pearl',
  'clam',
  'urchin',
  'jelly',
  'powerup-jet-fin',
  'powerup-bubble-shield',
  'powerup-puffer',
  'powerup-ink-sac',
  'powerup-glow-lantern',
  'powerup-homing-squid',
  'powerup-riptide',
  'powerup-undertow',
  'powerup-mimic',
  'powerup-cannonball',
  'squid',
  'riptide-streak',
  'undertow-streak',
  'ink-cloud',
  'bubble',
  'loose-glow',
  'hud-marker',
  'kick-pip',
  'backdrop-far',
  'backdrop-near',
  'guide-arrow',
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

const sheetFor = (key: string) => OCEAN_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('the ocean theme', () => {
  it('registers, with the global art, exactly the texture keys phase 7 built, plus the Cannonball', () => {
    const keys = [...Object.values(Tex), ...OCEAN_SHEETS.map((sheet) => sheet.key)];
    expect(keys.sort()).toEqual([...PHASE_7_KEYS].sort());
  });

  it('draws every ocean key exactly once, as well-formed pixel text', () => {
    expect(OCEAN_SHEETS.map((sheet) => sheet.key).sort()).toEqual(Object.values(OceanTex).sort());
    for (const sheet of OCEAN_SHEETS) {
      expect(() => measureFrames(sheet.key, sheet.frames)).not.toThrow();
      for (const frame of sheet.frames) expect(frame.palette.length, sheet.key).toBeLessThanOrEqual(4);
    }
  });

  it('gives every looping texture the two frames its animation asks for', () => {
    const loops = [OceanTex.kelp, OceanTex.jelly, OceanTex.currentRight, OceanTex.currentLeft];
    for (const key of [...loops, OceanTex.currentUp, OceanTex.currentDown])
      expect(frameNames(key), key).toEqual(['a', 'b']);
  });

  it('lays the tileset out in OceanTile order on the 16 px grid, and points terrain at it', () => {
    const tiles = sheetFor(OceanTex.tiles);
    expect(tiles?.frames.map((frame) => frame.name)).toEqual(['rock', 'coral']);
    expect(Object.keys(OceanTile)).toEqual(['rock', 'coral']);
    expect(measureFrames(OceanTex.tiles, tiles?.frames ?? [])).toEqual({ width: 16, height: 16 });
    expect(OCEAN_THEME.terrain).toMatchObject({ tileset: 'tiles', tiles: { rock: 0, coral: 1 }, glyphTiles: {} });
  });

  it("keeps the urchin's body 3:1 off every ocean contrast band, so it reads in the deepest water", () => {
    const weakest = Math.min(
      ...OCEAN_THEME.contrastBands.map((band) => contrast(HazardPalette.urchin[1], band.colour)),
    );
    expect(weakest).toBeGreaterThanOrEqual(3);
  });
});
