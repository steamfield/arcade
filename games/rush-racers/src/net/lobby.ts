/**
 * What one peer knows about its room between races: who is in it, in join order, what each picked,
 * how far each is from the room, and who is away. The host's copy also builds the race start.
 */
import type { RoomMessage, RoomPhase } from '@arcade/api/protocol';
import type { CharacterId, Difficulty } from '../logic/types.ts';
import type { LobbyMessage, OnlineDifficulty, RelayedGameMessage, StartMessage } from './messages.ts';

/** One peer as the room screen shows it. */
export interface LobbyPeer {
  id: number;
  /** P1 to P4, by position in join order among the peers present. */
  label: string;
  /** Null until the peer's first lobby message arrives. */
  character: CharacterId | null;
  /** Half the peer's round trip to the room in milliseconds; null until known. */
  ping: number | null;
  /** False while the peer's tab is hidden, and until its first lobby message arrives. */
  ready: boolean;
  host: boolean;
  /** True for this peer. */
  you: boolean;
}

/** The lobby as the room screen shows it. */
export interface LobbyView {
  /** This peer's id; null until the room's welcome arrives. */
  you: number | null;
  host: number | null;
  phase: RoomPhase;
  /** Everyone present, in join order. */
  peers: readonly LobbyPeer[];
  /** The course the next race runs on, by id. */
  course: string;
  difficulty: OnlineDifficulty;
  /** True when this peer is host, the room is between races and at least two peers, itself included, are ready. */
  canStart: boolean;
}

/** What a lobby starts from: this peer's own entry and, should it be host, the race settings. */
export interface LobbyOptions {
  character: CharacterId;
  course: string;
  /** The save's level; Easy becomes Normal online. */
  difficulty: Difficulty;
}

/** One peer's lobby. */
export interface Lobby {
  readonly view: LobbyView;
  /** Takes a message from the room or a relayed game message. Messages about peers this lobby does not know are ignored. */
  apply(message: RoomMessage | RelayedGameMessage): void;
  setCharacter(character: CharacterId): void;
  /** Sets this peer's measured half round trip, in milliseconds. */
  setPing(ms: number): void;
  setReady(ready: boolean): void;
  /** Sets the course; has no effect unless this peer is host. */
  setCourse(course: string): void;
  /** Sets the level; has no effect unless this peer is host. */
  setDifficulty(difficulty: OnlineDifficulty): void;
  /** The lobby message this peer should send now. A host's carries the course and level. */
  mine(): LobbyMessage;
  /**
   * The start message for a race among the ready peers.
   *
   * @throws {Error} When this peer is not host, or fewer than two peers are ready.
   */
  buildStart(seed: number): StartMessage;
}

/** A lobby for a peer that has just connected and not yet been welcomed. */
export function createLobby(_options: LobbyOptions): Lobby {
  throw new Error('not implemented');
}
