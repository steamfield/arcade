/**
 * Small transforms on pixel rows, so a sprite's second frame or its mirror image is derived from
 * one drawing instead of being typed twice.
 */
import type { PixelRows } from '../../../art/pixel.ts';

/** `rows` flipped left to right. */
export function mirrorRows(rows: PixelRows): PixelRows {
  return rows.map((row) => [...row].reverse().join(''));
}

/** `rows` flipped top to bottom. */
export function flipRows(rows: PixelRows): PixelRows {
  return [...rows].reverse();
}

/** The remainder of `value` over `size`, never negative. */
function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** `rows` moved `dx` pixels right and `dy` down (negative for left and up), wrapping at the edges so a seamless tile stays seamless. */
export function shiftRows(rows: PixelRows, dx: number, dy: number): PixelRows {
  return rows.map((_, y) => {
    const source = rows[wrap(y - dy, rows.length)] ?? '';
    const cut = wrap(-dx, source.length);
    return source.slice(cut) + source.slice(0, cut);
  });
}
