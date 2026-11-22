/**
 * Box geometry shared by everything in `hazards/` and `powerups/` that touches something: whether two
 * boxes overlap and the square around a point. Pure functions over world pixels.
 */
import type { Box, Vec } from '../types.ts';

/** True when two boxes overlap by any positive area; touching edges don't count. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** The `size`-sided square centred on a point. */
export function squareAt(centre: Vec, size: number): Box {
  return { x: centre.x - size / 2, y: centre.y - size / 2, w: size, h: size };
}
