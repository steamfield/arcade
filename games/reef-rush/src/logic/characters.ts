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
 * gives it. They all swim harder than the player (forceMul near 1.45) and kick and use items less
 * than a good player; the tests in `difficulty/` hold the whole field to its bars for every pick.
 *
 * Swim force sits between 1.38 and 1.50 and is fitted per character, to two decimals, so that every
 * pick's win rate lands inside the band: a rival's strength raises the win rate of the characters
 * it does not race against, so the characters whose own abilities win the most (Rudy, Baron,
 * Selene) race a little weaker as rivals and Nib, whose bot wins the least, a little stronger.
 * Win rates shift by a point or more with any change here, so retune against seeds 1-200, not by eye.
 *
 * - Rudy, the plucky hero: the all-rounder; middling kicks, steering and item use.
 * - Gil, lanky and springy: kicks the most, steers the loosest, light in bumps, sparing with items.
 * - Streak, the cocky speedster: the cleanest line (least wobble) and quick to react, but barely
 *   kicks and seldom uses items; its wind-up does the work.
 * - Onyx, the brooding rival: tight steering and solid in bumps, and the least item use of all; his
 *   threat is the ambush, so his items are kept rare.
 * - Nib, the tinkerer: by far the most item-happy (3x anyone else), a little scatty, the lightest.
 * - Baron Barnacle, the bruiser: a little less swim force, offset by the gate he rams through,
 *   his slow start and the slowest reactions; heaviest, and almost never kicks.
 * - Selene, the mystic: smooth and unhurried, a little less swim force, reacts late.
 * - Rook, the hunter: the quickest to react, heavy for his size, kicks readily, moderate items.
 *
 * `itemAggression` is the chance per tick to fire when a held item has a use; about 3 uses
 * per rival per race on average.
 */
export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  rudy: {
    name: 'Rudy',
    ability: 'shakeItOff',
    profile: { forceMul: 1.38, kickSkill: 0.006, wobble: 0.1, reactionTicks: 5, mass: 1.1, itemAggression: 0.025 },
  },
  gil: {
    name: 'Gil',
    ability: 'springKick',
    profile: { forceMul: 1.45, kickSkill: 0.012, wobble: 0.25, reactionTicks: 4, mass: 0.8, itemAggression: 0.02 },
  },
  streak: {
    name: 'Streak',
    ability: 'windUp',
    profile: { forceMul: 1.46, kickSkill: 0.003, wobble: 0.05, reactionTicks: 4, mass: 0.9, itemAggression: 0.02 },
  },
  onyx: {
    name: 'Onyx',
    ability: 'ambush',
    profile: { forceMul: 1.46, kickSkill: 0.008, wobble: 0.06, reactionTicks: 4, mass: 1.3, itemAggression: 0.01 },
  },
  nib: {
    name: 'Nib',
    ability: 'deepPockets',
    profile: { forceMul: 1.5, kickSkill: 0.005, wobble: 0.2, reactionTicks: 5, mass: 0.7, itemAggression: 0.075 },
  },
  baron: {
    name: 'Baron Barnacle',
    ability: 'bulldozer',
    profile: { forceMul: 1.42, kickSkill: 0.002, wobble: 0.1, reactionTicks: 8, mass: 2, itemAggression: 0.025 },
  },
  selene: {
    name: 'Selene',
    ability: 'moonlight',
    profile: { forceMul: 1.42, kickSkill: 0.004, wobble: 0.12, reactionTicks: 7, mass: 0.9, itemAggression: 0.025 },
  },
  rook: {
    name: 'Rook',
    ability: 'frenzy',
    profile: { forceMul: 1.42, kickSkill: 0.008, wobble: 0.15, reactionTicks: 3, mass: 1.4, itemAggression: 0.018 },
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
