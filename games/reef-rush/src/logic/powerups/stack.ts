/**
 * The stack rules: gaining a power-up, losing the oldest when a fourth arrives,
 * and choosing what a hit knocks off. The stack is oldest first, so the newest
 * power-up is always the last entry.
 */
import type { PowerUpKind, Racer, World } from '../types.ts';
import { STACK_MAX } from './tuning.ts';

/**
 * Puts `kind` on top of the racer's stack and emits `powerup.gained`. When that makes
 * STACK_MAX + 1, the oldest (bottom) is dropped first with `powerup.lost {cause: 'full'}`.
 *
 * @returns false, changing nothing and emitting nothing, when the racer already holds `kind`.
 */
export function gainPowerUp(world: World, racer: Racer, kind: PowerUpKind): boolean {
  if (racer.stack.includes(kind)) return false;
  if (racer.stack.length >= STACK_MAX) {
    const oldest = racer.stack.shift();
    if (oldest) world.events.emit({ type: 'powerup.lost', id: racer.id, kind: oldest, cause: 'full' });
  }
  racer.stack.push(kind);
  world.events.emit({ type: 'powerup.gained', id: racer.id, kind });
  return true;
}

/**
 * Removes what a hit takes: Bubble Shield wherever it sits (emitting `shield.popped`), else the
 * newest power-up (emitting `powerup.lost {cause: 'hit'}`). Called by `applyHit`, which spawns the
 * loose pickup and handles stuns; this only changes the stack.
 *
 * @returns The kind removed ('bubbleShield' when a shield absorbed the hit), or null for an empty stack.
 */
export function popForHit(world: World, racer: Racer): PowerUpKind | null {
  const shieldAt = racer.stack.indexOf('bubbleShield');
  if (shieldAt >= 0) {
    racer.stack.splice(shieldAt, 1);
    world.events.emit({ type: 'shield.popped', id: racer.id });
    return 'bubbleShield';
  }
  const newest = racer.stack.pop();
  if (!newest) return null;
  world.events.emit({ type: 'powerup.lost', id: racer.id, kind: newest, cause: 'hit' });
  return newest;
}
