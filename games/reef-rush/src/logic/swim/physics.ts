/**
 * Swimming: how one racer's velocity responds to its intent and the water.
 * Velocity, facing and kick cooldown only; position is moved by `collide.ts`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import type { Environment, Intent, MoveModifiers, Racer } from '../types.ts';

/**
 * Swim tuning in pixels and seconds. Cruise speed is `force / drag`.
 * Values are shared by the player and rivals; profiles scale them through MoveModifiers.
 */
export const SWIM = {
  /** Acceleration from holding a direction, px/s². */
  force: 210,
  /** Linear drag per second; speed decays by `drag * dt` of itself each tick. */
  drag: 3,
  /** Downward acceleration when no vertical input is held, px/s². */
  sink: 14,
  /** Acceleration a current applies along its direction, px/s². */
  currentForce: 160,
  /** Drag multiplier inside kelp. */
  kelpDragMul: 2.2,
  /** Speed added by a kick, px/s. */
  kick: 110,
  /** Hard cap on speed, px/s. */
  maxSpeed: 180,
  /** Racer hitbox, px. */
  width: 12,
  height: 10,
} as const;

/** Modifiers for a racer with no profile bonuses or power-ups. */
export const BASE_MODIFIERS: MoveModifiers = { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 };

/**
 * Updates a racer's velocity, facing and kick cooldown for one tick.
 * Emits `racer.kicked` on the tick a kick fires.
 */
export function applyIntent(
  racer: Racer,
  intent: Intent,
  env: Environment,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
): void {
  void racer;
  void intent;
  void env;
  void mods;
  void events;
  void dt;
  throw new Error('not implemented');
}
