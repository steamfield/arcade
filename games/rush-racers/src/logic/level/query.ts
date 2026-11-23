/**
 * Read-only questions about a Level's tiles: what is at a tile, what is solid (to the level alone,
 * and to a moving body under a medium's rules), which tiles a body covers, and what the water does
 * at a body's centre.
 */
import {
  type Body,
  type Box,
  type Cell,
  type Environment,
  type Level,
  type MoveRules,
  TILE,
  type Vec,
} from '../types.ts';

const CURRENT_DIRECTIONS: ReadonlyMap<Cell, Vec> = new Map([
  ['current-right', { x: 1, y: 0 }],
  ['current-left', { x: -1, y: 0 }],
  ['current-up', { x: 0, y: -1 }],
  ['current-down', { x: 0, y: 1 }],
]);

/** The cell at a tile; anything outside the grid is rock. */
export function cellAt(level: Level, tx: number, ty: number): Cell {
  return level.cells[ty]?.[tx] ?? 'rock';
}

/** Index of a tile in row-major order, used as the key in `World.broken` and flow fields. */
export function tileIndex(level: Level, tx: number, ty: number): number {
  return ty * level.width + tx;
}

/** True for rock (including outside the grid) and for coral that hasn't been broken. */
export function isSolid(level: Level, broken: ReadonlySet<number>, tx: number, ty: number): boolean {
  const cell = cellAt(level, tx, ty);
  if (cell === 'rock') return true;
  return cell === 'coral' && !broken.has(tileIndex(level, tx, ty));
}

/**
 * True for a tile that stops a moving body from every side under `rules`: solid in the level
 * (`isSolid`) or one of the rules' extra solid tiles. With `rules.pitBelow`, everything below the
 * last row is open, so a body can fall out of the level. Ledges never count; see `isLedge`.
 */
export function blocksBody(
  level: Level,
  broken: ReadonlySet<number>,
  rules: MoveRules,
  tx: number,
  ty: number,
): boolean {
  if (rules.pitBelow && ty >= level.height) return false;
  return isSolid(level, broken, tx, ty) || rules.solidTiles.has(tileIndex(level, tx, ty));
}

/** True for a ledge (`=`): a one-way platform that holds only a body coming down onto it from above. */
export function isLedge(level: Level, tx: number, ty: number): boolean {
  return cellAt(level, tx, ty) === 'ledge';
}

/**
 * Inclusive tile range a body overlaps.
 * A tile the body only touches along an edge is not included.
 */
export function bodyTiles(body: Box): { left: number; right: number; top: number; bottom: number } {
  return {
    left: Math.floor(body.x / TILE),
    right: Math.ceil((body.x + body.w) / TILE) - 1,
    top: Math.floor(body.y / TILE),
    bottom: Math.ceil((body.y + body.h) / TILE) - 1,
  };
}

/** True when a body overlaps a tile by any positive area. */
export function overlapsTile(body: Box, tx: number, ty: number): boolean {
  return (
    body.x < (tx + 1) * TILE && body.x + body.w > tx * TILE && body.y < (ty + 1) * TILE && body.y + body.h > ty * TILE
  );
}

/** True when the point (x, y) in world px lies in an air tile above a surface. */
export function isAirAt(level: Level, x: number, y: number): boolean {
  return cellAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === 'air';
}

/** True when the box overlaps any air tile by positive area (edge-only contact doesn't count). */
export function boxTouchesAir(level: Level, box: Box): boolean {
  const { left, right, top, bottom } = bodyTiles(box);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (cellAt(level, tx, ty) === 'air') return true;
    }
  }
  return false;
}

/** The current and kelp at the tile under the body's centre. */
export function sampleEnvironment(level: Level, body: Body): Environment {
  const cell = cellAt(level, Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h / 2) / TILE));
  const current = CURRENT_DIRECTIONS.get(cell);
  return { current: current ? { ...current } : null, inKelp: cell === 'kelp', inAir: cell === 'air' };
}

/**
 * True when the box's centre lies in one of the level's dark zones: a tile column inside any
 * inclusive `level.dark` range.
 */
export function inDark(level: Level, box: Box): boolean {
  const column = Math.floor((box.x + box.w / 2) / TILE);
  return level.dark.some(([from, to]) => column >= from && column <= to);
}
