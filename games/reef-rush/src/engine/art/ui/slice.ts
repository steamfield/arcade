/**
 * Nine-slice stretching on pixel text: keeps a source's corners as drawn,
 * repeats its edges along the sides and its centre across the middle, and
 * returns new pixel rows. Pure, so panel sizes are checked without a renderer;
 * `panel.ts` draws the result. Repeating rather than scaling keeps every pixel
 * on the grid.
 */
import type { PixelRows } from '../pixel.ts';

/**
 * `rows` stretched to `width` x `height`, keeping `inset` px on every side as drawn.
 *
 * @throws {Error} When the target is smaller than the two insets, or the source has no middle to repeat.
 */
export function nineSlice(rows: PixelRows, inset: number, width: number, height: number): string[] {
  const sourceHeight = rows.length;
  const sourceWidth = rows[0]?.length ?? 0;
  if (sourceWidth <= inset * 2 || sourceHeight <= inset * 2) {
    throw new Error(
      `A ${sourceWidth}x${sourceHeight} source has no middle inside a ${inset} px inset; draw it larger.`,
    );
  }
  if (width < inset * 2 || height < inset * 2) {
    throw new Error(`A panel must be at least ${inset * 2}x${inset * 2} px; got ${width}x${height}.`);
  }
  return Array.from({ length: height }, (_, y) => {
    const row = rows[sourceIndex(y, height, sourceHeight, inset)] ?? '';
    return Array.from({ length: width }, (_, x) => row[sourceIndex(x, width, sourceWidth, inset)] ?? '.').join('');
  });
}

/** Which source pixel lands at `target` along one axis: the near inset, the repeated middle, or the far inset. */
function sourceIndex(target: number, size: number, sourceSize: number, inset: number): number {
  if (target < inset) return target;
  if (target >= size - inset) return sourceSize - (size - target);
  return inset + ((target - inset) % (sourceSize - inset * 2));
}
