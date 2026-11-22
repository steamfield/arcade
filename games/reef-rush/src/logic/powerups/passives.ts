/**
 * Passive effects of held power-ups and timed statuses on how a racer swims and
 * bumps. `modifiers.ts` and `world.ts` read them. Lane 3/a implements it; the
 * scaffold ships the signatures.
 */
import type { MoveModifiers, Racer } from '../types.ts';

/**
 * `base` with the racer's held power-ups and statuses folded in (PASSIVE in `powerups/tuning.ts`):
 * Jet Fins multiplies forceMul by jetForceMul and sets kickCooldownTicks to jetKickCooldownTicks;
 * boost, slowed and inflated multiply forceMul by their factors. Bubble Shield, Puffer, Ink Sac and
 * Glow Lantern don't change swimming.
 */
export function withPassives(racer: Racer, base: MoveModifiers): MoveModifiers {
  void racer;
  void base;
  throw new Error('not implemented');
}

/** The mass a racer bumps with: its profile's, times PASSIVE.pufferMassMul while it holds a Puffer. */
export function bumpMass(racer: Racer): number {
  if (racer.stack.length === 0) return racer.profile.mass;
  throw new Error('not implemented');
}
