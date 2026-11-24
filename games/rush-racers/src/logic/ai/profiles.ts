/**
 * The player's own profile and the bots that drive the player's racer in
 * difficulty tests. Data only. Each character's rival profile lives with the
 * character in `characters.ts`.
 */
import type { RivalProfile } from '../types.ts';

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
 * Bots that drive the player's racer in tests, to measure difficulty with the player's physics.
 * An expert kicks well, steers clean and uses items. The no-dash bot steers like the expert but
 * never dashes or fires: a player who holds forward and steers well (the difficulty harness strips
 * every dash from it, `balance/bot-driver.ts`). A novice steers loosely, reacts late, never
 * uses items, and kicks now and then: about once every 2.3 s on the course, measured.
 */
export const BOT_PROFILES = {
  expert: { ...PLAYER_PROFILE, kickSkill: 0.95, wobble: 0.04, reactionTicks: 2, itemAggression: 0.8 },
  noDash: { ...PLAYER_PROFILE, kickSkill: 0, wobble: 0.04, reactionTicks: 2, itemAggression: 0 },
  novice: { ...PLAYER_PROFILE, kickSkill: 0.01, wobble: 0.5, reactionTicks: 12, itemAggression: 0 },
  toddler: { ...PLAYER_PROFILE, kickSkill: 0, wobble: 1, reactionTicks: 30, itemAggression: 0 },
} as const satisfies Record<string, RivalProfile>;
