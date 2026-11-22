import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame, Tex, TileIndex } from '../keys.ts';
import { BackdropPalette, HazardPalette, WATER_BANDS } from '../palettes.ts';
import { measureFrames } from '../pixel.ts';
import { ART_SHEETS } from './index.ts';
import { CharacterPalette, RACER_SHEETS } from './racers.ts';

/** Every character's racer texture. */
const RACER_KEYS = CHARACTER_IDS.map((character) => Tex[character]);
const sheetFor = (key: string) => ART_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('world art data', () => {
  it('draws every texture key exactly once', () => {
    const keys = ART_SHEETS.map((sheet) => sheet.key);
    expect([...keys].sort()).toEqual(Object.values(Tex).sort());
  });

  it.each(ART_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length).toBeLessThanOrEqual(4);
  });

  it('gives animated and multi-state textures the frame names views and animations ask for', () => {
    const twoStroke = [Frame.a, Frame.b];
    for (const key of [...RACER_KEYS, Tex.kelp, Tex.jelly]) {
      expect(frameNames(key), key).toEqual(twoStroke);
    }
    for (const key of [Tex.currentRight, Tex.currentLeft, Tex.currentUp, Tex.currentDown]) {
      expect(frameNames(key), key).toEqual(twoStroke);
    }
    expect(frameNames(Tex.clam)).toEqual([Frame.clamClosed, Frame.clamOpen]);
    expect(frameNames(Tex.kickPip)).toEqual([Frame.pipReady, Frame.pipCooling]);
    expect(frameNames(Tex.hudMarker)).toEqual([
      Frame.markerCircle,
      Frame.markerSquare,
      Frame.markerTriangle,
      Frame.markerDiamond,
    ]);
  });

  it('lays the tileset out in TileIndex order on the 16 px grid', () => {
    const tiles = sheetFor(Tex.tiles);
    expect(tiles?.frames.map((frame) => frame.name)).toEqual(['rock', 'coral']);
    expect(tiles?.frames.length).toBe(Object.keys(TileIndex).length);
    expect(measureFrames(Tex.tiles, tiles?.frames ?? [])).toEqual({ width: 16, height: 16 });
  });

  it('keeps racers within 16x12 so they fit around their 12x10 bodies', () => {
    for (const key of RACER_KEYS) {
      expect(measureFrames(key, sheetFor(key)?.frames ?? []), key).toEqual({ width: 16, height: 12 });
    }
  });
});

describe('world art palettes', () => {
  /** WCAG relative luminance of a 0xRRGGBB colour. */
  const luminance = (colour: number) => {
    const linear = [16, 8, 0].map((shift) => {
      const c = ((colour >> shift) & 0xff) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const contrast = (a: number, b: number) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };
  const behind = [...WATER_BANDS, ...BackdropPalette.far, ...BackdropPalette.near];
  const readable = (colour: number) => Math.min(...behind.map((water) => contrast(colour, water))) >= 3;
  const mainColours = [
    ...CHARACTER_IDS.map((character) => [character, CharacterPalette[character][1]] as const),
    ['urchin', HazardPalette.urchin[1]] as const,
  ];

  it.each(mainColours)('%s main colour stands 3:1 off every water band and backdrop layer', (_, colour) => {
    const weakest = Math.min(...behind.map((water) => contrast(colour, water)));
    expect(weakest).toBeGreaterThanOrEqual(3);
  });

  it.each(RACER_SHEETS.flatMap((sheet) => sheet.frames.map((frame) => [sheet.key, frame.name, frame] as const)))(
    '%s frame %s draws at least a quarter of its pixels in colours that stand 3:1 off the water',
    (_, __, frame) => {
      const pixels = [...frame.rows.join('')].filter((pixel) => pixel !== '.');
      const bright = pixels.filter((pixel) => readable(frame.palette[Number(pixel)] ?? 0));
      expect(bright.length / pixels.length).toBeGreaterThanOrEqual(0.25);
    },
  );
});

describe('measureFrames', () => {
  const palette = [0x000000, 0xffffff];

  it('names the key, frame and row of a ragged row', () => {
    const frames = [{ name: 'a', palette, rows: ['01', '0', '10'] }];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "a" row 1 is 1 px wide; expected 2. Pad or trim the row.',
    );
  });

  it('names the pixel that uses a colour the palette lacks', () => {
    const frames = [{ name: 'b', palette, rows: ['01', '02'] }];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "b" row 1 col 1 uses "2", but its palette has 2 colours. Use "." or a digit from 0 to 1.',
    );
  });

  it('rejects characters that are neither "." nor a digit', () => {
    const frames = [{ name: 'a', palette, rows: ['0 '] }];
    expect(() => measureFrames('blob', frames)).toThrow('row 0 col 1 uses " "');
  });

  it('rejects two frames with the same name, which would overwrite each other in the texture', () => {
    const frames = [
      { name: 'a', palette, rows: ['01'] },
      { name: 'a', palette, rows: ['10'] },
    ];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" has two frames named "a"; give each frame its own name.',
    );
  });

  it('rejects frames of different heights in one sheet', () => {
    const frames = [
      { name: 'a', palette, rows: ['01', '10'] },
      { name: 'b', palette, rows: ['01'] },
    ];
    expect(() => measureFrames('blob', frames)).toThrow(
      'Sprite "blob" frame "b" is 1 rows tall; every frame must be 2 like the first.',
    );
  });
});
