import { describe, expect, it } from 'vitest';
import { Tex } from '../art/keys.ts';
import { measureFrames } from '../art/pixel.ts';
import { ReefItemTex, ReefRacerTex, ReefTex } from '../worlds/reef/keys.ts';
import { REEF_HAZARD_LOOPS, REEF_HAZARD_SHEETS } from '../worlds/reef/sprites/hazards.ts';
import { ThornItemTex, ThornRacerTex, ThornTex } from '../worlds/thornwood/keys.ts';
import { THORN_HAZARD_LOOPS, THORN_HAZARD_SHEETS } from '../worlds/thornwood/sprites/hazards.ts';
import { ForestAnim, ForestTex, ForestTile } from './forest/keys.ts';
import { FOREST_SHEETS } from './forest/sprites/index.ts';
import { FOREST_THEME } from './forest.ts';
import { OCEAN_SHEETS } from './ocean/sprites/index.ts';
import { OCEAN_THEME } from './ocean.ts';

const sheetFor = (key: string) => FOREST_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('the forest theme', () => {
  it('draws every forest key exactly once, as well-formed pixel text, all prefixed forest-', () => {
    expect(FOREST_SHEETS.map((sheet) => sheet.key).sort()).toEqual(Object.values(ForestTex).sort());
    for (const sheet of FOREST_SHEETS) {
      expect(sheet.key.startsWith('forest-'), sheet.key).toBe(true);
      expect(() => measureFrames(sheet.key, sheet.frames)).not.toThrow();
      for (const frame of sheet.frames) expect(frame.palette.length, sheet.key).toBeLessThanOrEqual(4);
    }
  });

  it('shares no texture or animation key with the ocean theme, the global art or the Thornwood skin', () => {
    const otherTextures = [
      ...OCEAN_SHEETS.map((sheet) => sheet.key),
      ...Object.values(Tex),
      ...Object.values(ReefTex),
      ...Object.values(ReefRacerTex),
      ...Object.values(ReefItemTex),
      ...Object.values(ThornTex),
      ...Object.values(ThornRacerTex),
      ...Object.values(ThornItemTex),
      ...[...REEF_HAZARD_SHEETS, ...THORN_HAZARD_SHEETS].map((sheet) => sheet.key),
    ];
    const otherAnims = [
      ...Object.values(OCEAN_THEME.terrain.flowing).map((art) => art.anim),
      ...[...REEF_HAZARD_LOOPS, ...THORN_HAZARD_LOOPS].map((loop) => loop.key),
    ];
    const forestTextures: string[] = Object.values(ForestTex);
    const forestAnims: string[] = Object.values(ForestAnim);
    expect(otherTextures.filter((key) => forestTextures.includes(key))).toEqual([]);
    expect(otherAnims.filter((key) => forestAnims.includes(key))).toEqual([]);
  });

  it('gives every looping texture the two frames its animation asks for', () => {
    const loops = [ForestTex.mud, ForestTex.windRight, ForestTex.windLeft];
    for (const key of [...loops, ForestTex.windUp, ForestTex.windDown])
      expect(frameNames(key), key).toEqual(['a', 'b']);
  });

  it('lays the tileset out in ForestTile order on the 16 px grid, and points terrain at it', () => {
    const tiles = sheetFor(ForestTex.tiles);
    expect(tiles?.frames.map((frame) => frame.name)).toEqual(['rock', 'coral', 'ledge', 'rockBuried', 'bounce']);
    expect(Object.keys(ForestTile)).toEqual(['rock', 'coral', 'ledge', 'rockBuried', 'bounce']);
    expect(measureFrames(ForestTex.tiles, tiles?.frames ?? [])).toEqual({ width: 16, height: 16 });
    expect(FOREST_THEME.terrain).toMatchObject({
      tileset: 'forest-tiles',
      tiles: { rock: 0, coral: 1, ledge: 2 },
      buriedTiles: { rock: 3 },
      glyphTiles: {},
    });
  });

  it('draws a ledge as a thin branch along the top of its tile and nothing below', () => {
    const ledge = sheetFor(ForestTex.tiles)?.frames.find((frame) => frame.name === 'ledge');
    const filledRows = ledge?.rows.map((row) => /[^.]/.test(row)) ?? [];
    const firstEmptyRow = filledRows.indexOf(false);
    expect(firstEmptyRow).toBeGreaterThan(0);
    expect(firstEmptyRow).toBeLessThanOrEqual(4);
    expect(filledRows.slice(firstEmptyRow).some(Boolean)).toBe(false);
  });

  it('tiles both backdrop layers at the size the theme draws them', () => {
    const [far, near] = FOREST_THEME.backdrop.layers;
    const sizeOf = (key: string) => measureFrames(key, sheetFor(key)?.frames ?? []);
    expect(sizeOf(far?.texture ?? '').height).toBe(far?.height);
    expect(sizeOf(near?.texture ?? '').height).toBe(near?.height);
  });

  it('drops air particles faster than the ocean and with less drag', () => {
    expect(FOREST_THEME.particles.fall.ay).toBeGreaterThan(OCEAN_THEME.particles.fall.ay);
    expect(FOREST_THEME.particles.fall.drag).toBeGreaterThan(OCEAN_THEME.particles.fall.drag);
    expect(Math.abs(FOREST_THEME.particles.rise.ay)).toBeLessThan(0.025);
  });
});
