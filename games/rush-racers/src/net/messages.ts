/**
 * The game's own JSON messages, which the room relays without reading their payload: a peer's
 * lobby entry, the host's race start, and a peer's race end. Each arrives with `from`, the sender's
 * peer id, added by the room. Binary messages (inputs and hashes) are in `codec.ts`.
 */
import { z } from 'zod';
import { CHARACTER_IDS, type CharacterId, RACER_IDS, type RacerId } from '../logic/types.ts';

/** The levels an online race may run on. Easy's guide and immunity are written for one human. */
export const ONLINE_DIFFICULTIES = ['normal', 'hard'] as const;
export type OnlineDifficulty = (typeof ONLINE_DIFFICULTIES)[number];

/** The fewest ticks between reading an input and applying it. */
export const MIN_INPUT_DELAY = 3;
/** The most ticks between reading an input and applying it (200 ms); past this a race stalls instead. */
export const MAX_INPUT_DELAY = 12;

const Character = z.enum(CHARACTER_IDS as [CharacterId, ...CharacterId[]]);
const Slot = z.enum(RACER_IDS as [RacerId, ...RacerId[]]);
const Difficulty = z.enum(ONLINE_DIFFICULTIES);
const Uint32 = z.number().int().min(0).max(0xffffffff);
const From = z.number().int().min(1).max(255);

/**
 * A peer's lobby entry, sent whenever it changes and once to greet each newcomer. `ping` is half the
 * measured round trip to the room in milliseconds. `ready` is false while the peer's tab is hidden.
 * `course` and `difficulty` are the room's race settings and count only when the host sends them.
 */
export const LobbySchema = z.object({
  type: z.literal('lobby'),
  character: Character,
  ping: z.number().int().min(0).max(5000),
  ready: z.boolean(),
  course: z.string().min(1).max(64).optional(),
  difficulty: Difficulty.optional(),
});
export type LobbyMessage = z.infer<typeof LobbySchema>;

/**
 * The host's race start. Every peer builds its world from this message alone: `hashWorld` does not
 * cover what is fixed before the first tick, so a disagreement here would go unnoticed.
 * `slots` maps a peer id (as a string key) to the slot that peer races in; a peer not listed stays
 * in the lobby. `characters` holds a character for every slot in `slots`. `delay` is the input
 * delay in ticks. Use `StartSchema` to validate one: it also checks the fields against each other.
 */
const StartFields = z.object({
  type: z.literal('start'),
  seed: Uint32,
  course: z.string().min(1).max(64),
  difficulty: Difficulty,
  slots: z.record(z.string().regex(/^[1-9]\d{0,2}$/), Slot),
  characters: z.partialRecord(Slot, Character),
  delay: z.number().int().min(MIN_INPUT_DELAY).max(MAX_INPUT_DELAY),
});

/**
 * What `createWorld` would refuse, checked here so a start from the network can never make it throw:
 * two peers in one slot, a raced slot without a character, a character for a slot nobody races in,
 * and one character given to two slots.
 */
function startProblems(start: z.infer<typeof StartFields>): string[] {
  const slots = Object.values(start.slots);
  const characters = Object.values(start.characters);
  const problems: string[] = [];
  if (slots.length < 2) problems.push('a race needs at least two peers');
  if (new Set(slots).size !== slots.length) problems.push('two peers share a slot');
  if (new Set(characters).size !== characters.length) problems.push('two slots share a character');
  for (const slot of slots) if (!(slot in start.characters)) problems.push(`slot ${slot} has no character`);
  for (const slot of Object.keys(start.characters)) {
    if (!slots.some((raced) => raced === slot)) problems.push(`slot ${slot} has a character but no peer`);
  }
  return problems;
}

/** The host's race start, valid only when its fields also agree with each other. */
export const StartSchema = StartFields.superRefine((start, context) => {
  for (const message of startProblems(start)) context.addIssue({ code: 'custom', message });
});
export type StartMessage = z.infer<typeof StartSchema>;

/** A peer's race is over: the last tick it stepped and its world's hash there. */
export const EndSchema = z.object({ type: z.literal('end'), tick: Uint32, hash: Uint32 });
export type EndMessage = z.infer<typeof EndSchema>;

/** A game message as a peer sends it. */
export const GameMessageSchema = z.union([LobbySchema, StartSchema, EndSchema]);
export type GameMessage = z.infer<typeof GameMessageSchema>;

/** A game message as it arrives, with the sender's peer id. */
export const RelayedGameMessageSchema = z.union([
  LobbySchema.extend({ from: From }),
  StartFields.extend({ from: From }).superRefine((start, context) => {
    for (const message of startProblems(start)) context.addIssue({ code: 'custom', message });
  }),
  EndSchema.extend({ from: From }),
]);
export type RelayedGameMessage = z.infer<typeof RelayedGameMessageSchema>;
