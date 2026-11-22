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
 * Rivals swim harder than the player (forceMul well above 1) and kick and burst much less. Measured over 200 expert races on the course: Tess kicks about every
 * 4.5 s, Squib every 2.7 s and Bo every 7 s (`kickSkill` is a chance per eligible tick); Squib
 * bursts about once a minute, Tess and Bo every few minutes. With catch-up off, Squib's median
 * finish is about 92 s, Tess's 93 s and Bo's 97 s, against the expert bot's 84 s.
 *
 * The split matters because catch-up (`CATCH_UP` in rival.ts) scales swim force only: it can ease a
 * rival off ahead of a slow player and push it on behind a fast one, but it can't touch speed from
 * kicks. Rare bursts also stop a rival close behind from stunning the player every few seconds.
 * difficulty.test.ts holds the result to its bars.
 */
export const RIVAL_PROFILES: Record<Exclude<RacerId, 'player'>, RivalProfile> = {
  tess: {
    id: 'tess',
    forceMul: 1.5,
    kickSkill: 0.005,
    wobble: 0.08,
    reactionTicks: 6,
    mass: 1.2,
    itemAggression: 0.0003,
  },
  squib: {
    id: 'squib',
    forceMul: 1.54,
    kickSkill: 0.01,
    wobble: 0.35,
    reactionTicks: 3,
    mass: 0.8,
    itemAggression: 0.001,
  },
  bo: { id: 'bo', forceMul: 1.44, kickSkill: 0.003, wobble: 0.12, reactionTicks: 8, mass: 2, itemAggression: 0.0005 },
};

/**
 * Bots that drive the player's racer in tests, to measure difficulty with the player's physics.
 * An expert kicks well, steers clean and uses items. A novice steers loosely, reacts late, never
 * bursts, and kicks now and then: about once every 2.3 s on the course, measured.
 */
export const BOT_PROFILES = {
  expert: { ...PLAYER_PROFILE, kickSkill: 0.95, wobble: 0.04, reactionTicks: 2, itemAggression: 0.8 },
  novice: { ...PLAYER_PROFILE, kickSkill: 0.01, wobble: 0.5, reactionTicks: 12, itemAggression: 0 },
} as const satisfies Record<string, RivalProfile>;
