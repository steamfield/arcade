/**
 * The playable cast: each character's name, signature ability and the profile
 * it races with as a rival, plus how a race fills the three rival slots from
 * the characters the player didn't pick. Data and one seeded draw; no rules.
 */
import type { Rng } from '@arcade/core';
import { RIVAL_PROFILES } from './ai/profiles.ts';
import { type AbilityId, CHARACTER_IDS, type CharacterId, type RivalProfile } from './types.ts';

/** A character as data. The slot it races in supplies the profile's `id`. */
export interface Character {
  /** Display name; the view upper-cases it. */
  name: string;
  ability: AbilityId;
  /** How it swims when the computer drives it. */
  profile: Omit<RivalProfile, 'id'>;
}

/** Today's tuned rival profile `slot` without its slot id, as a placeholder for a character. */
function placeholder(slot: keyof typeof RIVAL_PROFILES): Omit<RivalProfile, 'id'> {
  const { id: _slot, ...profile } = RIVAL_PROFILES[slot];
  return profile;
}

/**
 * The cast. Placeholder profiles cycle the tuned Tess, Squib and Bo values in CHARACTER_IDS order
 * (rudy Tess, gil Squib, streak Bo, onyx Tess, ...) until each character is tuned on its own.
 */
export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  rudy: { name: 'Rudy', ability: 'shakeItOff', profile: placeholder('tess') },
  gil: { name: 'Gil', ability: 'springKick', profile: placeholder('squib') },
  streak: { name: 'Streak', ability: 'windUp', profile: placeholder('bo') },
  onyx: { name: 'Onyx', ability: 'ambush', profile: placeholder('tess') },
  nib: { name: 'Nib', ability: 'deepPockets', profile: placeholder('squib') },
  baron: { name: 'Baron Barnacle', ability: 'bulldozer', profile: placeholder('bo') },
  selene: { name: 'Selene', ability: 'moonlight', profile: placeholder('tess') },
  rook: { name: 'Rook', ability: 'frenzy', profile: placeholder('squib') },
};

/**
 * Where each rival slot draws from, in slot order (tess, squib, bo): the characters holding that
 * slot's placeholder profile. Drawing one from each keeps every slot on the profile it raced with
 * before the roster, so seeded races and the difficulty bars hold until the profiles are retuned;
 * then this can become one pool of every character.
 */
const RIVAL_POOLS: readonly (readonly CharacterId[])[] = [0, 1, 2].map((pool) =>
  CHARACTER_IDS.filter((_, index) => index % 3 === pool),
);

/**
 * The characters for the three rival slots, in slot order: three distinct characters, never
 * `player`, drawn from `rng` (the world's `roster` stream) and nothing else, so the same seed
 * always fields the same rivals.
 */
export function pickRivals(rng: Rng, player: CharacterId): [CharacterId, CharacterId, CharacterId] {
  const [first, second, third] = RIVAL_POOLS.map((pool) => rng.pick(pool.filter((id) => id !== player)));
  if (!first || !second || !third) throw new Error(`Rival pools for '${player}' left a slot with no character`);
  return [first, second, third];
}
