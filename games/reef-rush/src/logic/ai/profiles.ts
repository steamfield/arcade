/**
 * Who the computer racers are and how well they swim. Data only; difficulty is
 * tuned here and checked by the difficulty test.
 */
import type { RacerId, RivalProfile } from '../types.ts';

/** The player's own swimming. Only `forceMul` and `mass` apply when a human drives it. */
export const PLAYER_PROFILE: RivalProfile = {
  id: 'player',
  forceMul: 1,
  kickSkill: 1,
  wobble: 0,
  reactionTicks: 1,
  mass: 1,
  itemAggression: 0,
};

/** Tess the turtle is steady and clean, Squib the squid fast and erratic, Bo the crab slow and heavy. */
export const RIVAL_PROFILES: Record<Exclude<RacerId, 'player'>, RivalProfile> = {
  tess: { id: 'tess', forceMul: 0.93, kickSkill: 0.5, wobble: 0.08, reactionTicks: 6, mass: 1.2, itemAggression: 0.3 },
  squib: {
    id: 'squib',
    forceMul: 0.97,
    kickSkill: 0.9,
    wobble: 0.35,
    reactionTicks: 3,
    mass: 0.8,
    itemAggression: 0.8,
  },
  bo: { id: 'bo', forceMul: 0.9, kickSkill: 0.35, wobble: 0.12, reactionTicks: 8, mass: 2, itemAggression: 0.5 },
};

/**
 * Bots that drive the player's racer in tests, to measure difficulty with the player's physics.
 * An expert kicks well and steers clean; a novice never kicks and steers loosely.
 */
export const BOT_PROFILES = {
  expert: { ...PLAYER_PROFILE, kickSkill: 0.95, wobble: 0.04, reactionTicks: 2, itemAggression: 0.8 },
  novice: { ...PLAYER_PROFILE, kickSkill: 0, wobble: 0.5, reactionTicks: 12, itemAggression: 0 },
} as const satisfies Record<string, RivalProfile>;
