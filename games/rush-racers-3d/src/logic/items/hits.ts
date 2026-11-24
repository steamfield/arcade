/** Hit outcomes, invulnerability, and the movement limits shared by stun and sap. */
import { ITEMS, RUN } from '../tuning.ts';
import type { ItemKind, Racer, RacerId, World } from '../types.ts';
import { removeItem } from './inventory.ts';

/** Whether stun or sap currently blocks the racer's movement controls and firing. */
export function isImmobilized(racer: Racer): boolean {
  return racer.stunTicks > 0 || racer.trappedTicks > 0;
}

/** Stops horizontal motion and cancels the dash and buffered jump. Gravity still acts. */
export function stopRacer(racer: Racer): void {
  racer.vs = 0;
  racer.vd = 0;
  racer.dashTicks = 0;
  racer.bufferTicks = 0;
}

/** Whether a racing racer can take a hit or be trapped. */
export function canBeHit(racer: Racer): boolean {
  return racer.state === 'racing' && racer.invulnTicks === 0;
}

/**
 * Consumes a held Sap Shield first, drops the selected item if unshielded, or stuns an
 * empty-handed racer. Every accepted hit grants `RUN.invulnTicks` of invulnerability.
 */
export function hitRacer(world: World, racer: Racer, by: RacerId, kind: ItemKind): void {
  if (!canBeHit(racer)) return;

  const shield = racer.slots.findIndex((item) => item?.kind === 'shield');
  racer.invulnTicks = RUN.invulnTicks;
  if (shield >= 0) {
    removeItem(world, racer, shield);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'shielded' });
  } else if (racer.slots[racer.selected]) {
    removeItem(world, racer, racer.selected);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'dropped' });
  } else {
    racer.stunTicks = ITEMS.stunTicks;
    stopRacer(racer);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'stunned' });
  }
}
