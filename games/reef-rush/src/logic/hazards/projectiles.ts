/**
 * Bubbles and ink clouds after they're fired: moving, steering, colliding with
 * the course and running out. Ink slows racers here; bubbles trap racers in
 * `contacts.ts`.
 *
 * A seeking bubble's "racer ahead" is judged against its owner's progress at the
 * time, so it keeps hunting whoever leads its owner, and turns toward the nearest
 * of them measured from the bubble. An ink cloud first ages, then slows, so a
 * cloud on its last tick slows nobody.
 */
import { isSolid } from '../level/query.ts';
import { BUBBLE, INK } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import { type Bubble, type Racer, TILE, type World } from '../types.ts';

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
  world.bubbles = world.bubbles.filter((bubble) => {
    if (bubble.seeking) seek(world, bubble, racers);
    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;
    bubble.ttl -= 1;
    const inRock = isSolid(world.level, world.broken, Math.floor(bubble.x / TILE), Math.floor(bubble.y / TILE));
    if (!inRock && bubble.ttl > 0) return true;
    world.events.emit({ type: 'bubble.popped', by: null });
    return false;
  });

  world.inks = world.inks.filter((ink) => {
    ink.ttl -= 1;
    return ink.ttl > 0;
  });
  for (const ink of world.inks) {
    for (const racer of racers) {
      if (racer.id === ink.owner) continue;
      const centre = centreOf(racer);
      if (Math.hypot(centre.x - ink.x, centre.y - ink.y) <= ink.radius) racer.status.slowed = INK.slowTicks;
    }
  }
}

/** Turns a seeking bubble's velocity toward its target by at most BUBBLE.seekTurnPerTick, keeping its speed. */
function seek(world: World, bubble: Bubble, racers: readonly Racer[]): void {
  const target = seekTarget(world, bubble, racers);
  if (!target) return;
  const centre = centreOf(target);
  const heading = Math.atan2(bubble.vy, bubble.vx);
  const wanted = Math.atan2(centre.y - bubble.y, centre.x - bubble.x);
  // Wrapped to (-π, π] so the bubble turns the short way round.
  const difference = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
  const turn = Math.max(-BUBBLE.seekTurnPerTick, Math.min(BUBBLE.seekTurnPerTick, difference));
  const speed = Math.hypot(bubble.vx, bubble.vy);
  bubble.vx = Math.cos(heading + turn) * speed;
  bubble.vy = Math.sin(heading + turn) * speed;
}

/** The nearest racer to the bubble that is ahead of its owner and within seek range; null when none. */
function seekTarget(world: World, bubble: Bubble, racers: readonly Racer[]): Racer | null {
  const owner = world.racers.find((racer) => racer.id === bubble.owner);
  if (!owner) return null;
  let best: Racer | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const racer of racers) {
    if (racer.id === bubble.owner || !(racer.progress < owner.progress)) continue;
    const centre = centreOf(racer);
    const distance = Math.hypot(centre.x - bubble.x, centre.y - bubble.y);
    // Strictly nearer only, so equal distances go to the earlier racer in RACER_IDS order.
    if (distance > BUBBLE.seekRangeTiles * TILE || distance >= bestDistance) continue;
    best = racer;
    bestDistance = distance;
  }
  return best;
}
