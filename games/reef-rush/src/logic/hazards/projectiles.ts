/**
 * Bubbles and ink clouds after they're fired: moving, steering, colliding with
 * the course and running out. Ink slows racers here; bubbles trap racers in
 * `contacts.ts`.
 *
 * A seeking bubble's "racer ahead" is judged against its owner's progress at the
 * time, so it keeps hunting whoever leads its owner, and turns toward the nearest
 * of them measured from the bubble. Turning is vector math only (no trig at run
 * time, see num.ts): the velocity rotates by the fixed per-tick angle toward the
 * side the target is on, or snaps onto the target once it is within that angle.
 * An ink cloud first ages, then slows, so a cloud on its last tick slows nobody.
 */
import { isSolid } from '../level/query.ts';
import { cos, length, sin } from '../num.ts';
import { BUBBLE, INK } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import { type Bubble, type Racer, TILE, type World } from '../types.ts';

/** Cosine and sine of the largest per-tick turn, computed once with engine-exact math. */
const TURN_COS = cos(BUBBLE.seekTurnPerTick);
const TURN_SIN = sin(BUBBLE.seekTurnPerTick);

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
      if (racer.id === ink.owner) continue;
      const centre = centreOf(racer);
      const dx = centre.x - ink.x;
      const dy = centre.y - ink.y;
      if (dx * dx + dy * dy <= ink.radius * ink.radius) racer.status.slowed = INK.slowTicks;
    }
  }
}

/**
 * Turns a seeking bubble's velocity toward its target by at most BUBBLE.seekTurnPerTick, keeping
 * its speed: straight onto the target when it is already within that angle, else rotated by it
 * toward the target's side (anticlockwise when the target is dead behind).
 */
function seek(world: World, bubble: Bubble, racers: readonly Racer[]): void {
  const target = seekTarget(world, bubble, racers);
  const speed = length(bubble.vx, bubble.vy);
  if (!target || speed === 0) return;
  const centre = centreOf(target);
  const toX = centre.x - bubble.x;
  const toY = centre.y - bubble.y;
  const distance = length(toX, toY);
  if (distance === 0) return;
  const headX = bubble.vx / speed;
  const headY = bubble.vy / speed;
  const wantX = toX / distance;
  const wantY = toY / distance;
  if (headX * wantX + headY * wantY >= TURN_COS) {
    bubble.vx = wantX * speed;
    bubble.vy = wantY * speed;
    return;
  }
  const side = headX * wantY - headY * wantX >= 0 ? 1 : -1;
  bubble.vx = (headX * TURN_COS - headY * TURN_SIN * side) * speed;
  bubble.vy = (headX * TURN_SIN * side + headY * TURN_COS) * speed;
}

/** The nearest racer to the bubble that is ahead of its owner and within seek range; null when none. */
function seekTarget(world: World, bubble: Bubble, racers: readonly Racer[]): Racer | null {
  const owner = world.racers.find((racer) => racer.id === bubble.owner);
  if (!owner) return null;
  const range = BUBBLE.seekRangeTiles * TILE;
  let best: Racer | null = null;
  let bestSquared = Number.POSITIVE_INFINITY;
  for (const racer of racers) {
    if (racer.id === bubble.owner || !(racer.progress < owner.progress)) continue;
    const centre = centreOf(racer);
    const dx = centre.x - bubble.x;
    const dy = centre.y - bubble.y;
    const squared = dx * dx + dy * dy;
    // Strictly nearer only, so equal distances go to the earlier racer in RACER_IDS order.
    if (squared > range * range || squared >= bestSquared) continue;
    best = racer;
    bestSquared = squared;
  }
  return best;
}
