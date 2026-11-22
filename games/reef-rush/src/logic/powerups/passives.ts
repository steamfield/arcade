/**
 * Passive effects of held power-ups and timed statuses on how a racer swims and
 * bumps. `modifiers.ts` and `world.ts` read them. Glow Lantern's passive (pulling
 * pearls) lives with the pearls in `pickups/pearls.ts`; Bubble Shield and Ink Sac
 * have none.
 */
import type { MoveModifiers, Racer } from '../types.ts';
import { PASSIVE } from './tuning.ts';

/**
 * `base` with the racer's held power-ups and statuses folded in (PASSIVE in `powerups/tuning.ts`):
 * Jet Fins multiplies forceMul by jetForceMul and sets kickCooldownTicks to jetKickCooldownTicks;
 * boost, slowed and inflated multiply forceMul by their factors. Bubble Shield, Puffer, Ink Sac and
 * Glow Lantern don't change swimming.
 */
export function withPassives(racer: Racer, base: MoveModifiers): MoveModifiers {
  const { boost, slowed, inflated } = racer.status;
  const jet = racer.stack.includes('jetFin');
  const forceMul =
    base.forceMul *
    (jet ? PASSIVE.jetForceMul : 1) *
    (boost > 0 ? PASSIVE.boostForceMul : 1) *
    (slowed > 0 ? PASSIVE.slowedForceMul : 1) *
    (inflated > 0 ? PASSIVE.inflatedForceMul : 1);
  return { ...base, forceMul, kickCooldownTicks: jet ? PASSIVE.jetKickCooldownTicks : base.kickCooldownTicks };
}

/** The mass a racer bumps with: its profile's, times PASSIVE.pufferMassMul while it holds a Puffer. */
export function bumpMass(racer: Racer): number {
  return racer.profile.mass * (racer.stack.includes('puffer') ? PASSIVE.pufferMassMul : 1);
}
