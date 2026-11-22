/**
 * Everything that hurts on touch, resolved against the racers in play: urchin
 * tiles, jellies, bubbles, inflated puffers, and Glow Lantern flashes. Every hit
 * goes through `applyHit`. Lane 3/b implements it; the scaffold ships the signatures.
 */
import type { Racer, World } from '../types.ts';

/**
 * The contacts slot of `stepWorld`, for each racer in `racers` order:
 * - an urchin tile its hitbox overlaps hits it (cause 'urchin', from the tile centre) unless inflated;
 * - a jelly that isn't stunned whose JELLY.size box overlaps its hitbox hits it (cause 'jelly');
 * - a bubble owned by another racer whose BUBBLE.size box overlaps its hitbox, unless it's
 *   invulnerable, pops (`bubble.popped {by: id}`, removed) and hits it (cause 'bubble', by the owner);
 * - an inflated other racer whose hitbox overlaps its hitbox hits it (cause 'puffer', by that racer).
 *
 * Stub: does nothing until lane 3/b lands, so races on the current course keep running.
 */
export function resolveContacts(world: World, racers: readonly Racer[]): void {
  void world;
  void racers;
}

/**
 * A Glow Lantern flash from `racer`: emits `flash.fired {id}`, then hits every other racer in play
 * whose centre is within FLASH.rangeTiles tiles of the racer's centre (cause 'flash'), and sets
 * `stunned = FLASH.stunTicks` on every jelly whose centre is that close. Called by `burst.ts`.
 */
export function flashAround(world: World, racer: Racer): void {
  void world;
  void racer;
  throw new Error('not implemented');
}
