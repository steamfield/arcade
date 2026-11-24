/**
 * Thornwood's cast: who each character is, how each one drives as a rival, and drawing the three
 * rivals for a race from the world's random state. The cast is cosmetic for the player; no
 * character has an ability.
 */
import { createRng } from '@arcade/core';
import { CHARACTER_IDS, type CharacterId } from './types.ts';

/** A character's display name and what it is, for the select screen and results. */
export interface CastMember {
  name: string;
  species: string;
}

/** Thornwood's character names and species for menus and standings. */
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
 * driving rules, so all rivals stay competent.
 */
export interface RivalProfile {
  /** Largest random steer added each tick, -1..1 scale. */
  steerWobble: number;
  /** Up to this many ticks of delay in the jump decision. */
  jumpJitterTicks: number;
  /** Offset from the racer's grid lane when nothing is in the way, m (+ is right). */
  lineBias: number;
  /** Fraction of normal run speed at which this rival is comfortable starting a dash. */
  dashAtSpeed: number;
}

/** How each character steers, jumps and dashes when driven by the rival AI. */
export const RIVAL_PROFILES: Readonly<Record<CharacterId, RivalProfile>> = {
  grit: { steerWobble: 0.035, jumpJitterTicks: 1, lineBias: -0.1, dashAtSpeed: 0.82 },
  skip: { steerWobble: 0.045, jumpJitterTicks: 2, lineBias: 0.15, dashAtSpeed: 0.73 },
  blaze: { steerWobble: 0.06, jumpJitterTicks: 2, lineBias: 0.3, dashAtSpeed: 0.76 },
  shade: { steerWobble: 0.025, jumpJitterTicks: 1, lineBias: -0.25, dashAtSpeed: 0.85 },
  cheeks: { steerWobble: 0.07, jumpJitterTicks: 3, lineBias: -0.3, dashAtSpeed: 0.7 },
  duke: { steerWobble: 0.02, jumpJitterTicks: 1, lineBias: 0.2, dashAtSpeed: 0.89 },
  dusk: { steerWobble: 0.03, jumpJitterTicks: 2, lineBias: -0.15, dashAtSpeed: 0.87 },
  fang: { steerWobble: 0.05, jumpJitterTicks: 3, lineBias: 0.1, dashAtSpeed: 0.79 },
};

/**
 * Three distinct rivals for slots r1, r2, r3, never `player`, drawn with `createRng(rngState)`.
 * Returns them with the rng state after the draw.
 */
export function drawRivals(
  rngState: number,
  player: CharacterId,
): { rivals: [CharacterId, CharacterId, CharacterId]; rngState: number } {
  const rng = createRng(rngState);
  const available = CHARACTER_IDS.filter((id) => id !== player);
  const first = rng.pick(available);
  const remaining = available.filter((id) => id !== first);
  const second = rng.pick(remaining);
  const third = rng.pick(remaining.filter((id) => id !== second));
  return { rivals: [first, second, third], rngState: rng.state() };
}
