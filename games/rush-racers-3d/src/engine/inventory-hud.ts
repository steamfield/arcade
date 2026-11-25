import { ITEMS } from '../logic/tuning.ts';
import type { ItemKind, Racer } from '../logic/types.ts';

const PICKUP_TICKS = 15;
const ITEM_ICONS: Record<ItemKind, { name: string; art: string }> = {
  boots: {
    name: 'Rocket Boots',
    art: '<path fill="#ff8750" d="M9 16 5 23 5 19 1 22 3 15Z"/><path fill="#ffd666" d="m10 16-4 4 1-5Z"/><path fill="#e25648" stroke="#ffdda5" stroke-width="1.5" stroke-linejoin="round" d="M10 3h7v8l4 2a3 3 0 0 1 0 5H8v-5z"/><path stroke="#fff0bf" stroke-width="1.5" d="M10 7h7m-8 8h13"/>',
  },
  shield: {
    name: 'Sap Shield',
    art: '<path fill="#e89728" stroke="#ffdf84" stroke-width="1.5" stroke-linejoin="round" d="M12 2c2 2 6 3 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5c3 0 6-1 8-3Z"/><path fill="#fff0bd" d="M12 6c1.5 2.3 4 4.7 4 7a4 4 0 1 1-8 0c0-2.3 2.5-4.7 4-7Z"/>',
  },
  burr: {
    name: 'Burr Ball',
    art: '<path fill="#ac64be" stroke="#edbfec" stroke-width="1.5" stroke-linejoin="round" d="m12 1 2.5 5 5.3-2-1.8 5.3 5 2.7-5 2.7 1.8 5.3-5.3-2-2.5 5-2.5-5-5.3 2L6 14.7 1 12l5-2.7L4.2 4l5.3 2Z"/><circle cx="12" cy="12" r="3.8" fill="#704383"/>',
  },
  pie: {
    name: 'Mud Pie',
    art: '<path fill="#a36649" stroke="#e4b488" stroke-width="1.5" stroke-linejoin="round" d="M2 11h20l-3 7a14 14 0 0 1-14 0Z"/><ellipse cx="12" cy="11" rx="10" ry="4.5" fill="#704332" stroke="#e4b488" stroke-width="1.5"/><path stroke="#edbd8e" stroke-width="1.4" stroke-linecap="round" d="m9 11 1-1m3 2 2-1"/>',
  },
};

interface InventorySlot {
  node: HTMLSpanElement;
  icon: HTMLSpanElement;
  charges: HTMLSpanElement;
  kind: ItemKind | null;
  uses: number;
  selected: boolean;
  flashUntil: number;
}

function inventorySlot(): InventorySlot {
  const node = document.createElement('span');
  const icon = document.createElement('span');
  const charges = document.createElement('span');
  node.className = 'rr3d-item-slot';
  node.setAttribute('role', 'img');
  icon.className = 'rr3d-item-icon';
  charges.className = 'rr3d-item-charges';
  node.append(icon, charges);
  return { node, icon, charges, kind: null, uses: -1, selected: false, flashUntil: -1 };
}

/** Race inventory DOM and short pickup flashes. */
export class InventoryHud {
  readonly root = document.createElement('div');
  private readonly slots = Array.from({ length: ITEMS.slots }, inventorySlot);

  constructor() {
    this.root.className = 'rr3d-inventory';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Inventory');
    for (const { node } of this.slots) this.root.append(node);
  }

  /** Highlights a slot when a crate awards an item there. */
  flashPickup(index: number, tick: number): void {
    const slot = this.slots[index];
    if (slot) slot.flashUntil = tick + PICKUP_TICKS;
  }

  /** Clears pickup highlights when a new race starts. */
  resetFlashes(): void {
    for (const slot of this.slots) slot.flashUntil = -1;
  }

  /** Updates changed DOM values and returns whether the player has an item. */
  sync(tick: number, player: Racer): boolean {
    let held = false;
    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      if (!slot) continue;
      const item = player.items.slots[index];
      const kind = item?.kind ?? null;
      const uses = item?.charges ?? 0;
      const selected = player.items.selected === index;
      const flash = tick < slot.flashUntil;
      held ||= kind !== null;
      if (slot.node.hasAttribute('data-pickup') !== flash) slot.node.toggleAttribute('data-pickup', flash);
      if (kind === slot.kind && uses === slot.uses && selected === slot.selected) continue;
      if (kind !== slot.kind) {
        slot.kind = kind;
        slot.icon.innerHTML = kind ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ITEM_ICONS[kind].art}</svg>` : '';
        slot.node.toggleAttribute('data-held', kind !== null);
      }
      if (uses !== slot.uses) {
        slot.uses = uses;
        slot.charges.textContent = uses > 0 ? String(uses) : '';
      }
      if (selected !== slot.selected) {
        slot.selected = selected;
        slot.node.toggleAttribute('data-selected', selected);
      }
      const label = kind ? `${ITEM_ICONS[kind].name}, ${uses} ${uses === 1 ? 'charge' : 'charges'}` : 'empty';
      slot.node.setAttribute('aria-label', `Slot ${index + 1}: ${label}${selected ? ', selected' : ''}`);
    }
    return held;
  }
}
