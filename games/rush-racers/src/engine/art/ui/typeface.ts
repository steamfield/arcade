/**
 * The two pixel faces as data, and the pure work of turning them into a glyph
 * sheet and Phaser bitmap-font data: glyph layout, text normalising and
 * measuring. No renderer here, so the font can be checked in a unit test;
 * `fonts.ts` does the drawing and registration.
 */
import type { NamedFrame, Palette, PixelRows } from '../pixel.ts';
import { DISPLAY_GLYPHS } from './display-face.ts';
import { UiTex } from './keys.ts';
import { DISPLAY_SHADE, TEXT_SHADOW } from './palette.ts';
import { TEXT_GLYPHS } from './text-face.ts';

/** A pixel face: its glyphs and how they sit on the line. */
export interface Typeface {
  /** Texture and bitmap-font key. */
  key: string;
  glyphs: Readonly<Record<string, PixelRows>>;
  /** Glyph height in px; every glyph has exactly this many rows. */
  height: number;
  /** Blank px between lines. */
  lineGap: number;
  /** Blank px after each glyph. */
  letterSpacing: number;
  /** How far a space moves the pen. */
  spaceAdvance: number;
  /** Rows from this index down are drawn in the shade colour (palette index 1). Omit for one tone. */
  shadeFromRow?: number;
  /** White, then the shade grey: the label's tint colours both. */
  palette: Palette;
}

/** The 5x7 text face on a 6 px pitch. */
export const TEXT_FACE: Typeface = {
  key: UiTex.fontText,
  glyphs: TEXT_GLYPHS,
  height: 7,
  lineGap: 2,
  letterSpacing: 1,
  spaceAdvance: 6,
  palette: [0xffffff],
};

/** The 12 px display face, shaded on its lower five rows. */
export const DISPLAY_FACE: Typeface = {
  key: UiTex.fontDisplay,
  glyphs: DISPLAY_GLYPHS,
  height: 12,
  lineGap: 2,
  letterSpacing: 1,
  spaceAdvance: 5,
  shadeFromRow: 7,
  palette: [0xffffff, DISPLAY_SHADE],
};

/**
 * The same face drawn solid ink, under its own key, for label shadows and outlines. Baking the
 * colour in rather than tinting keeps shadows on renderers that ignore tint (Canvas).
 */
function inkCopy(face: Typeface, key: string): Typeface {
  return { ...face, key, palette: [TEXT_SHADOW, TEXT_SHADOW] };
}

/** The text face in solid ink. */
export const TEXT_SHADOW_FACE = inkCopy(TEXT_FACE, UiTex.fontTextShadow);

/** The display face in solid ink. */
export const DISPLAY_SHADOW_FACE = inkCopy(DISPLAY_FACE, UiTex.fontDisplayShadow);

/** Every face the fonts module draws and registers. */
export const ALL_FACES: readonly Typeface[] = [TEXT_FACE, DISPLAY_FACE, TEXT_SHADOW_FACE, DISPLAY_SHADOW_FACE];

/** Shown in place of any character a face has no glyph for. */
const FALLBACK = '?';

/** One glyph's entry in Phaser's bitmap-font data (Phaser's type omits `xAdvance`, which its renderer reads). */
interface GlyphData {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  data: object;
  kerning: Record<string, number>;
}

/** Bitmap-font data in the shape `scene.cache.bitmapFont` expects. */
interface FontData {
  font: string;
  size: number;
  lineHeight: number;
  retroFont: boolean;
  chars: Record<number, GlyphData>;
}

/** Width and height of a piece of text, in px at the given scale. */
interface TextSize {
  width: number;
  height: number;
}

/** The widest glyph: the face's cell width on the glyph sheet. */
function cellWidth(face: Typeface): number {
  return Math.max(...Object.values(face.glyphs).map((rows) => rows[0]?.length ?? 0));
}

/**
 * The glyph sheet's frames: one per character, named by the character, padded on the right to the
 * cell width, with the shaded rows switched to palette index 1.
 *
 * @throws {Error} Naming the face and character when a glyph is the wrong height or has ragged rows.
 */
export function glyphFrames(face: Typeface): NamedFrame[] {
  const width = cellWidth(face);
  return Object.entries(face.glyphs).map(([char, rows]) => {
    checkGlyph(face, char, rows);
    const shaded = rows.map((row, y) =>
      face.shadeFromRow !== undefined && y >= face.shadeFromRow ? row.replaceAll('0', '1') : row,
    );
    return { name: char, palette: face.palette, rows: shaded.map((row) => row.padEnd(width, '.')) };
  });
}

/**
 * Phaser bitmap-font data for the glyph sheet `glyphFrames` lays out: each glyph keeps its own
 * width so proportional faces space correctly, and advances by that width plus the letter spacing.
 */
export function fontData(face: Typeface): FontData {
  const cell = cellWidth(face);
  const sheetWidth = cell * Object.keys(face.glyphs).length;
  const chars: Record<number, GlyphData> = {};
  Object.entries(face.glyphs).forEach(([char, rows], index) => {
    const x = index * cell;
    const width = rows[0]?.length ?? 0;
    chars[char.charCodeAt(0)] = glyph(x, width, face.height, width + face.letterSpacing, sheetWidth);
  });
  // The renderer skips drawing spaces but still advances the pen by their xAdvance.
  chars[32] = glyph(0, 0, face.height, face.spaceAdvance, sheetWidth);
  return { font: face.key, size: face.height, lineHeight: face.height + face.lineGap, retroFont: true, chars };
}

/** Text as the face will draw it: capitals, with any character it lacks shown as "?". */
export function normalizeText(face: Typeface, text: string): string {
  return [...text.toUpperCase()]
    .map((char) => (char === ' ' || char === '\n' || face.glyphs[char] ? char : FALLBACK))
    .join('');
}

/** The pixel size `text` takes in `face` at an integer `scale`, ignoring the trailing letter space. */
export function measureText(face: Typeface, text: string, scale = 1): TextSize {
  const lines = normalizeText(face, text).split('\n');
  const width = Math.max(...lines.map((line) => lineWidth(face, line)));
  const height = lines.length * (face.height + face.lineGap) - face.lineGap;
  return { width: width * scale, height: height * scale };
}

function lineWidth(face: Typeface, line: string): number {
  if (line.length === 0) return 0;
  let width = 0;
  for (const char of line) {
    width += char === ' ' ? face.spaceAdvance : (face.glyphs[char]?.[0]?.length ?? 0) + face.letterSpacing;
  }
  // The last glyph's spacing is empty air; a trailing space still counts, as it does in Phaser.
  return line.endsWith(' ') ? width : width - face.letterSpacing;
}

function glyph(x: number, width: number, height: number, xAdvance: number, sheetWidth: number): GlyphData {
  return {
    x,
    y: 0,
    width,
    height,
    centerX: Math.floor(width / 2),
    centerY: Math.floor(height / 2),
    xOffset: 0,
    yOffset: 0,
    xAdvance,
    // Phaser's WebGL texture coordinates run bottom-up, as its own retro-font parser writes them.
    u0: x / sheetWidth,
    v0: 1,
    u1: (x + width) / sheetWidth,
    v1: 0,
    data: {},
    kerning: {},
  };
}

function checkGlyph(face: Typeface, char: string, rows: PixelRows): void {
  const where = `Glyph "${char}" in ${face.key}`;
  if (rows.length !== face.height) {
    throw new Error(`${where} is ${rows.length} rows tall; the face is ${face.height}. Add or remove rows.`);
  }
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`${where} row ${y} is ${row.length} px wide; expected ${width} like row 0.`);
  });
}
