/** Inventory slots, selection, and item grants and losses. */
import { ITEMS } from '../tuning.ts';
import type { Racer, World } from '../types.ts';
import type { ItemKind } from './types.ts';

type Direction = -1 | 1;

/** The first held slot in this direction, or the current selection if there is no other item. */
export function heldSlot(racer: Racer, direction: Direction): number {
  const { slots, selected } = racer.items;
  for (let offset = 1; offset < ITEMS.slots; offset++) {
    const slot = (selected + direction * offset + ITEMS.slots) % ITEMS.slots;
    if (slots[slot]) return slot;
  }
  return selected;
}

/** Selects a slot and emits `item.selected` when the selection changes. */
export function selectSlot(world: World, racer: Racer, slot: number): void {
  if (slot === racer.items.selected) return;
  racer.items.selected = slot;
  world.events.emit({ type: 'item.selected', id: racer.id, slot });
}

/** Fills an empty slot with a fully charged item and selects it if no item is selected. */
export function giveItem(world: World, racer: Racer, slot: number, kind: ItemKind): void {
  racer.items.slots[slot] = { kind, charges: ITEMS.charges[kind] };
  if (!racer.items.slots[racer.items.selected]) selectSlot(world, racer, slot);
}

/** Empties the slot and, if selected, moves the selection to the next held item. */
export function removeItem(world: World, racer: Racer, slot: number): void {
  racer.items.slots[slot] = null;
  if (slot === racer.items.selected) selectSlot(world, racer, heldSlot(racer, 1));
}
