/**
 * Breaking coral, the only way `World.broken` grows. A broken tile opens to
 * swimmers, so the steer and smash fields are rebuilt on the spot; the progress
 * field already treats coral as passable and never changes.
 */
import { bodyTiles, cellAt, tileIndex } from '../level/query.ts';
import type { Racer, RacerId, World } from '../types.ts';
import { rebuildForBrokenCoral } from './flowfield.ts';

/**
 * Breaks the coral at tile (tx, ty) on behalf of racer `by` and emits `coral.broken`.
 *
 * @returns true when the coral broke; false, changing nothing, unless the tile is unbroken coral.
 */
export function breakCoral(world: World, tx: number, ty: number, by: RacerId): boolean {
  if (cellAt(world.level, tx, ty) !== 'coral') return false;
  const index = tileIndex(world.level, tx, ty);
  if (world.broken.has(index)) return false;
  // A new set rather than a mutation, so the set stays read-only to everyone else.
  world.broken = new Set(world.broken).add(index);
  world.fields = rebuildForBrokenCoral(world.fields, world.level, world.broken);
  world.events.emit({ type: 'coral.broken', tx, ty, by });
  return true;
}

/**
 * Breaks every coral tile `racer`'s body would overlap after moving by its velocity for `dt`
 * seconds, so a racer that rams coral swims on through it. `stepWorld` calls it before moving a
 * racer whose ability breaks coral on contact (`breaksCoralOnContact`).
 */
export function ramCoral(world: World, racer: Racer, dt: number): void {
  const { body } = racer;
  const tiles = bodyTiles({ x: body.x + body.vx * dt, y: body.y + body.vy * dt, w: body.w, h: body.h });
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) breakCoral(world, tx, ty, racer.id);
  }
}
