/**
 * The stack rules: gaining a power-up, losing the oldest when a fourth arrives,
 * and choosing what a hit knocks off. Lane 3/a implements it; the scaffold ships
 * the signatures.
 */
import type { PowerUpKind, Racer, World } from '../types.ts';

/**
 * Puts `kind` on top of the racer's stack and emits `powerup.gained`. When that makes
 * STACK_MAX + 1, the oldest (bottom) is dropped first with `powerup.lost {cause: 'full'}`.
 *
 * @returns false, changing nothing and emitting nothing, when the racer already holds `kind`.
 */
export function gainPowerUp(world: World, racer: Racer, kind: PowerUpKind): boolean {
  void world;
  void racer;
  void kind;
  throw new Error('not implemented');
}

/**
 * Removes what a hit takes: Bubble Shield wherever it sits (emitting `shield.popped`), else the
 * newest power-up (emitting `powerup.lost {cause: 'hit'}`). Called by `applyHit`, which spawns the
 * loose pickup and handles stuns; this only changes the stack.
 *
 * @returns The kind removed ('bubbleShield' when a shield absorbed the hit), or null for an empty stack.
 */
export function popForHit(world: World, racer: Racer): PowerUpKind | null {
  void world;
  void racer;
  throw new Error('not implemented');
}
