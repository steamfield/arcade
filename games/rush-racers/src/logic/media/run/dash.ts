/**
 * Run's dash: a horizontal burst along facing on the dash button, gated by the kick cooldown and
 * allowed once in the air until the runner lands. It emits `racer.kicked`, so the generic race code
 * spends a dash charge and opens the bonk window exactly as it does for a swim kick.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { MoveModifiers, Racer } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import type { RunMotion } from './data.ts';

/**
 * Dashes when the button is pressed and the dash is ready; otherwise runs the cooldown down a tick.
 * A dash sets `vx` to `tuning.kick * mods.kickMul` along facing and never touches `vy`.
 */
export function dashOrCoolDown(
  racer: Racer,
  motion: RunMotion,
  kick: boolean,
  grounded: boolean,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
): void {
  if (kick && canDash(racer, motion, grounded)) {
    racer.body.vx = racer.facing * tuning.kick * mods.kickMul;
    racer.kickCooldown = mods.kickCooldownTicks;
    if (!grounded) motion.airDashUsed = true;
    events.emit({ type: 'racer.kicked', id: racer.id });
    return;
  }
  coolDownKick(racer);
}

/** Takes a tick off the kick cooldown, stopping at 0. */
export function coolDownKick(racer: Racer): void {
  if (racer.kickCooldown > 0) racer.kickCooldown -= 1;
}

function canDash(racer: Racer, motion: RunMotion, grounded: boolean): boolean {
  return racer.kickCooldown === 0 && (grounded || !motion.airDashUsed);
}
