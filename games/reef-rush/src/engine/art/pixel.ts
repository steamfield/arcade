/**
 * Turns palette-indexed text into textures: one string per pixel row, one
 * character per pixel, `.` transparent and digits indexing the palette. Every
 * sprite, tile, icon and glyph in the game is authored this way.
 *
 * Checking the text (`measureFrames`) is separate from drawing it, so the art
 * data can be validated in a unit test without a renderer.
 */
import type Phaser from 'phaser';

/** Colours for one sprite: index 0 is the first digit, `0`. At most 4 entries by the art spec. */
export type Palette = readonly number[];

/** One frame of pixel rows, all the same width. */
export type PixelRows = readonly string[];

/** One frame of a sheet with its own frame name and palette, for sheets whose frames are different sprites. */
export interface NamedFrame {
  name: string;
  rows: PixelRows;
  palette: Palette;
}

/** Width and height shared by every frame of a sheet, in pixels. */
export interface FrameSize {
  width: number;
  height: number;
}

const TRANSPARENT = '.';
const DIGITS = '0123456789';

/**
 * Draws one sprite into a texture under `key`.
 *
 * @throws {Error} Naming the key and row when rows differ in width or a digit has no palette entry.
 */
export function drawSprite(scene: Phaser.Scene, key: string, rows: PixelRows, palette: Palette): void {
  drawFrames(scene, key, [{ name: '0', rows, palette }]);
}

/**
 * Draws equal-sized frames side by side into one texture under `key`, adding a frame per entry
 * (named by its index as a string) so animations and sprites can address them.
 *
 * @throws {Error} Naming the key, frame and row when frames differ in size or a digit has no palette entry.
 */
export function drawSheet(scene: Phaser.Scene, key: string, frames: readonly PixelRows[], palette: Palette): void {
  drawFrames(
    scene,
    key,
    frames.map((rows, index) => ({ name: String(index), rows, palette })),
  );
}

/**
 * Draws equal-sized frames side by side into one texture under `key`, each with its own name and
 * palette. A key that already exists is left alone, so building the art twice changes nothing.
 *
 * @throws {Error} Naming the key, frame and row when frames differ in size or a pixel is not `.` or a palette index.
 */
export function drawFrames(scene: Phaser.Scene, key: string, frames: readonly NamedFrame[]): void {
  const size = measureFrames(key, frames);
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({}, false);
  frames.forEach((frame, index) => {
    paintFrame(graphics, frame, index * size.width);
  });
  graphics.generateTexture(key, size.width * frames.length, size.height);
  graphics.destroy();

  const texture = scene.textures.get(key);
  frames.forEach((frame, index) => {
    texture.add(frame.name, 0, index * size.width, 0, size.width, size.height);
  });
}

/**
 * Checks that every frame is a rectangle of the same size and that every pixel is `.` or a digit
 * its palette has, and returns that size.
 *
 * @throws {Error} Naming the key, frame, row and column of the first problem found.
 */
export function measureFrames(key: string, frames: readonly NamedFrame[]): FrameSize {
  const first = frames[0];
  if (!first || first.rows.length === 0) throw new Error(`Sprite "${key}" has no pixels; give it at least one row.`);
  const size = { width: first.rows[0]?.length ?? 0, height: first.rows.length };
  for (const frame of frames) checkFrame(key, frame, size);
  return size;
}

function checkFrame(key: string, frame: NamedFrame, size: FrameSize): void {
  const where = `Sprite "${key}" frame "${frame.name}"`;
  if (frame.rows.length !== size.height) {
    throw new Error(`${where} is ${frame.rows.length} rows tall; every frame must be ${size.height} like the first.`);
  }
  frame.rows.forEach((row, y) => {
    if (row.length !== size.width) {
      throw new Error(`${where} row ${y} is ${row.length} px wide; expected ${size.width}. Pad or trim the row.`);
    }
    for (let x = 0; x < row.length; x++) {
      const pixel = row[x] ?? TRANSPARENT;
      if (pixel !== TRANSPARENT && frame.palette[DIGITS.indexOf(pixel)] === undefined) {
        throw new Error(
          `${where} row ${y} col ${x} uses "${pixel}", but its palette has ${frame.palette.length} colours. ` +
            `Use "." or a digit from 0 to ${frame.palette.length - 1}.`,
        );
      }
    }
  });
}

/** Fills each run of same-coloured pixels in a row with one rect, which keeps the draw calls few. */
function paintFrame(graphics: Phaser.GameObjects.Graphics, frame: NamedFrame, offsetX: number): void {
  frame.rows.forEach((row, y) => {
    let start = 0;
    while (start < row.length) {
      const pixel = row[start] ?? TRANSPARENT;
      let end = start + 1;
      while (end < row.length && row[end] === pixel) end++;
      const colour = frame.palette[DIGITS.indexOf(pixel)];
      if (pixel !== TRANSPARENT && colour !== undefined) {
        graphics.fillStyle(colour, 1);
        graphics.fillRect(offsetX + start, y, end - start, 1);
      }
      start = end;
    }
  });
}
