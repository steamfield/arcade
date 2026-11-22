/**
 * Bursts: firing every held power-up's burst together and running the effects
 * that last beyond the firing tick (dashes, inflation, ink trails, comet flashes).
 * Lane 3/a implements it; the scaffold ships the signatures.
 *
 * Per-kind effects of `fireBurst` (tuning in `powerups/tuning.ts`):
 * - jetFin: `status.dashing = DASH.ticks`, `dashDir` = unit input (facing when none), velocity set to
 *   DASH.speed along it on the firing tick and held there by `driveDash` while dashing.
 * - bubbleShield: pushes a Bubble at the racer's centre moving BUBBLE.speed along the same aim, ttl
 *   BUBBLE.ttlTicks, `seeking` when the seekerBubble combo is held; emits `bubble.spawned`.
 * - puffer: `status.inflated = INFLATE.ticks`.
 * - inkSac: pushes an InkCloud of INK.radius INK.behind px behind the racer's centre (opposite its
 *   facing), ttl INK.ttlTicks; emits `ink.spawned`.
 * - glowLantern: `flashAround(world, racer)` (hazards/contacts.ts).
 * Combo changes (`combosIn`): cannonball keeps the racer inflated for the whole dash; inkTrail drops
 * a cloud every INK.trailEveryTicks of the dash, from the firing tick, instead of one; inkBomb makes
 * the cloud INK.bombRadius and centred on the racer; comet flashes on the firing tick and again on
 * the dash's last tick (DASH.ticks - 1 ticks later). All matching combos apply.
 */
import type { Intent, Racer, Vec, World } from '../types.ts';

/**
 * The bursts slot of `stepWorld`: fires `fireBurst` for each racer whose intent presses burst.
 * `intents[i]` belongs to `racers[i]` (the active racers, with stunned and trapped intents already idle).
 */
export function fireBursts(world: World, racers: readonly Racer[], intents: readonly Intent[]): void {
  void world;
  // A burst needs a held power-up, so a race where nobody holds one has nothing to fire.
  const pressed = racers.some((racer, i) => intents[i]?.burst && racer.stack.length > 0);
  if (pressed) throw new Error('not implemented');
}

/**
 * Fires every held power-up's burst at once when the stack is non-empty and `burstCooldown` is 0:
 * sets `burstCooldown` to BURST_COOLDOWN_TICKS and emits `burst.fired` with the held kinds in stack
 * order and `comboFor(stack)`, then applies each kind's effect (see the module doc). The stack is
 * kept: bursting doesn't use power-ups up.
 *
 * @param move The racer's input this tick; aims the dash and bubble (facing when zero).
 * @returns true when it fired; false, changing nothing, otherwise.
 */
export function fireBurst(world: World, racer: Racer, move: Vec): boolean {
  void world;
  void racer;
  void move;
  throw new Error('not implemented');
}

/**
 * Holds a dashing racer's velocity at DASH.speed along `dashDir`, overriding swimming and drag.
 * Called in `stepWorld` after swimming and before the body moves; does nothing when not dashing.
 */
export function driveDash(racer: Racer): void {
  if (racer.status.dashing > 0) throw new Error('not implemented');
}

/**
 * The per-tick side of bursts, run right after `fireBursts`: inflated racers break coral their
 * hitbox touches (via `breakCoral`), inkTrail dashes drop their clouds, and comet dashes flash on
 * their last tick.
 */
export function sustainBursts(world: World, racers: readonly Racer[]): void {
  void world;
  if (racers.some((racer) => racer.status.inflated > 0 || racer.status.dashing > 0)) {
    throw new Error('not implemented');
  }
}
