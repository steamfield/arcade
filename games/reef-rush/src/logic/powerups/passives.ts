/**
 * Passive effects of the selected item and timed statuses on how a racer swims and
 * bumps. `modifiers.ts` and `world.ts` read them. An item's passive applies only
 * while its slot is selected. Glow Lantern's passive (pulling pearls) lives with the
 * pearls in `pickups/pearls.ts`; Bubble Shield and Ink Sac have none.
 */
import type { MoveModifiers, Racer } from '../types.ts';
import { selectedItem } from './inventory.ts';
import { PASSIVE, SQUID } from './tuning.ts';

/**
 * `base` with the racer's selected item and statuses folded in (PASSIVE in `powerups/tuning.ts`):
 * selected Jet Fins multiply forceMul by jetForceMul and sets kickCooldownTicks to jetKickCooldownTicks;
 * boost, slowed, inflated and latched multiply forceMul by their factors. Bubble Shield, Puffer, Ink Sac and
 * Glow Lantern don't change swimming.
 */
export function withPassives(racer: Racer, base: MoveModifiers): MoveModifiers {
  const { boost, slowed, inflated, latched } = racer.status;
  const jet = selectedItem(racer)?.kind === 'jetFin';
  const forceMul =
    base.forceMul *
    (jet ? PASSIVE.jetForceMul : 1) *
    (boost > 0 ? PASSIVE.boostForceMul : 1) *
    (slowed > 0 ? PASSIVE.slowedForceMul : 1) *
    (inflated > 0 ? PASSIVE.inflatedForceMul : 1) *
    (latched > 0 ? SQUID.latchedForceMul : 1);
  return { ...base, forceMul, kickCooldownTicks: jet ? PASSIVE.jetKickCooldownTicks : base.kickCooldownTicks };
}

/** The mass a racer bumps with: its profile's, times PASSIVE.pufferMassMul while a Puffer is selected. */
export function bumpMass(racer: Racer): number {
  return racer.profile.mass * (selectedItem(racer)?.kind === 'puffer' ? PASSIVE.pufferMassMul : 1);
}
