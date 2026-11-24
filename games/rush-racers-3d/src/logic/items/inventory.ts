/** Inventory slots, selection, and item grants and losses. */
import { ITEMS } from '../tuning.ts';
import type { ItemKind, Racer, World } from '../types.ts';

type Direction = -1 | 1;

/** The first held slot in this direction, or the current selection if there is no other item. */
export function heldSlot(racer: Racer, direction: Direction): number {
  for (let offset = 1; offset < ITEMS.slots; offset++) {
    const slot = (racer.selected + direction * offset + ITEMS.slots) % ITEMS.slots;
    if (racer.slots[slot]) return slot;
  }
  return racer.selected;
}

/** Selects a slot and emits `item.selected` when the selection changes. */
export function selectSlot(world: World, racer: Racer, slot: number): void {
  if (slot === racer.selected) return;
  racer.selected = slot;
  world.events.emit({ type: 'item.selected', id: racer.id, slot });
}

/** Fills an empty slot with a fully charged item and selects it if no item is selected. */
export function giveItem(world: World, racer: Racer, slot: number, kind: ItemKind): void {
  racer.slots[slot] = { kind, charges: ITEMS.charges[kind] };
  if (!racer.slots[racer.selected]) selectSlot(world, racer, slot);
}

/** Empties the slot and, if selected, moves the selection to the next held item. */
export function removeItem(world: World, racer: Racer, slot: number): void {
  racer.slots[slot] = null;
  if (slot === racer.selected) selectSlot(world, racer, heldSlot(racer, 1));
}
