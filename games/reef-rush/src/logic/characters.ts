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
 * gives it. They swim at par with the player: forceMul between 0.95 and 1.10 of the player's 1, so
 * holding forward keeps pace and dashes and items decide the race.
 *
 * The order of swim force between characters is the one the old fitted values had (Rudy weakest,
 * then Baron, Selene and Rook, Gil, Streak and Onyx, Nib strongest), mapped linearly into that band:
 * the characters whose own abilities win the most race a little weaker as rivals and Nib, whose bot
 * wins the least, a little stronger. Phase 4 refits them against the difficulty bars.
 *
 * - Rudy, the plucky hero: the all-rounder; middling kicks, steering and item use.
 * - Gil, lanky and springy: kicks the most, steers the loosest, light in bumps, sparing with items.
 * - Streak, the cocky speedster: the cleanest line (least wobble) and quick to react, but barely
 *   kicks and seldom uses items; its wind-up does the work.
 * - Onyx, the brooding rival: tight steering and solid in bumps, and the least item use of all; his
 *   threat is the ambush, so his items are kept rare.
 * - Nib, the tinkerer: by far the most item-happy (twice anyone else), a little scatty, the lightest.
 * - Baron Barnacle, the bruiser: a little less swim force, offset by the gate he rams through,
 *   his slow start and the slowest reactions; heaviest, and almost never kicks.
 * - Selene, the mystic: smooth and unhurried, a little less swim force, reacts late.
 * - Rook, the hunter: the quickest to react, heavy for his size, kicks readily, moderate items.
 *
 * `itemAggression` is how eagerly it fires an item that has a use: with one in reach it fires after
 * `reactionTicks / itemAggression` ticks on average (`ai/items.ts`). On Normal the median rival
 * uses 7 items a race (Sunlit Shallows, seeds 1-20, novice player bot), inside the 6-10 target.
 */
export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  rudy: {
    name: 'Rudy',
    ability: 'shakeItOff',
    profile: { forceMul: 0.95, kickSkill: 0.006, wobble: 0.1, reactionTicks: 5, mass: 1.1, itemAggression: 0.5 },
  },
  gil: {
    name: 'Gil',
    ability: 'springKick',
    profile: { forceMul: 1.04, kickSkill: 0.012, wobble: 0.25, reactionTicks: 4, mass: 0.8, itemAggression: 0.4 },
  },
  streak: {
    name: 'Streak',
    ability: 'windUp',
    profile: { forceMul: 1.05, kickSkill: 0.003, wobble: 0.05, reactionTicks: 4, mass: 0.9, itemAggression: 0.4 },
  },
  onyx: {
    name: 'Onyx',
    ability: 'ambush',
    profile: { forceMul: 1.05, kickSkill: 0.008, wobble: 0.06, reactionTicks: 4, mass: 1.3, itemAggression: 0.2 },
  },
  nib: {
    name: 'Nib',
    ability: 'deepPockets',
    profile: { forceMul: 1.1, kickSkill: 0.005, wobble: 0.2, reactionTicks: 5, mass: 0.7, itemAggression: 1 },
  },
  baron: {
    name: 'Baron Barnacle',
    ability: 'bulldozer',
    profile: { forceMul: 1, kickSkill: 0.002, wobble: 0.1, reactionTicks: 8, mass: 2, itemAggression: 0.5 },
  },
  selene: {
    name: 'Selene',
    ability: 'moonlight',
    profile: { forceMul: 1, kickSkill: 0.004, wobble: 0.12, reactionTicks: 7, mass: 0.9, itemAggression: 0.5 },
  },
  rook: {
    name: 'Rook',
    ability: 'frenzy',
    profile: { forceMul: 1, kickSkill: 0.008, wobble: 0.15, reactionTicks: 3, mass: 1.4, itemAggression: 0.36 },
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
