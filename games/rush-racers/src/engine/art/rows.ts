/**
 * Small transforms on pixel rows, so a sprite's second frame or its mirror image is derived from
 * one drawing instead of being typed twice, or a 9x9 HUD icon doubles as a 12x12 world sprite.
 */
import type { PixelRows } from './pixel.ts';

/** `rows` (9x9) centred in a 12x12 frame: one px of margin above and left, two below and right. */
export function worldIcon(rows: PixelRows): PixelRows {
  const blank = '.'.repeat(12);
  return [blank, ...rows.map((row) => `.${row}..`), blank, blank];
}

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

/** Each row of `halves` followed by its mirror image, so a left-right symmetric sprite is drawn once. */
export function mirroredRows(halves: PixelRows): PixelRows {
  return halves.map((half) => half + [...half].reverse().join(''));
}

/** `rows` turned on their diagonal, so column `x` becomes row `x`: a drawing running right then runs down. */
export function transposeRows(rows: PixelRows): PixelRows {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, x) => rows.map((row) => row[x] ?? '.').join(''));
}
