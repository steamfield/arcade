/** Item state and item-made things in the world. Phase 1 of the structure plan moves ItemKind, ITEM_KINDS, HeldItem, Shot and Splat here. */
import type { HeldItem } from '../types.ts';

/** A racer's items and the timers items put on it. Only `logic/items/` writes it. */
export interface RacerItems {
  /** Inventory places, `ITEMS.slots` long; `null` is empty. */
  slots: (HeldItem | null)[];
  /** Index of the selected slot. */
  selected: number;
  /** Ticks before this racer can fire again. */
  cooldown: number;
  /** Ticks left stunned by a hit with nothing held. */
  stunTicks: number;
  /** Ticks left stuck in sap. */
  trappedTicks: number;
  /** Ticks left puffed up by a Burr Ball. */
  burrTicks: number;
  /** Ticks left of a Rocket Boots boost. */
  bootsTicks: number;
}
