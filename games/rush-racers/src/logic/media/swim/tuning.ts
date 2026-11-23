/**
 * Swim's numbers and rules as data: the tuning its physics reads, what its water does in the generic
 * rules that push racers around, and how those rules read a kick. Values are shared by the player
 * and rivals; profiles, power-ups and abilities scale them through MoveModifiers.
 */
import { ABILITY } from '../../abilities.ts';
import { TRAPPED_RISE_SPEED } from '../../hazards/tuning.ts';
import { LOOSE } from '../../powerups/tuning.ts';
import type { KickRules, MediumEffects, MediumTuning } from '../types.ts';

/**
 * Swim tuning in pixels and seconds. Cruise speed is `force / drag`. In `extra`: `sink` is the
 * downward acceleration while no direction is held (px/s²), `currentForce` the acceleration a
 * current applies along its direction (px/s²), `kelpDragMul` the drag multiplier inside kelp.
 */
export const SWIM_TUNING = {
  base: { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 },
  force: 210,
  drag: 3,
  maxSpeed: 180,
  kick: 110,
  extra: { sink: 14, currentForce: 160, kelpDragMul: 2.2 },
} as const satisfies MediumTuning;

/** Water holds a dash, knockback or decoy on both axes, and floats trapped racers and loose power-ups up. */
export const SWIM_EFFECTS: MediumEffects = {
  dashAxes: 'both',
  trappedDrift: -TRAPPED_RISE_SPEED,
  looseDrift: -LOOSE.riseSpeed,
};

/**
 * Every kick counter works underwater. Gil's spring kick applies to a kick aimed steeply up: the
 * unit aim's y at most -`ABILITY.springKick.minUp`, about 45 degrees or more above level.
 */
export const SWIM_KICK_RULES: KickRules = {
  dodgesSquid: true,
  shakesLatch: true,
  countersUndertow: true,
  springKick: (aim) => aim.y <= -ABILITY.springKick.minUp,
};
