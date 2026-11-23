/**
 * Bubbles and ink clouds after they're fired: moving, colliding with the course and running out.
 * Ink slows racers here; bubbles trap racers in `contacts.ts`.
 *
 * An ink cloud first ages, then slows, so a cloud on its last tick slows nobody.
 */
import { mayAttack } from '../difficulty-level.ts';
import { isSolid } from '../level/query.ts';
import { INK } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import { type Racer, TILE, type World } from '../types.ts';

/**
 * The projectiles slot of `stepWorld`. Each call:
 * - bubbles move by their velocity * dt; a bubble whose centre enters a solid tile pops (`bubble.popped {by: null}`); each loses one
 *   ttl tick and is removed at 0 (also `bubble.popped {by: null}`);
 * - inks lose one ttl tick (removed at 0); every racer but the owner whose centre is inside a cloud
 *   gets `status.slowed = INK.slowTicks`.
 *
 * @param racers The active racers. Owners never hit themselves.
 * @param dt Tick length in seconds.
 */
export function advanceProjectiles(world: World, racers: readonly Racer[], dt: number): void {
  world.bubbles = world.bubbles.filter((bubble) => {
    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;
    bubble.ttl -= 1;
    // Solid means rock or unbroken coral.
    const inSolid = isSolid(world.level, world.broken, Math.floor(bubble.x / TILE), Math.floor(bubble.y / TILE));
    if (!inSolid && bubble.ttl > 0) return true;
    world.events.emit({ type: 'bubble.popped', by: null });
    return false;
  });

  world.inks = world.inks.filter((ink) => {
    ink.ttl -= 1;
    return ink.ttl > 0;
  });
  for (const ink of world.inks) {
    for (const racer of racers) {
      if (racer.id === ink.owner || !mayAttack(world, ink.owner, racer.id)) continue;
      const centre = centreOf(racer);
      const dx = centre.x - ink.x;
      const dy = centre.y - ink.y;
      if (dx * dx + dy * dy <= ink.radius * ink.radius) racer.status.slowed = INK.slowTicks;
    }
  }
}
