import { describe, expect, it } from 'vitest';
import { Frame, Tex, TileIndex } from '../keys.ts';
import { measureFrames } from '../pixel.ts';
import { ART_SHEETS } from './index.ts';

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
    for (const key of [Tex.player, Tex.tess, Tex.squib, Tex.bo, Tex.kelp, Tex.jelly]) {
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
    for (const key of [Tex.player, Tex.tess, Tex.squib, Tex.bo]) {
      expect(measureFrames(key, sheetFor(key)?.frames ?? []), key).toEqual({ width: 16, height: 12 });
    }
  });
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
