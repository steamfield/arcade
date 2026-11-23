import { describe, expect, it } from 'vitest';
import { Tex } from '../art/keys.ts';
import { measureFrames } from '../art/pixel.ts';
import { FarItemTex, FarRacerTex, FarTex } from '../worlds/farside/keys.ts';
import { FOREST_SHEETS } from './forest/sprites/index.ts';
import { OCEAN_SHEETS } from './ocean/sprites/index.ts';
import { OCEAN_THEME } from './ocean.ts';
import { SpaceAnim, SpaceTex, SpaceTile } from './space/keys.ts';
import { SpaceHazardPalette } from './space/palettes.ts';
import { SPACE_SHEETS } from './space/sprites/index.ts';
import { SPACE_THEME } from './space.ts';

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

const sheetFor = (key: string) => SPACE_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('the space theme', () => {
  it('draws every space key exactly once, as well-formed pixel text, all prefixed space-', () => {
    expect(SPACE_SHEETS.map((sheet) => sheet.key).sort()).toEqual(Object.values(SpaceTex).sort());
    for (const sheet of SPACE_SHEETS) {
      expect(sheet.key.startsWith('space-'), sheet.key).toBe(true);
      expect(() => measureFrames(sheet.key, sheet.frames)).not.toThrow();
      for (const frame of sheet.frames) expect(frame.palette.length, sheet.key).toBeLessThanOrEqual(4);
    }
  });

  it('shares no texture or animation key with the ocean theme, the global art or the Farside skin', () => {
    const otherTextures = [
      ...OCEAN_SHEETS.map((sheet) => sheet.key),
      ...Object.values(Tex),
      ...Object.values(FarTex),
      ...Object.values(FarRacerTex),
      ...Object.values(FarItemTex),
    ];
    const otherAnims = [
      ...Object.values(OCEAN_THEME.terrain.flowing).map((art) => art.anim),
      OCEAN_THEME.hazards.jelly.anim,
    ];
    const spaceTextures: string[] = Object.values(SpaceTex);
    const spaceAnims: string[] = Object.values(SpaceAnim);
    expect(otherTextures.filter((key) => spaceTextures.includes(key))).toEqual([]);
    expect(otherAnims.filter((key) => key !== null && spaceAnims.includes(key))).toEqual([]);
  });

  it('gives every looping texture the two frames its animation asks for', () => {
    const loops = [SpaceTex.dust, SpaceTex.orb, SpaceTex.windRight, SpaceTex.windLeft];
    for (const key of [...loops, SpaceTex.windUp, SpaceTex.windDown]) expect(frameNames(key), key).toEqual(['a', 'b']);
  });

  it('lays the tileset out in SpaceTile order on the 16 px grid, and points terrain at it', () => {
    const tiles = sheetFor(SpaceTex.tiles);
    expect(tiles?.frames.map((frame) => frame.name)).toEqual(['rock', 'coral', 'ledge', 'rockBuried']);
    expect(Object.keys(SpaceTile)).toEqual(['rock', 'coral', 'ledge', 'rockBuried']);
    expect(measureFrames(SpaceTex.tiles, tiles?.frames ?? [])).toEqual({ width: 16, height: 16 });
    expect(SPACE_THEME.terrain).toMatchObject({
      tileset: 'space-tiles',
      tiles: { rock: 0, coral: 1, ledge: 2 },
      buriedTiles: { rock: 3 },
      glyphTiles: {},
    });
  });

  it('draws a ledge as a thin branch along the top of its tile and nothing below', () => {
    const ledge = sheetFor(SpaceTex.tiles)?.frames.find((frame) => frame.name === 'ledge');
    const filledRows = ledge?.rows.map((row) => /[^.]/.test(row)) ?? [];
    const firstEmptyRow = filledRows.indexOf(false);
    expect(firstEmptyRow).toBeGreaterThan(0);
    expect(firstEmptyRow).toBeLessThanOrEqual(4);
    expect(filledRows.slice(firstEmptyRow).some(Boolean)).toBe(false);
  });

  it('tiles both backdrop layers at the size the theme draws them', () => {
    const [far, near] = SPACE_THEME.backdrop.layers;
    const sizeOf = (key: string) => measureFrames(key, sheetFor(key)?.frames ?? []);
    expect(sizeOf(far?.texture ?? '').height).toBe(far?.height);
    expect(sizeOf(near?.texture ?? '').height).toBe(near?.height);
  });

  it('animates the orb and leaves the thorn bush still, in the hazard slots the views read', () => {
    expect(SPACE_THEME.hazards.urchin).toEqual({ texture: SpaceTex.mine, frame: 'a', anim: null });
    expect(SPACE_THEME.hazards.jelly).toMatchObject({ texture: SpaceTex.orb, anim: SpaceAnim.orbPulse });
  });

  it("keeps the thorn bush's body 3:1 off every space contrast band, so it reads in the darkest and lightest canopy", () => {
    const weakest = Math.min(
      ...SPACE_THEME.contrastBands.map((band) => contrast(SpaceHazardPalette.mine[1], band.colour)),
    );
    expect(weakest).toBeGreaterThanOrEqual(3);
  });

  it('lets no particle rise or fall, since nothing in space has weight', () => {
    for (const [kind, motion] of Object.entries(SPACE_THEME.particles)) expect(motion.ay, kind).toBe(0);
  });

  it("draws its own tiles, backdrop, flows and hazards: no frame is one of the forest's", () => {
    const drawn = (sheets: readonly { frames: readonly { rows: readonly string[] }[] }[]) =>
      sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.rows.join('\n')));
    const forest = new Set(drawn(FOREST_SHEETS));

    expect(drawn(SPACE_SHEETS).filter((rows) => forest.has(rows))).toHaveLength(0);
  });

  it('has a darker sky than any other theme, so stars and racers read against it', () => {
    const brightest = (theme: typeof SPACE_THEME) =>
      Math.max(...theme.backdrop.bands.map((band) => contrast(band, 0x000000)));

    expect(brightest(SPACE_THEME)).toBeLessThan(brightest(OCEAN_THEME));
    expect(brightest(SPACE_THEME)).toBeLessThanOrEqual(1.5);
  });
});
