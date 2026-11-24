/**
 * Hazard and hit numbers shared by hazards/, powerups/ and world.ts. Data only.
 * Durations are ticks (1/60 s), speeds px/s, sizes px.
 */
import { TILE } from '../types.ts';

/** What a landed hit does to a racer (causes other than flash and bubble; see `applyHit`). */
export const HIT = {
  /** Stun when a hit finds nothing held. */
  stunTicks: 50,
  /** Every landed hit, absorbed or not, makes the racer ignore hits for this long. */
  invulnerableTicks: 60,
  /** Speed the racer is set moving at, directly away from the hit's source. */
  knockbackSpeed: 80,
} as const;

/** Jellyfish bob straight up and down around their home tile centre on a sine of their phase. */
export const JELLY = {
  cycleTicks: 180,
  /** Half the bob: the jelly travels one tile above and one below its home, two tiles in all. */
  bobAmplitude: TILE,
  /** Side of its square hitbox, centred on it. */
  size: 12,
} as const;

/** A trapped racer rises at this speed, px/s, ignoring input, drag and currents. */
export const TRAPPED_RISE_SPEED = 30;

/**
 * A storm zone's cycle (`LevelDef.lightning`): it warns for `warnTicks`, then strikes for
 * `strikeTicks`, at the end of each period. A zone's period must be at least the two together.
 */
export const LIGHTNING = {
  warnTicks: 45,
  strikeTicks: 12,
} as const;
