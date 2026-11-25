/** Hit outcomes and the invulnerability they grant. */
import { stopRacer } from '../racer.ts';
import { canBeHit } from '../status.ts';
import { ITEMS, RUN } from '../tuning.ts';
import type { Racer, RacerId, World } from '../types.ts';
import { removeItem } from './inventory.ts';
import type { ItemKind } from './types.ts';

/**
 * Consumes a held Sap Shield first, drops the selected item if unshielded, or stuns an
 * empty-handed racer. Every accepted hit grants `RUN.invulnTicks` of invulnerability.
 */
export function hitRacer(world: World, racer: Racer, by: RacerId, kind: ItemKind): void {
  if (!canBeHit(racer)) return;

  const { slots, selected } = racer.items;
  const shield = slots.findIndex((item) => item?.kind === 'shield');
  racer.invulnTicks = RUN.invulnTicks;
  if (shield >= 0) {
    removeItem(world, racer, shield);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'shielded' });
  } else if (slots[selected]) {
    removeItem(world, racer, selected);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'dropped' });
  } else {
    racer.items.stunTicks = ITEMS.stunTicks;
    stopRacer(racer);
    world.events.emit({ type: 'racer.hit', id: racer.id, by, kind, outcome: 'stunned' });
  }
}
