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

/**
 * Tess the turtle is steady and clean, Squib the squid fast and erratic, Bo the crab slow and heavy.
 *
 * Rivals swim harder than the player (forceMul above 1) but rarely kick or burst. `kickSkill` and
 * `itemAggression` are chances per eligible tick, so even 0.02 kicks within a second or so of the
 * kick being ready; these values space kicks out to a few seconds. The split matters because
 * catch-up (`CATCH_UP` in rival.ts) scales swim force only: a rival whose speed comes from force
 * can be held back behind a slow player and pushed on behind a fast one, which is what keeps both
 * a novice and an expert in a close race (see difficulty.test.ts). Frequent kicks would carry a
 * rival away from a player who never kicks, whatever the catch-up does.
 */
export const RIVAL_PROFILES: Record<Exclude<RacerId, 'player'>, RivalProfile> = {
  tess: {
    id: 'tess',
    forceMul: 1.35,
    kickSkill: 0.008,
    wobble: 0.08,
    reactionTicks: 6,
    mass: 1.2,
    itemAggression: 0.004,
  },
  squib: {
    id: 'squib',
    forceMul: 1.31,
    kickSkill: 0.02,
    wobble: 0.35,
    reactionTicks: 3,
    mass: 0.8,
    itemAggression: 0.02,
  },
  bo: { id: 'bo', forceMul: 1.28, kickSkill: 0.005, wobble: 0.12, reactionTicks: 8, mass: 2, itemAggression: 0.008 },
};

/**
 * Bots that drive the player's racer in tests, to measure difficulty with the player's physics.
 * An expert kicks well and steers clean; a novice never kicks and steers loosely.
 */
export const BOT_PROFILES = {
  expert: { ...PLAYER_PROFILE, kickSkill: 0.95, wobble: 0.04, reactionTicks: 2, itemAggression: 0.8 },
  novice: { ...PLAYER_PROFILE, kickSkill: 0, wobble: 0.5, reactionTicks: 12, itemAggression: 0 },
} as const satisfies Record<string, RivalProfile>;
