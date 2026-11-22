import { describe, expect, it } from 'vitest';
import { measureFrames } from '../pixel.ts';
import { UI_SHEETS } from './index.ts';
import { IconFrame, MedalFrame, PortraitFrame, UiTex } from './keys.ts';
import { cursorNudge } from './motion.ts';
import { DISPLAY_SHADE, PanelPalette, TEXT_SHADOW, UiColour, UiTone } from './palette.ts';
import { PANEL_INSET, PANEL_ROWS } from './panel.ts';
import { nineSlice } from './slice.ts';
import {
  DISPLAY_FACE,
  fontData,
  glyphFrames,
  measureText,
  normalizeText,
  TEXT_FACE,
  type Typeface,
} from './typeface.ts';

const sheetFor = (key: string) => UI_SHEETS.find((sheet) => sheet.key === key);
const frameNames = (key: string) => sheetFor(key)?.frames.map((frame) => frame.name);

describe('UI art data', () => {
  it.each(UI_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length, frame.name).toBeLessThanOrEqual(4);
  });

  it('draws every fixed UI texture once and the fonts separately', () => {
    const keys = UI_SHEETS.map((sheet) => sheet.key);
    expect([...keys, TEXT_FACE.key, DISPLAY_FACE.key].sort()).toEqual(Object.values(UiTex).sort());
  });

  it('has every icon, medal and portrait views ask for, at its spec size', () => {
    const cases = [
      [UiTex.icons, IconFrame, { width: 9, height: 9 }],
      [UiTex.medals, MedalFrame, { width: 12, height: 14 }],
      [UiTex.portraits, PortraitFrame, { width: 16, height: 16 }],
    ] as const;
    for (const [key, names, size] of cases) {
      expect(frameNames(key), key).toEqual(Object.values(names));
      expect(measureFrames(key, sheetFor(key)?.frames ?? []), key).toEqual(size);
    }
  });
});

describe('pixel faces', () => {
  const faces = [
    ['text', TEXT_FACE],
    ['display', DISPLAY_FACE],
  ] as const;

  it.each(faces)('the %s face builds a well-formed glyph sheet', (_, face) => {
    expect(() => measureFrames(face.key, glyphFrames(face))).not.toThrow();
  });

  it('covers every character the HUD, menus and results print', () => {
    const screens =
      'RACE AGAIN TITLE RESULTS NEW BEST! BEST TIME NOT SAVED > 1ST 2ND 3RD 4TH PIP TESS SQUIB BO DNF KICK';
    const readouts = 'BEST 0:24.46 (2ND) TICK 1234 TILE 12,7 PRESS A';
    expect(normalizeText(TEXT_FACE, screens + readouts)).toBe(screens + readouts);
    const splashes = '3 2 1 GO! FINISH! FINAL STRETCH NEW BEST DNF 1ST 2ND 3RD 4TH 0:24.46';
    expect(normalizeText(DISPLAY_FACE, splashes)).toBe(splashes);
  });

  it('draws lower case in capitals and shows "?" for a character it lacks', () => {
    expect(normalizeText(TEXT_FACE, 'Race again @ 2nd')).toBe('RACE AGAIN ? 2ND');
    expect(normalizeText(DISPLAY_FACE, 'go! #1')).toBe('GO! ?1');
  });

  it('keeps the text face monospace so padded columns and the timer line up', () => {
    expect(measureText(TEXT_FACE, '1st  Pip   ').width).toBe(measureText(TEXT_FACE, '4th  Squib ').width);
    expect(measureText(TEXT_FACE, '0:24.46')).toEqual({ width: 41, height: 7 });
  });

  it('spaces the display face by glyph width but keeps every digit the same width', () => {
    expect(measureText(DISPLAY_FACE, 'I').width).toBeLessThan(measureText(DISPLAY_FACE, 'W').width);
    const digits = [...'0123456789'].map((digit) => measureText(DISPLAY_FACE, digit).width);
    expect(new Set(digits)).toEqual(new Set([8]));
    expect(measureText(DISPLAY_FACE, '1ST', 2)).toEqual({ width: 52, height: 24 });
  });

  it('measures several lines by the widest line and the line gap', () => {
    expect(measureText(TEXT_FACE, 'AB\nC')).toEqual({ width: 11, height: 16 });
  });

  it('gives Phaser each glyph at its own column, width and advance, and an empty advancing space', () => {
    const data = fontData(DISPLAY_FACE);
    const order = glyphFrames(DISPLAY_FACE).map((frame) => frame.name);
    const x = order.indexOf('I') * 8;
    const sheetWidth = order.length * 8;
    expect(data.chars['I'.charCodeAt(0)]).toMatchObject({
      x,
      width: 6,
      height: 12,
      xAdvance: 7,
      u0: x / sheetWidth,
      u1: (x + 6) / sheetWidth,
    });
    expect(data.chars[32]).toMatchObject({ width: 0, xAdvance: DISPLAY_FACE.spaceAdvance });
    expect(data).toMatchObject({ font: UiTex.fontDisplay, size: 12, lineHeight: 14 });
  });

  it('shades the display face from row 7 down and leaves the text face one tone', () => {
    const zero = glyphFrames(DISPLAY_FACE).find((frame) => frame.name === '0');
    expect(zero?.rows[6]).toBe('00.00.00');
    expect(zero?.rows[7]).toBe('1111..11');
    expect(glyphFrames(TEXT_FACE).every((frame) => frame.rows.join('').match(/^[0.]+$/))).toBe(true);
  });

  it('names the face and glyph of a malformed glyph', () => {
    const broken: Typeface = { ...TEXT_FACE, glyphs: { A: ['00', '0', '00', '00', '00', '00', '00'] } };
    expect(() => glyphFrames(broken)).toThrow('Glyph "A" in ui-font-text row 1 is 1 px wide; expected 2 like row 0.');
    const short: Typeface = { ...TEXT_FACE, glyphs: { B: ['0'] } };
    expect(() => glyphFrames(short)).toThrow('Glyph "B" in ui-font-text is 1 rows tall; the face is 7.');
  });
});

describe('nineSlice', () => {
  const source = ['abc', 'def', 'ghi'];

  it('keeps the corners and repeats the edges and centre', () => {
    expect(nineSlice(source, 1, 5, 4)).toEqual(['abbbc', 'deeef', 'deeef', 'ghhhi']);
  });

  it('returns the corners alone at the smallest size', () => {
    expect(nineSlice(source, 1, 2, 2)).toEqual(['ac', 'gi']);
  });

  it('keeps the panel outline closed and the bevel on its sides at any size', () => {
    const rows = nineSlice(PANEL_ROWS, PANEL_INSET, 40, 15);
    expect(rows).toHaveLength(15);
    expect(rows[0]).toBe(`.${'0'.repeat(38)}.`);
    expect(rows[14]).toBe(`.${'0'.repeat(38)}.`);
    expect(rows[1]).toBe(`0${'1'.repeat(37)}20`);
    expect(rows[7]).toBe(`01${'2'.repeat(36)}30`);
  });

  it('refuses a panel too small for its corners', () => {
    expect(() => nineSlice(PANEL_ROWS, PANEL_INSET, 5, 20)).toThrow('A panel must be at least 6x6 px; got 5x20.');
  });
});

describe('cursorNudge', () => {
  it('steps the cursor fin one pixel every 16 ticks', () => {
    expect([0, 15, 16, 31, 32].map((tick) => cursorNudge(tick, false))).toEqual([0, 0, 1, 1, 0]);
  });

  it('holds the cursor fin still under reduced motion', () => {
    expect([0, 16, 48].map((tick) => cursorNudge(tick, true))).toEqual([0, 0, 0]);
  });
});

describe('UI palette contrast', () => {
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
  /** What a tinted glyph pixel looks like: Phaser multiplies the white or grey glyph by the tint. */
  const multiply = (colour: number, by: number) =>
    [16, 8, 0].reduce(
      (sum, shift) => sum | (Math.round((((colour >> shift) & 0xff) * ((by >> shift) & 0xff)) / 255) << shift),
      0,
    );
  const backings = [
    ['text shadow', TEXT_SHADOW],
    ...Object.entries(PanelPalette).map(([style, palette]) => [`${style} panel`, palette[2]] as const),
  ] as const;
  const tones = Object.entries(UiTone).flatMap(([tone, colour]) => [
    [tone, colour] as const,
    [`${tone} shaded`, multiply(colour, DISPLAY_SHADE)] as const,
  ]);

  it.each(tones)('%s text holds 4.5:1 against the shadow and every panel fill', (_, colour) => {
    for (const [name, backing] of backings) expect(contrast(colour, backing), name).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the gold frame of an accent panel 3:1 off the indigo, so selection reads without the text', () => {
    expect(contrast(UiColour.sun, UiColour.indigo)).toBeGreaterThanOrEqual(3);
  });
});
