/**
 * Thornwood's cast: who each character is, how each one drives as a rival, and drawing the three
 * rivals for a race from the world's random state. The cast is cosmetic for the player; no
 * character has an ability.
 */
import type { CharacterId } from './types.ts';

/** A character's display name and what it is, for the select screen and results. */
export interface CastMember {
  name: string;
  species: string;
}

export const CAST: Readonly<Record<CharacterId, CastMember>> = {
  grit: { name: 'Grit', species: 'badger' },
  skip: { name: 'Skip', species: 'hare' },
  blaze: { name: 'Blaze', species: 'fox' },
  shade: { name: 'Shade', species: 'panther cub' },
  cheeks: { name: 'Cheeks', species: 'chipmunk' },
  duke: { name: 'Duke', species: 'tortoise' },
  dusk: { name: 'Dusk', species: 'owl' },
  fang: { name: 'Fang', species: 'wolf' },
};

/**
 * How a character drives when it is a rival. Every value is noise or a bias layered on the same
 * driving rules, so all rivals stay competent; lane 2a sets the numbers.
 */
export interface RivalProfile {
  /** Largest random steer added each tick, -1..1 scale. */
  steerWobble: number;
  /** Up to this many ticks of random delay before a planned jump. */
  jumpJitterTicks: number;
  /** Preferred lane offset from the centreline when nothing is in the way, m (+ is right). */
  lineBias: number;
}

export const RIVAL_PROFILES: Readonly<Record<CharacterId, RivalProfile>> = {
  grit: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  skip: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  blaze: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  shade: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  cheeks: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  duke: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  dusk: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
  fang: { steerWobble: 0, jumpJitterTicks: 0, lineBias: 0 },
};

/**
 * Three distinct rivals for slots r1, r2, r3, never `player`, drawn with `createRng(rngState)`.
 * Returns them with the rng state after the draw.
 */
export function drawRivals(
  rngState: number,
  player: CharacterId,
): { rivals: [CharacterId, CharacterId, CharacterId]; rngState: number } {
  void rngState;
  void player;
  throw new Error('drawRivals: not implemented (phase 2 lane a)');
}
