/**
 * A racer's inventory: fixed item slots (`Racer.items`, `stackMaxFor(racer)` long), the selected
 * slot, and the rules for gaining, selecting, spending and losing items. It never fires anything;
 * `use.ts` does. Other modules read and change the inventory only through these functions.
 *
 * Invariant: while anything is held, `racer.selected` points at a held slot. Emptying the selected
 * slot moves the selection to the next held slot to the right, wrapping, and leaves it put when
 * nothing is held.
 */
import type { HeldItem, PowerUpKind, Racer, World } from '../types.ts';

/** The item in the selected slot, or null when nothing is held. */
export function selectedItem(racer: Racer): HeldItem | null {
  return racer.items[racer.selected] ?? null;
}

/** Every held item, in slot order. */
export function heldItems(racer: Racer): HeldItem[] {
  return racer.items.filter((item): item is HeldItem => item !== null);
}

/** True when any slot holds `kind`. */
export function holds(racer: Racer, kind: PowerUpKind): boolean {
  return racer.items.some((item) => item?.kind === kind);
}

/** True when every slot holds an item, so the racer can't take another. */
export function inventoryFull(racer: Racer): boolean {
  return racer.items.every((item) => item !== null);
}

/**
 * Puts `kind` with `charges` uses in the first empty slot and emits `powerup.gained {id, kind, slot,
 * charges}`. Gaining into an empty inventory selects that slot.
 *
 * @returns false, changing nothing and emitting nothing, when the racer already holds `kind` or has
 *   no empty slot.
 */
export function gainItem(world: World, racer: Racer, kind: PowerUpKind, charges: number): boolean {
  if (holds(racer, kind)) return false;
  const slot = racer.items.indexOf(null);
  if (slot < 0) return false;
  const wasEmpty = heldItems(racer).length === 0;
  racer.items[slot] = { kind, charges };
  if (wasEmpty) racer.selected = slot;
  world.events.emit({ type: 'powerup.gained', id: racer.id, kind, slot, charges });
  return true;
}

/**
 * Moves the selection `step` held slots along (1 next, -1 previous), skipping empty slots and
 * wrapping, and emits `item.selected {id, slot, kind}`. Does nothing with fewer than two items held.
 */
export function cycleSelection(world: World, racer: Racer, step: -1 | 1): void {
  if (heldItems(racer).length < 2) return;
  const slot = nextHeldSlot(racer, racer.selected, step);
  const item = racer.items[slot];
  if (!item) return;
  racer.selected = slot;
  world.events.emit({ type: 'item.selected', id: racer.id, slot, kind: item.kind });
}

/**
 * Selects `slot` and emits `item.selected` when that changes the selection. Does nothing for an
 * empty or out-of-range slot.
 */
export function selectSlot(world: World, racer: Racer, slot: number): void {
  const item = racer.items[slot];
  if (!item || slot === racer.selected) return;
  racer.selected = slot;
  world.events.emit({ type: 'item.selected', id: racer.id, slot, kind: item.kind });
}

/**
 * Takes one charge off the item in `slot`. The last charge empties the slot, emits `powerup.lost
 * {cause: 'used'}` and moves the selection on as the module doc says. Does nothing for an empty slot.
 */
export function spendCharge(world: World, racer: Racer, slot: number): void {
  const item = racer.items[slot];
  if (!item) return;
  item.charges -= 1;
  if (item.charges > 0) return;
  emptySlot(racer, slot);
  world.events.emit({ type: 'powerup.lost', id: racer.id, kind: item.kind, cause: 'used' });
}

/**
 * Removes what a hit takes. A Bubble Shield in any slot absorbs it: that slot empties and
 * `shield.popped` is emitted. Otherwise the selected item and all its charges come off, emitting
 * `powerup.lost {cause: 'hit'}`. Either way the selection moves on as for a used-up item. `applyHit`
 * floats a knocked item loose and stuns a racer who held nothing.
 *
 * @returns The item removed (a Bubble Shield when one absorbed the hit), or null when nothing is held.
 */
export function knockForHit(world: World, racer: Racer): HeldItem | null {
  const shieldSlot = racer.items.findIndex((item) => item?.kind === 'bubbleShield');
  if (shieldSlot >= 0) {
    const shield = emptySlot(racer, shieldSlot);
    world.events.emit({ type: 'shield.popped', id: racer.id });
    return shield;
  }
  const knocked = emptySlot(racer, racer.selected);
  if (knocked) world.events.emit({ type: 'powerup.lost', id: racer.id, kind: knocked.kind, cause: 'hit' });
  return knocked;
}

/** Empties `slot`, moving the selection on when it was the selected slot. Returns what it held. */
function emptySlot(racer: Racer, slot: number): HeldItem | null {
  const item = racer.items[slot] ?? null;
  racer.items[slot] = null;
  if (slot === racer.selected && heldItems(racer).length > 0) racer.selected = nextHeldSlot(racer, slot, 1);
  return item;
}

/**
 * The first held slot `step` away from `from` (wrapping), or `from` itself when no other slot holds
 * anything.
 */
function nextHeldSlot(racer: Racer, from: number, step: -1 | 1): number {
  const count = racer.items.length;
  for (let offset = 1; offset < count; offset++) {
    const slot = (((from + step * offset) % count) + count) % count;
    if (racer.items[slot]) return slot;
  }
  return from;
}
