/**
 * Bubbles and ink clouds after they're fired: moving, steering, colliding with
 * the course and running out. Ink slows racers here; bubbles trap racers in
 * `contacts.ts`. Lane 3/b implements it; the scaffold ships the signature.
 */
import type { Racer, World } from '../types.ts';

/**
 * The projectiles slot of `stepWorld`. Each call:
 * - bubbles move by their velocity * dt; a seeking bubble first turns at most BUBBLE.seekTurnPerTick
 *   toward the nearest other racer ahead of its owner (lower progress) within BUBBLE.seekRangeTiles;
 *   a bubble whose centre enters a solid tile pops (`bubble.popped {by: null}`); each loses one ttl
 *   tick and is removed at 0 (also `bubble.popped {by: null}`);
 * - inks lose one ttl tick (removed at 0); every racer but the owner whose centre is inside a cloud
 *   gets `status.slowed = INK.slowTicks`.
 *
 * @param racers The active racers. Owners never hit themselves.
 * @param dt Tick length in seconds.
 */
export function advanceProjectiles(world: World, racers: readonly Racer[], dt: number): void {
  void racers;
  void dt;
  if (world.bubbles.length > 0 || world.inks.length > 0) throw new Error('not implemented');
}
