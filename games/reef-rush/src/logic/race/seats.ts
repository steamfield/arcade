/**
 * Who sits in each slot at the start line: which slots people race in, the character in every
 * slot, the profile it swims with and whether a person, a test bot or the AI drives it. Validates
 * the race's setup options; reads nothing else of the world.
 */
import type { Rng } from '@arcade/core';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import { assignCharacters, CHARACTERS } from '../characters.ts';
import { type CharacterId, type Difficulty, RACER_IDS, type RacerId, type RivalProfile } from '../types.ts';

/** The setup options seats are made from: the matching fields of `WorldOptions`. */
export interface SeatOptions {
  /** When set, this profile's AI drives the player slot and its input is ignored. */
  playerBot?: RivalProfile;
  /** The old name for `characters.player`. */
  character?: CharacterId;
  /** Slots people race in. Default `['player']`. */
  humans?: readonly RacerId[];
  /** Who races in each slot; the rest are drawn from the roster. */
  characters?: Partial<Record<RacerId, CharacterId>>;
}

/** Who steers a slot: a person's input, a test bot's profile through the AI, or the AI as a rival. */
export type Driver = 'person' | 'testBot' | 'rival';

/** Who races in a slot at the start line and how they are driven. */
export interface Seat {
  id: RacerId;
  /** Position in RACER_IDS, which is also the start number. */
  index: number;
  character: CharacterId;
  profile: RivalProfile;
  driver: Driver;
}

/**
 * The human slots (RACER_IDS order) and one seat per slot (RACER_IDS order). The cast takes one
 * draw from `roster` per slot nobody chose a character for, in slot order (`assignCharacters`).
 *
 * @throws {Error} When `humans` is empty, repeats a slot, names a slot not in RACER_IDS, or is not
 *   `['player']` on Easy; when `characters` names an unknown slot or character or gives one
 *   character twice; when `character` and `characters.player` differ; or when `playerBot` is set
 *   and `humans` leaves out 'player'.
 */
export function seatsFor(
  options: SeatOptions,
  roster: Rng,
  difficulty: Difficulty,
): { humans: RacerId[]; seats: Seat[] } {
  const humans = humanSlots(options.humans, difficulty);
  requireBotSlotHuman(options.playerBot, humans);
  const characters = assignCharacters(roster, characterChoices(options));
  const seats = RACER_IDS.map((id, index) => seatFor(id, index, characters[id], humans, options.playerBot));
  return { humans, seats };
}

/** How `character` races when the AI drives it in slot `id`. */
export function rivalProfileOf(id: RacerId, character: CharacterId): RivalProfile {
  return { id, ...CHARACTERS[character].profile };
}

/**
 * The human slots in RACER_IDS order, `['player']` when not given.
 *
 * @throws {Error} When `humans` is empty, repeats a slot or names a slot not in RACER_IDS, or when
 *   `difficulty` is 'easy' and `humans` is anything but `['player']` (the Easy guide follows that slot).
 */
function humanSlots(humans: readonly RacerId[] | undefined, difficulty: Difficulty): RacerId[] {
  if (humans === undefined) return ['player'];
  if (humans.length === 0) throw new Error('humans is empty; a race needs at least one human slot');
  const unknown = humans.find((id) => !RACER_IDS.includes(id));
  if (unknown !== undefined) {
    throw new Error(`humans names unknown slot '${unknown}'; slots are ${RACER_IDS.join(', ')}`);
  }
  const repeated = humans.find((id, index) => humans.indexOf(id) !== index);
  if (repeated !== undefined) throw new Error(`humans repeats slot '${repeated}'; list each slot once`);
  if (difficulty === 'easy' && (humans.length !== 1 || humans[0] !== 'player')) {
    throw new Error(
      `humans is [${humans.join(', ')}] on Easy, which is single-player; use ['player'] or another level`,
    );
  }
  return RACER_IDS.filter((id) => humans.includes(id));
}

/**
 * Checks a test bot has the player slot to drive, since `playerBot` replaces that slot's person.
 *
 * @throws {Error} When `playerBot` is set and `humans` does not include 'player'.
 */
function requireBotSlotHuman(playerBot: RivalProfile | undefined, humans: readonly RacerId[]): void {
  if (!playerBot || humans.includes('player')) return;
  throw new Error(
    `playerBot drives the player slot, but humans is [${humans.join(', ')}]; add 'player' to humans or drop playerBot`,
  );
}

/**
 * The characters chosen per slot, with `character` read as `characters.player`.
 *
 * @throws {Error} When `character` and `characters.player` are both given and differ.
 */
function characterChoices({ character, characters = {} }: SeatOptions): Partial<Record<RacerId, CharacterId>> {
  if (character === undefined) return characters;
  if (characters.player !== undefined && characters.player !== character) {
    throw new Error(`character '${character}' and characters.player '${characters.player}' disagree; give one`);
  }
  return { ...characters, player: character };
}

/**
 * The seat for slot `id`. The player slot with a `playerBot` is that bot's; any other human slot is
 * a person's with the player profile, so humans are equal whatever slot they hold; the rest race
 * with their character's rival profile.
 */
function seatFor(
  id: RacerId,
  index: number,
  character: CharacterId,
  humans: readonly RacerId[],
  playerBot: RivalProfile | undefined,
): Seat {
  if (id === 'player' && playerBot) return { id, index, character, profile: playerBot, driver: 'testBot' };
  if (humans.includes(id)) return { id, index, character, profile: { ...PLAYER_PROFILE, id }, driver: 'person' };
  return { id, index, character, profile: rivalProfileOf(id, character), driver: 'rival' };
}
