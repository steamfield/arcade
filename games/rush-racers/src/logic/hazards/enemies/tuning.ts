/**
 * Enemy tuning. Data only. Durations are ticks (1/60 s), speeds px/s, sizes px. A swimmer cruises at
 * about 70 px/s (swim force / drag), which the speeds here are measured against.
 */

/** Shared by every kind. */
export const ENEMY = {
  /** Ticks after a dash (kick) during which touching an enemy bonks it rather than hurting the racer. */
  bonkTicks: 12,
} as const;

/**
 * A shark patrols a lane, winds up on a racer it sees and charges at it. Two bonks or one squid beat it.
 * How far it sees and patrols, its rest after a charge and its turn mid-charge depend on the level
 * (`SharkTuning` in `difficulty-level.ts`).
 */
export const SHARK = {
  hp: 2,
  /** Side of its square hitbox, centred on it. */
  size: 14,
  patrolSpeed: 24,
  /** The tell before a charge: 0.5 s, matching the engine's flash and `!`. */
  windupTicks: 30,
  /** Twice cruise, so a racer that ignores the tell is caught, and one that moves off the line is not. */
  chargeSpeed: 140,
  chargeTicks: 36,
  /** Harmless and knocked back after a bonk. */
  staggerTicks: 36,
  staggerSpeed: 100,
  /** Velocity kept per tick while staggered. */
  staggerDragPerTick: 0.9,
  pearls: 5,
} as const;

/** An eel hides in a wall hole and lunges out of it on a fixed cycle, telegraphed. */
export const EEL = {
  hp: 1,
  size: 10,
  /** One full cycle: hidden, then the warning, then the lunge out and back. */
  cycleTicks: 150,
  telegraphTicks: 36,
  /** Out and back, half each way. Only while lunging can it hit or be bonked. */
  lungeTicks: 24,
  /** How far its centre reaches out of the hole at the peak, in tiles. */
  lungeTiles: 2,
  pearls: 2,
} as const;

/** A crab walks its floor back and forth. One bonk beats it. */
export const CRAB = {
  hp: 1,
  size: 12,
  walkSpeed: 20,
  pearls: 1,
} as const;
