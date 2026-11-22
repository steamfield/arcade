/**
 * The playable cast: each character's name, signature ability and the profile
 * it races with as a rival, plus how a race fills the three rival slots from
 * the characters the player didn't pick. Data and one seeded draw; no rules.
 */
import type { Rng } from '@arcade/core';
import { type AbilityId, CHARACTER_IDS, type CharacterId, type RivalProfile } from './types.ts';

/** A character as data. The slot it races in supplies the profile's `id`. */
export interface Character {
  /** Display name; the view upper-cases it. */
  name: string;
  ability: AbilityId;
  /** How it swims when the computer drives it. */
  profile: Omit<RivalProfile, 'id'>;
}

/**
 * The cast. Each profile is how the character races as a rival, in the personality the roster
 * gives it. They all swim harder than the player (forceMul near 1.5) and kick and burst less
 * than a good player; difficulty.test.ts holds the whole field to its bars for every pick.
 *
 * - Rudy, the plucky hero: the all-rounder, middle of every range.
 * - Gil, lanky and springy: kicks often, steers loosely, light in bumps.
 * - Streak, the cocky speedster: the strongest swimmer and the cleanest line, but barely kicks
 *   or uses items; it trusts its wind-up.
 * - Onyx, the brooding rival: tight steering, quick reactions, solid in bumps, fires items readily.
 * - Nib, the tinkerer: the most item-happy, a little scatty at the wheel, light.
 * - Baron Barnacle, the bruiser: heaviest, slowest to react, rarely kicks.
 * - Selene, the mystic: smooth and unhurried, reacts late.
 * - Rook, the hunter: quick to react and quick to fire, heavy for his size.
 */
export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  rudy: {
    name: 'Rudy',
    ability: 'shakeItOff',
    profile: { forceMul: 1.5, kickSkill: 0.006, wobble: 0.1, reactionTicks: 5, mass: 1.1, itemAggression: 0.01 },
  },
  gil: {
    name: 'Gil',
    ability: 'springKick',
    profile: { forceMul: 1.47, kickSkill: 0.012, wobble: 0.25, reactionTicks: 4, mass: 0.8, itemAggression: 0.008 },
  },
  streak: {
    name: 'Streak',
    ability: 'windUp',
    profile: { forceMul: 1.49, kickSkill: 0.003, wobble: 0.05, reactionTicks: 4, mass: 0.9, itemAggression: 0.008 },
  },
  onyx: {
    name: 'Onyx',
    ability: 'ambush',
    profile: { forceMul: 1.48, kickSkill: 0.008, wobble: 0.06, reactionTicks: 4, mass: 1.3, itemAggression: 0.004 },
  },
  nib: {
    name: 'Nib',
    ability: 'deepPockets',
    profile: { forceMul: 1.5, kickSkill: 0.005, wobble: 0.2, reactionTicks: 5, mass: 0.7, itemAggression: 0.03 },
  },
  baron: {
    name: 'Baron Barnacle',
    ability: 'bulldozer',
    profile: { forceMul: 1.56, kickSkill: 0.002, wobble: 0.1, reactionTicks: 8, mass: 2, itemAggression: 0.01 },
  },
  selene: {
    name: 'Selene',
    ability: 'moonlight',
    profile: { forceMul: 1.47, kickSkill: 0.004, wobble: 0.12, reactionTicks: 7, mass: 0.9, itemAggression: 0.01 },
  },
  rook: {
    name: 'Rook',
    ability: 'frenzy',
    profile: { forceMul: 1.49, kickSkill: 0.008, wobble: 0.15, reactionTicks: 3, mass: 1.4, itemAggression: 0.007 },
  },
};

/**
 * The characters for the three rival slots, in slot order: three distinct characters, never
 * `player`, drawn one by one from the other seven by `rng` (the world's `roster` stream) and
 * nothing else, so the same seed always fields the same rivals.
 */
export function pickRivals(rng: Rng, player: CharacterId): [CharacterId, CharacterId, CharacterId] {
  const pool = CHARACTER_IDS.filter((id) => id !== player);
  const draw = (): CharacterId => {
    const picked = rng.pick(pool);
    pool.splice(pool.indexOf(picked), 1);
    return picked;
  };
  return [draw(), draw(), draw()];
}
