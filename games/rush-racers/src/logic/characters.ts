/**
 * The playable cast: each character's name, signature ability and the profile
 * it races with as a rival, plus how a race fills the slots nobody chose a
 * character for from the characters left. Data and one seeded draw; no rules.
 */
import type { Rng } from '@arcade/core';
import {
  type AbilityId,
  CHARACTER_IDS,
  type CharacterId,
  RACER_IDS,
  type RacerId,
  type RivalProfile,
} from './types.ts';

/**
 * A character slot as data: its ability and how it races as a rival, the same in every world. The
 * slot it races in supplies the profile's `id`; each world names it (`WorldDef.cast`).
 */
export interface Character {
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
 *   kicks; its wind-up does the work. It passes few clams, so it fires few items even at 0.5.
 * - Onyx, the brooding rival: tight steering and solid in bumps, and the least item use of all; his
 *   threat is the ambush, so his items are kept rare.
 * - Nib, the tinkerer: by far the most item-happy (twice anyone else), a little scatty, the lightest.
 * - Baron Barnacle, the bruiser: a little less swim force, offset by the gate he rams through,
 *   his slow start and the slowest reactions; heaviest, and almost never kicks.
 * - Selene, the mystic: smooth and unhurried, a little less swim force, reacts late.
 * - Rook, the hunter: the quickest to react, heavy for his size, kicks readily, moderate items.
 *
 * `itemAggression` is how eagerly it fires an item that has a use: with one in reach it fires after
 * `reactionTicks / itemAggression` ticks on average (`ai/items.ts`). Rivals use most of what they
 * get, so clam supply more than eagerness limits how often they fire: a rival rolls up to two
 * items from a clam (`CLAM.rivalRolls`). On Normal each character's median as a rival is 6-9.5 uses
 * a race (`balance/rival-items.ts`, 40 races each), inside the 5-10 band; Gil went 0.4 -> 0.3
 * (he was at the 10 ceiling) and Streak 0.4 -> 0.5 (5.5, near the floor) to keep room on both sides.
 */
export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
  rudy: {
    ability: 'shakeItOff',
    profile: { forceMul: 0.95, kickSkill: 0.006, wobble: 0.1, reactionTicks: 5, mass: 1.1, itemAggression: 0.5 },
  },
  gil: {
    ability: 'springKick',
    profile: { forceMul: 1.04, kickSkill: 0.012, wobble: 0.25, reactionTicks: 4, mass: 0.8, itemAggression: 0.3 },
  },
  streak: {
    ability: 'windUp',
    profile: { forceMul: 1.05, kickSkill: 0.003, wobble: 0.05, reactionTicks: 4, mass: 0.9, itemAggression: 0.5 },
  },
  onyx: {
    ability: 'ambush',
    profile: { forceMul: 1.05, kickSkill: 0.008, wobble: 0.06, reactionTicks: 4, mass: 1.3, itemAggression: 0.2 },
  },
  nib: {
    ability: 'deepPockets',
    profile: { forceMul: 1.1, kickSkill: 0.005, wobble: 0.2, reactionTicks: 5, mass: 0.7, itemAggression: 1 },
  },
  baron: {
    ability: 'bulldozer',
    profile: { forceMul: 1, kickSkill: 0.002, wobble: 0.1, reactionTicks: 8, mass: 2, itemAggression: 0.5 },
  },
  selene: {
    ability: 'moonlight',
    profile: { forceMul: 1, kickSkill: 0.004, wobble: 0.12, reactionTicks: 7, mass: 0.9, itemAggression: 0.5 },
  },
  rook: {
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
  return [drawFrom(rng, pool), drawFrom(rng, pool), drawFrom(rng, pool)];
}

/** Who the player races as when nobody chose: Rudy, unless another slot was given him. */
const DEFAULT_PLAYER_CHARACTER: CharacterId = 'rudy';

/**
 * The character in each slot. Slots in `fixed` keep their character; every
 * other slot, in slot order, draws one by `rng` (the world's `roster` stream) from the characters
 * nobody was given. The player slot, when not fixed, is Rudy if he is free. With only the player's
 * character fixed this is `[player, ...pickRivals(rng, player)]`, the same draws in the same order.
 *
 * @throws {Error} When `fixed` names a slot that is not in RACER_IDS or a character that is not in
 *   CHARACTER_IDS, or gives two slots one character.
 */
export function assignCharacters(rng: Rng, fixed: Partial<Record<RacerId, CharacterId>>): Record<RacerId, CharacterId> {
  const given = requireValidChoices(fixed);
  const player = fixed.player ?? (given.includes(DEFAULT_PLAYER_CHARACTER) ? undefined : DEFAULT_PLAYER_CHARACTER);
  const chosen = { ...fixed, player };
  const pool = CHARACTER_IDS.filter((id) => id !== player && !given.includes(id));
  // Slot order fixes the order of draws on the stream, so the same seed always fields the same cast.
  const entries = RACER_IDS.map((slot) => [slot, chosen[slot] ?? drawFrom(rng, pool)] as const);
  return Object.fromEntries(entries) as Record<RacerId, CharacterId>;
}

/** Removes and returns one character picked by `rng` from `pool`. */
function drawFrom(rng: Rng, pool: CharacterId[]): CharacterId {
  const picked = rng.pick(pool);
  pool.splice(pool.indexOf(picked), 1);
  return picked;
}

/**
 * The characters `fixed` gives out, after checking every slot and character is real and no
 * character is given twice.
 *
 * @throws {Error} When a slot is not in RACER_IDS, a character is not in CHARACTER_IDS, or a
 *   character is given to two slots.
 */
function requireValidChoices(fixed: Partial<Record<RacerId, CharacterId>>): CharacterId[] {
  const given: CharacterId[] = [];
  for (const [slot, character] of Object.entries(fixed)) {
    if (!RACER_IDS.includes(slot as RacerId)) {
      throw new Error(`characters names unknown slot '${slot}'; slots are ${RACER_IDS.join(', ')}`);
    }
    if (character === undefined) continue;
    if (!CHARACTER_IDS.includes(character)) {
      throw new Error(
        `characters gives slot '${slot}' unknown character '${character}'; characters are ${CHARACTER_IDS.join(', ')}`,
      );
    }
    if (given.includes(character)) {
      throw new Error(`characters gives '${character}' to two slots; each character races once`);
    }
    given.push(character);
  }
  return given;
}
