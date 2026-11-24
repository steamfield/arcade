/**
 * The room wire protocol: everything the room service itself reads or sends. A room is a relay.
 * It does not know the game: any JSON object with a string `type` that is not listed here is passed
 * to the other peers with the sender's id added as `from`, and binary messages (inputs and hashes)
 * pass only between peers in the current race, with the sender's id as their first byte; binary
 * from anyone else is dropped. Two relayed types also move the room's phase: `start` (from
 * the host, in the lobby) begins a race for the connected peers its `slots` names, and `end` marks
 * its sender done. The room never relays a message carrying one of its own types (`RESERVED_TYPES`).
 *
 * Imported by the room service and by the game (`@arcade/api/protocol`), so it uses zod only.
 */
import { z } from 'zod';

/** Bumped when a change here would make an old client and a new one misread each other. */
export const PROTOCOL_VERSION = 1;

/** The most sockets one room holds. */
export const MAX_PEERS = 4;

/** Peer ids are join sequence numbers and travel in one byte; a room that has used them all refuses joins. */
export const MAX_PEER_ID = 255;

/**
 * Room code characters: capital letters without I, L and O, which read like 1 and 0. Letters only,
 * so a code is quick to say aloud and to spell with a d-pad.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

/** Characters in a room code. */
export const ROOM_CODE_LENGTH = 4;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Whether `text` could be a room code: `ROOM_CODE_LENGTH` characters, each from `ROOM_CODE_ALPHABET`. */
export function isRoomCode(text: string): boolean {
  return ROOM_CODE_PATTERN.test(text);
}

/** The largest message a peer may send, in bytes. */
export const MAX_MESSAGE_BYTES = 1024;

/** The steady rate a peer may send at, in messages per second: its allowance refills this fast. */
export const MAX_MESSAGES_PER_SECOND = 80;

/**
 * The most messages a peer may send at once, above the steady rate: the capacity of its allowance.
 * Large enough that a racer flushing a backlog after a network stall is not closed.
 */
export const MESSAGE_BURST = 240;

/** What a `build` query parameter must look like: lower-case letters, digits and dashes, 1 to 32 of them. */
export const BUILD_ID_PATTERN = /^[0-9a-z-]{1,32}$/;

/**
 * How long a racer must have sent no binary before the room honours a `kick` naming it, in
 * milliseconds. Only racers may kick and be kicked, and a race's start counts as hearing every racer.
 */
export const KICK_SILENCE_MS = 5000;

/** How long a room lives without a join, a start or a race ending, in milliseconds. */
export const ROOM_IDLE_MS = 60 * 60 * 1000;

/** The text a peer sends to measure its round trip; the runtime answers `PONG` without waking the room. */
export const PING = 'ping';
/** The answer to `PING`. */
export const PONG = 'pong';

/**
 * WebSocket close codes the room uses. The room always accepts the socket first and then closes it
 * with one of these, because a refused upgrade shows up in the browser as a console error.
 */
export const CLOSE = {
  /** The room already holds `MAX_PEERS` sockets. */
  full: 4001,
  /** The joiner's protocol version or build differs from the room's, or its build id is malformed; reloading fixes it. */
  version: 4002,
  /** Nobody created a room with this code, or it has expired. */
  unknownRoom: 4003,
  /** The room cannot take this peer for a reason of its own, such as having used every peer id. */
  unavailable: 4004,
  /** Another peer reported this one silent during a race and the room agreed. */
  kicked: 4005,
  /** The peer sent too much: a message over `MAX_MESSAGE_BYTES`, or more than its allowance of `MESSAGE_BURST` refilled at `MAX_MESSAGES_PER_SECOND`. */
  limit: 4006,
  /** The room sat idle for `ROOM_IDLE_MS`. */
  idle: 4007,
  /** The request came from a page on another site. */
  origin: 4008,
} as const;

/** One of the room's close codes. */
export type CloseCode = (typeof CLOSE)[keyof typeof CLOSE];

/** Whether the room is between races or in one. A peer that joins during a race waits in the lobby. */
export const RoomPhaseSchema = z.enum(['lobby', 'racing']);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

const PeerId = z.number().int().min(1).max(MAX_PEER_ID);

/** Room to a peer that just joined: its id, everyone connected in join order (itself included), the host and the phase. */
export const WelcomeSchema = z.strictObject({
  type: z.literal('welcome'),
  you: PeerId,
  peers: z.array(PeerId),
  host: PeerId,
  phase: RoomPhaseSchema,
});
export type Welcome = z.infer<typeof WelcomeSchema>;

/** Room to the others when a peer joins. */
export const JoinedSchema = z.strictObject({ type: z.literal('joined'), peer: PeerId, host: PeerId });
export type Joined = z.infer<typeof JoinedSchema>;

/** Room to the others when a peer's socket is gone, with the host after the departure. Sent once per peer. */
export const LeftSchema = z.strictObject({ type: z.literal('left'), peer: PeerId, host: PeerId });
export type Left = z.infer<typeof LeftSchema>;

/** Room to everyone when the phase changes. */
export const PhaseSchema = z.strictObject({ type: z.literal('phase'), phase: RoomPhaseSchema });
export type Phase = z.infer<typeof PhaseSchema>;

/** Every message the room originates. */
export const RoomMessageSchema = z.discriminatedUnion('type', [WelcomeSchema, JoinedSchema, LeftSchema, PhaseSchema]);
export type RoomMessage = z.infer<typeof RoomMessageSchema>;

/** Peer to room: `peer` has sent nothing this peer was waiting for. The room checks the claim itself. */
export const KickSchema = z.object({ type: z.literal('kick'), peer: PeerId });
export type Kick = z.infer<typeof KickSchema>;

/** The least the room requires of a JSON message it relays. */
export const RelayedSchema = z.looseObject({ type: z.string().min(1).max(32) });

/**
 * Types only the room may send. A peer's message with one of these is dropped, not relayed, so no
 * peer can tell the others that someone left. The room's own messages are strict objects, so a
 * relayed message (which carries `from`) can never parse as one of them either.
 */
export const RESERVED_TYPES: readonly string[] = ['welcome', 'joined', 'left', 'phase'];

/**
 * What the room reads of a `start`: `slots`, keyed by the peer ids that race. Those of them still
 * connected are in the race; everyone else waits in the lobby and owes the room no `end`.
 */
export const StartRelaySchema = z.looseObject({
  type: z.literal('start'),
  slots: z.record(z.string().regex(/^[1-9]\d{0,2}$/), z.unknown()),
});

/** The answer to `POST /api/rooms`. */
export const CreatedSchema = z.object({ code: z.string().length(ROOM_CODE_LENGTH) });
export type Created = z.infer<typeof CreatedSchema>;

/** The path a room's socket is opened on, for a peer running protocol `PROTOCOL_VERSION` and build `build`. */
export function roomSocketPath(code: string, build: string): string {
  return `/api/rooms/${encodeURIComponent(code)}?v=${PROTOCOL_VERSION}&build=${encodeURIComponent(build)}`;
}

/** The path `POST` creates a room on. */
export const CREATE_ROOM_PATH = '/api/rooms';
