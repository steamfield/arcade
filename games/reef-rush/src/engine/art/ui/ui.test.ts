import { describe, expect, it } from 'vitest';
import { WATER_BANDS, WaterLight } from '../palettes.ts';
import { measureFrames, type NamedFrame } from '../pixel.ts';
import { UI_SHEETS } from './index.ts';
import { IconFrame, MedalFrame, PortraitFrame, UiTex } from './keys.ts';
import { cursorNudge } from './motion.ts';
import { DISPLAY_SHADE, OFF_PANEL_TONES, PanelPalette, TEXT_SHADOW, UiColour, UiTone } from './palette.ts';
import { PANEL_INSET, PANEL_ROWS, panelKey } from './panel.ts';
import { nineSlice } from './slice.ts';
import {
  ALL_FACES,
  DISPLAY_FACE,
  DISPLAY_SHADOW_FACE,
  fontData,
  glyphFrames,
  measureText,
  normalizeText,
  TEXT_FACE,
  TEXT_SHADOW_FACE,
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
    expect([...keys, ...ALL_FACES.map((face) => face.key)].sort()).toEqual(Object.values(UiTex).sort());
  });

  it('has every icon, medal and portrait views ask for, at its spec size', () => {
    const cases = [
      [UiTex.icons, IconFrame, { width: 9, height: 9 }],
      [UiTex.medals, MedalFrame, { width: 12, height: 14 }],
      [UiTex.portraits, PortraitFrame, { width: 16, height: 16 }],
      [UiTex.heads, PortraitFrame, { width: 7, height: 7 }],
    ] as const;
    for (const [key, names, size] of cases) {
      expect(frameNames(key), key).toEqual(Object.values(names));
      expect(measureFrames(key, sheetFor(key)?.frames ?? []), key).toEqual(size);
    }
  });
});

describe('progress-strip heads', () => {
  const heads = sheetFor(UiTex.heads)?.frames ?? [];
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
      'RACE AGAIN TITLE RESULTS NEW BEST! BEST TIME NOT SAVED > 1ST 2ND 3RD 4TH DNF KICK ' +
      'RUDY GIL STREAK ONYX NIB BARON BARNACLE SELENE ROOK WIND-UP HOLDS 4 POWER-UPS, NOT 3';
    const readouts = 'BEST 0:24.46 (2ND) TICK 1234 TILE 12,7 PRESS A';
    expect(normalizeText(TEXT_FACE, screens + readouts)).toBe(screens + readouts);
    const splashes = '3 2 1 GO! FINISH! FINAL STRETCH NEW BEST DNF 1ST 2ND 3RD 4TH 0:24.46 PICK A RACER';
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

  it.each([
    ['text', TEXT_FACE, TEXT_SHADOW_FACE],
    ['display', DISPLAY_FACE, DISPLAY_SHADOW_FACE],
  ] as const)('bakes an ink copy of the %s face with the same glyph layout, so shadows line up', (_, face, ink) => {
    expect(fontData(ink).chars).toEqual(fontData(face).chars);
    expect(glyphFrames(ink).map((frame) => frame.rows)).toEqual(glyphFrames(face).map((frame) => frame.rows));
    expect(new Set(ink.palette)).toEqual(new Set([TEXT_SHADOW]));
    expect(ink.key).not.toBe(face.key);
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

  it('keys panels by whole-pixel size and refuses fractional sizes', () => {
    expect(panelKey('raised', 56, 24)).toBe('ui-panel-raised-56x24');
    expect(() => panelKey('accent', 56.5, 24)).toThrow('Panel size must be whole pixels; got 56.5x24.');
    expect(() => panelKey('inset', 52, 14.2)).toThrow('Panel size must be whole pixels; got 52x14.2.');
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

  /** A colour seen through translucent light, as the backdrop draws it. */
  const over = (base: number, light: number, alpha: number) =>
    [16, 8, 0].reduce(
      (sum, shift) =>
        sum | (Math.round(((base >> shift) & 0xff) * (1 - alpha) + ((light >> shift) & 0xff) * alpha) << shift),
      0,
    );
  // The brightest water on screen: the shallowest band under the caustics (alpha 0.22) and a god ray
  // (alpha 0.05), the alphas `view/backdrop.ts` draws them at.
  const brightestWater = over(over(WATER_BANDS[0] ?? 0, WaterLight.caustic, 0.22), WaterLight.ray, 0.05);
  const water = [...WATER_BANDS, brightestWater];
  const offPanel = OFF_PANEL_TONES.flatMap((tone) => [
    [tone, UiTone[tone], 4.5] as const,
    // Display text is large text, where WCAG asks 3:1.
    [`${tone} shaded`, multiply(UiTone[tone], DISPLAY_SHADE), 3] as const,
  ]);

  it.each(offPanel)('outlined %s text separates from every water colour', (_, colour, minimum) => {
    // Each glyph pixel touches its ink outline; where the water is too light for the glyph, the outline carries the edge.
    for (const backing of water) {
      const separated = contrast(colour, backing) >= minimum || contrast(TEXT_SHADOW, backing) >= 3;
      expect(separated, `#${backing.toString(16)}`).toBe(true);
    }
  });

  it('keeps coral and dim on panels: they fall under 4.5:1 on the water', () => {
    const offPanelUnsafe = (['coral', 'dim'] as const).filter((tone) =>
      water.some((backing) => contrast(UiTone[tone], backing) < 4.5),
    );
    expect(offPanelUnsafe).toEqual(['coral', 'dim']);
    expect(OFF_PANEL_TONES).toEqual(['foam', 'sun']);
  });

  /** Pixels on a frame's silhouette: lit, with a transparent or out-of-frame neighbour. */
  const edgeColours = (frame: NamedFrame) => {
    const at = (x: number, y: number) => frame.rows[y]?.[x] ?? '.';
    const colours = new Set<number>();
    frame.rows.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel === '.') return;
        const open = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.');
        if (open) colours.add(frame.palette[Number(pixel)] ?? 0);
      });
    });
    return [...colours];
  };
  const iconFrames = [UiTex.icons, UiTex.medals].flatMap(
    (key) => UI_SHEETS.find((sheet) => sheet.key === key)?.frames ?? [],
  );

  it.each(iconFrames.map((frame) => [frame.name, frame] as const))(
    '%s keeps its silhouette 3:1 off the indigo panel and the inset well',
    (_, frame) => {
      for (const colour of edgeColours(frame)) {
        for (const backing of [UiColour.indigo, PanelPalette.inset[2]]) {
          expect(
            contrast(colour, backing),
            `#${colour.toString(16)} on #${backing.toString(16)}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
