import { ITEMS, RUN } from '../tuning.ts';
import type { ItemKind, Racer, RacerId, World } from '../types.ts';
import { removeItem } from './inventory.ts';

export function isImmobilized(racer: Racer): boolean {
  return racer.stunTicks > 0 || racer.trappedTicks > 0;
}

export function stopRacer(racer: Racer): void {
  racer.vs = 0;
  racer.vd = 0;
  racer.vy = 0;
  racer.dashTicks = 0;
  racer.bufferTicks = 0;
  racer.coyoteTicks = 0;
}

export function canBeHit(racer: Racer): boolean {
  return racer.state === 'racing' && racer.invulnTicks === 0;
}

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
