/** Crates, selection, firing, and the tick order of item effects. */
import { TICK_DT } from '@arcade/core';
import { ITEMS } from '../tuning.ts';
import type { Racer, TickInputs, World } from '../types.ts';
import { fireBoots } from './boots.ts';
import { fireBurr } from './burr.ts';
import { rollItem, stepCrates } from './crates.ts';
import { isImmobilized } from './hits.ts';
import { heldSlot, removeItem, selectSlot } from './inventory.ts';
import { firePie, stepPie } from './pie.ts';
import { fireShield, stepSap } from './shield.ts';

/** Rolls a crate item using the odds for the racer's place. */
export { rollItem };

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
    if (racer.state === 'finished') continue;
    const immobilized = isImmobilized(racer);
    ageItemTimers(racer);
    if (racer.state !== 'racing') continue;
    const input = inputs[racer.id];
    if (!input) continue;
    if (input.nextPressed) selectSlot(world, racer, heldSlot(racer, 1));
    else if (input.prevPressed) selectSlot(world, racer, heldSlot(racer, -1));
    if (input.firePressed && !immobilized && racer.itemCooldown === 0) fire(world, racer);
  }
  if (world.shots.length > 0) {
    world.shots = world.shots.filter((shot) =>
      shot.kind === 'pie' ? stepPie(world, shot, TICK_DT) : stepSap(world, shot, TICK_DT),
    );
  }
}

/**
 * Old timers age once, after they gate movement and immobilized fire, before new effects begin.
 * Cooldown and burr are read after aging, so their duration includes the firing tick.
 */
function ageItemTimers(racer: Racer): void {
  if (racer.itemCooldown > 0) racer.itemCooldown--;
  if (racer.stunTicks > 0) racer.stunTicks--;
  if (racer.trappedTicks > 0) racer.trappedTicks--;
  if (racer.bootsTicks > 0) racer.bootsTicks--;
  if (racer.burrTicks > 0) racer.burrTicks--;
}

function fire(world: World, racer: Racer): void {
  const item = racer.slots[racer.selected];
  if (!item) return;
  racer.itemCooldown = ITEMS.cooldownTicks;
  world.events.emit({ type: 'item.fired', id: racer.id, kind: item.kind });
  if (--item.charges === 0) removeItem(world, racer, racer.selected);

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
