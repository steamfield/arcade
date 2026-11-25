/** Crates, selection, firing, and the tick order of item effects. */
import { TICK_DT } from '@arcade/core';
import { isImmobilized } from '../status.ts';
import { ITEMS } from '../tuning.ts';
import type { Racer, TickInputs, World } from '../types.ts';
import { fireBoots } from './boots.ts';
import { burrContact, fireBurr } from './burr.ts';
import { rollItem, stepCrates } from './crates.ts';
import { heldSlot, removeItem, selectSlot } from './inventory.ts';
import { firePie, stepPie } from './pie.ts';
import { fireShield, stepSap } from './shield.ts';
import type { RacerItems } from './types.ts';

export { hitRacer } from './hits.ts';
export { type HeldItem, ITEM_KINDS, type ItemKind, type RacerItems, type Shot, type Splat } from './types.ts';
export { heldSlot, rollItem };

/** Starts a racer with empty slots and no item effects. */
export function createRacerItems(): RacerItems {
  return {
    slots: Array.from({ length: ITEMS.slots }, () => null),
    selected: 0,
    cooldown: 0,
    stunTicks: 0,
    trappedTicks: 0,
    burrTicks: 0,
    bootsTicks: 0,
  };
}

/** Applies burr contact in both directions, in racer slot order. */
export function burrContacts(world: World, a: Racer, b: Racer): void {
  burrContact(world, a, b);
  burrContact(world, b, a);
}

/**
 * Runs after racers move and before bumps, using the controls movement consumed.
 * `from` holds pre-move poses in racer slot order for swept crate contacts. A `null` entry
 * marks a racer who was fallen or finished before movement.
 */
export function stepItems(
  world: World,
  inputs: TickInputs,
  from: readonly ({ s: number; d: number; y: number } | null)[],
): void {
  stepCrates(world, from);
  if (world.splats.length > 0) world.splats = world.splats.filter((splat) => --splat.ticksLeft > 0);
  for (const racer of world.racers) {
    if (racer.state === 'finished') {
      if (racer.finishTicks === world.raceTicks) clearItemTimers(racer.items);
      continue;
    }
    const immobilized = isImmobilized(racer);
    ageItemTimers(racer.items);
    if (racer.state !== 'racing') continue;
    const input = inputs[racer.id];
    if (!input) continue;
    if (input.nextPressed) selectSlot(world, racer, heldSlot(racer, 1));
    else if (input.prevPressed) selectSlot(world, racer, heldSlot(racer, -1));
    if (input.firePressed && !immobilized && racer.items.cooldown === 0) fire(world, racer);
  }
  if (world.shots.length > 0) {
    world.shots = world.shots.filter((shot) =>
      shot.kind === 'pie' ? stepPie(world, shot, TICK_DT) : stepSap(world, shot, TICK_DT),
    );
  }
}

function clearItemTimers(items: RacerItems): void {
  items.cooldown = 0;
  items.stunTicks = 0;
  items.trappedTicks = 0;
  items.bootsTicks = 0;
  items.burrTicks = 0;
}

/**
 * Old timers age once, after they gate movement and immobilized fire, before new effects begin.
 * Cooldown and burr are read after aging, so their duration includes the firing tick.
 */
function ageItemTimers(items: RacerItems): void {
  if (items.cooldown > 0) items.cooldown--;
  if (items.stunTicks > 0) items.stunTicks--;
  if (items.trappedTicks > 0) items.trappedTicks--;
  if (items.bootsTicks > 0) items.bootsTicks--;
  if (items.burrTicks > 0) items.burrTicks--;
}

function fire(world: World, racer: Racer): void {
  const { items } = racer;
  const item = items.slots[items.selected];
  if (!item) return;
  items.cooldown = ITEMS.cooldownTicks;
  world.events.emit({ type: 'item.fired', id: racer.id, kind: item.kind });
  if (--item.charges === 0) removeItem(world, racer, items.selected);

  switch (item.kind) {
    case 'boots':
      fireBoots(racer);
      break;
    case 'burr':
      fireBurr(racer);
      break;
    case 'shield':
      fireShield(world, racer);
      break;
    case 'pie':
      firePie(world, racer);
      break;
  }
}
