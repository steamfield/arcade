/** Inventory, racer effects, and item projectiles and splats. */
import type { RacerId, Span } from '../types.ts';

/** The four items a crate can give. */
export type ItemKind = 'boots' | 'shield' | 'burr' | 'pie';

/** All item kinds available from crates. */
export const ITEM_KINDS: readonly ItemKind[] = ['boots', 'shield', 'burr', 'pie'];

/** An item in an inventory slot, with the uses it has left. */
export interface HeldItem {
  kind: ItemKind;
  charges: number;
}

/** A racer's items and the timers items put on it. Only `logic/items/` writes it. */
export interface RacerItems {
  /** The inventory: `ITEMS.slots` places, null when empty. Never two of a kind. */
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

/**
 * Something fired and still flying, in track space. A `pie` flies in an arc and splats where it
 * lands. A `sap` glob keeps its `height` above the ground as it travels along `s` and traps the
 * first other racer it touches. `travelled` counts its meters up to `ITEMS.sapRange`.
 */
export type Shot =
  | { kind: 'pie'; owner: RacerId; s: number; d: number; y: number; vs: number; vd: number; vy: number }
  | { kind: 'sap'; owner: RacerId; s: number; d: number; height: number; vs: number; travelled: number };

/** A mud patch left by a Mud Pie: mud for every racer but `owner` until `ticksLeft` runs out. */
export interface Splat extends Span {
  owner: RacerId;
  ticksLeft: number;
}
