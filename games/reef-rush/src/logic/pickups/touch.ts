/**
 * What counts as touching a pickup: a racer's hitbox overlapping a tile or a
 * small square by some positive area. Edge-only contact doesn't count, matching
 * `overlapsTile` in `level/query.ts`, which takes a Body rather than a Box.
 */
import { hitbox } from '../racers.ts';
import { type Box, type Racer, TILE, type Vec } from '../types.ts';

/** True when two boxes share some positive area. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when the racer's hitbox overlaps tile (tile.x, tile.y). */
export function touchesTile(racer: Racer, tile: Vec): boolean {
  return boxesOverlap(hitbox(racer), { x: tile.x * TILE, y: tile.y * TILE, w: TILE, h: TILE });
}

/** True when the racer's hitbox overlaps a `size` square centred on `centre` (world px). */
export function touchesSquare(racer: Racer, centre: Vec, size: number): boolean {
  return boxesOverlap(hitbox(racer), { x: centre.x - size / 2, y: centre.y - size / 2, w: size, h: size });
}
