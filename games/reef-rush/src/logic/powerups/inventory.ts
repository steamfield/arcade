/**
 * A racer's inventory: fixed item slots (`Racer.items`, `stackMaxFor(racer)` long), the selected
 * slot, and the rules for gaining, selecting, spending and losing items. It never fires anything;
 * `use.ts` does. Other modules read and change the inventory only through these functions.
 *
 * Invariant: while anything is held, `racer.selected` points at a held slot. Emptying the selected
 * slot moves the selection to the next held slot to the right, wrapping, and leaves it put when
 * nothing is held.
 */
import { stackMaxFor } from '../abilities.ts';
import type { HeldItem, PowerUpKind, Racer, World } from '../types.ts';

/** The item in the selected slot, or null when nothing is held. */
export function selectedItem(racer: Racer): HeldItem | null {
  return itemAt(racer, racer.selected);
}

/** The selected slot's index. It points at a held slot whenever anything is held. */
export function selectedSlot(racer: Racer): number {
  return racer.selected;
}

/** The item in `slot`, or null for an empty or out-of-range slot. */
export function itemAt(racer: Racer, slot: number): HeldItem | null {
  return racer.items[slot] ?? null;
}

/** Every slot in order, a held item or null, for readers that lay out the slots (HUD, summary). */
export function slotItems(racer: Racer): readonly (HeldItem | null)[] {
  return racer.items;
}

/** The first slot whose held item satisfies `pred`, or -1. Empty slots are never offered to `pred`. */
export function firstSlotWhere(racer: Racer, pred: (item: HeldItem, slot: number) => boolean): number {
  return racer.items.findIndex((item, slot) => item !== null && pred(item, slot));
}

/**
 * Replaces the whole inventory with copies of `items` and selects `selected`. For staging a race
 * (tests, debug stages); play changes the inventory only by gaining, cycling, spending and hits.
 *
 * @throws {Error} When `items` isn't `stackMaxFor(racer)` long, holds a kind twice, or `selected` is an
 *   empty or out-of-range slot while anything is held.
 */
export function setItems(racer: Racer, items: readonly (HeldItem | null)[], selected: number): void {
  const slots = stackMaxFor(racer);
  if (items.length !== slots) {
    throw new Error(`setItems for '${racer.id}' got ${items.length} slots; ${racer.character} has ${slots}`);
  }
  const kinds = items.flatMap((item) => (item ? [item.kind] : []));
  const repeated = kinds.find((kind, i) => kinds.indexOf(kind) !== i);
  if (repeated !== undefined) {
    throw new Error(`setItems for '${racer.id}' holds '${repeated}' twice (${kinds.join(', ')}); a kind is held once`);
  }
  if (kinds.length > 0 && !items[selected]) {
    throw new Error(`setItems for '${racer.id}' selects slot ${selected}, which is empty; select a held slot`);
  }
  racer.items = items.map((item) => (item ? { ...item } : null));
  racer.selected = selected;
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
 * Pops a Bubble Shield held in any slot: empties that slot, moves the selection on as for a used-up
 * item, and emits `shield.popped`.
 *
 * @returns true when a shield was popped; false, changing nothing, when none is held.
 */
export function popShield(world: World, racer: Racer): boolean {
  const shieldSlot = firstSlotWhere(racer, (item) => item.kind === 'bubbleShield');
  if (shieldSlot < 0) return false;
  emptySlot(racer, shieldSlot);
  world.events.emit({ type: 'shield.popped', id: racer.id });
  return true;
}

/**
 * Knocks the selected item and all its charges off, emitting `powerup.lost {cause: 'hit'}`, and moves
 * the selection on as for a used-up item. `applyHit` floats the item loose.
 *
 * @returns The item knocked off, or null (nothing changed or emitted) when nothing is held.
 */
export function knockSelected(world: World, racer: Racer): HeldItem | null {
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
