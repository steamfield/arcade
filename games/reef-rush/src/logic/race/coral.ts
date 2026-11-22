/**
 * Breaking coral, the only way `World.broken` grows. A broken tile opens to
 * swimmers, so the steer and smash fields are rebuilt on the spot; the progress
 * field already treats coral as passable and never changes.
 */
import { cellAt, tileIndex } from '../level/query.ts';
import type { RacerId, World } from '../types.ts';
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
