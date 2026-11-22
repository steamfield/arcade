/**
 * The stack rules: gaining a power-up, losing the oldest when a fourth arrives,
 * and choosing what a hit knocks off. The stack is oldest first, so the newest
 * power-up is always the last entry.
 */
import { stackMaxFor } from '../abilities.ts';
import type { PowerUpKind, Racer, World } from '../types.ts';
import { COMBO_PAIRS } from './tuning.ts';

/**
 * Puts `kind` on top of the racer's stack and emits `powerup.gained`. When the stack already holds
 * `stackMaxFor(racer)`, the oldest (bottom) is dropped first with `powerup.lost {cause: 'full'}`.
 *
 * @returns false, changing nothing and emitting nothing, when the racer already holds `kind`.
 */
export function gainPowerUp(world: World, racer: Racer, kind: PowerUpKind): boolean {
  if (racer.stack.includes(kind)) return false;
  if (racer.stack.length >= stackMaxFor(racer)) {
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
 * loose pickup and handles stuns; this only changes the stack, plus `dashCombos`: a running dash's
 * combo whose pair just lost a member stops.
 *
 * @returns The kind removed ('bubbleShield' when a shield absorbed the hit), or null for an empty stack.
 */
export function popForHit(world: World, racer: Racer): PowerUpKind | null {
  const shieldAt = racer.stack.indexOf('bubbleShield');
  if (shieldAt >= 0) {
    racer.stack.splice(shieldAt, 1);
    dropBrokenDashCombos(racer, 'bubbleShield');
    world.events.emit({ type: 'shield.popped', id: racer.id });
    return 'bubbleShield';
  }
  const newest = racer.stack.pop();
  if (!newest) return null;
  dropBrokenDashCombos(racer, newest);
  world.events.emit({ type: 'powerup.lost', id: racer.id, kind: newest, cause: 'hit' });
  return newest;
}

/** Removes from the racer's running dash every combo whose pair includes the `lost` kind. */
function dropBrokenDashCombos(racer: Racer, lost: PowerUpKind): void {
  const broken = new Set(COMBO_PAIRS.filter(({ kinds }) => kinds.includes(lost)).map(({ name }) => name));
  racer.dashCombos = racer.dashCombos.filter((combo) => !broken.has(combo));
}
