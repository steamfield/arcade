/**
 * The wall bounce: a tile that
 * stopped a drifter sends it back the way it came with part of its speed, and a hard enough impact emits
 * `racer.rebounded`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import type { MoveContacts, Racer, World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import { driftExtras } from './tuning.ts';

/**
 * Bounces a drifter off the tiles that stopped it. Sets each component a tile stopped to `-lost * bounce`, keeping the other,
 * and emits `racer.rebounded` with the impact speed and the axis of its larger component when that
 * speed is at least `bounceMinSpeed`. A racer an item dash drives is left as `moveBody` stopped it,
 * since the dash rewrites its velocity every tick and would bounce it on each of them.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
export function bounceDrifter(world: World, racer: Racer, contacts: MoveContacts, events: EventSink<GameEvent>): void {
  const { lost } = contacts;
  if (lost.x === 0 && lost.y === 0) return;
  if (racer.status.dashing > 0) return;
  const { bounce, bounceMinSpeed } = driftExtras(effectiveTuning(world));
  if (lost.x !== 0) racer.body.vx = -lost.x * bounce;
  if (lost.y !== 0) racer.body.vy = -lost.y * bounce;
  const speed = length(lost.x, lost.y);
  if (speed < bounceMinSpeed) return;
  const axis = Math.abs(lost.x) >= Math.abs(lost.y) ? 'x' : 'y';
  events.emit({ type: 'racer.rebounded', id: racer.id, speed, axis });
}
