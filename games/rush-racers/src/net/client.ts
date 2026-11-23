/**
 * One peer's whole online flow over a `RoomConnection`: waiting to be welcomed, the lobby, a race
 * driven by a lockstep session, and back to the lobby. It is the only net module the engine talks
 * to. It has no clock and no DOM: the engine calls `tick` once per logic step with the wall time the
 * step stands for, and everything the network sent is handled there. Setters and `leave` send at
 * once, because a hiding tab stops ticking before it can wait for one.
 */
import type { CharacterId, RacerId, TickInput, World } from '../logic/types.ts';
import type { LobbyOptions, LobbyView } from './lobby.ts';
import type { OnlineDifficulty, StartMessage } from './messages.ts';
import type { Desync } from './session.ts';
import type { CloseReason, RoomConnection } from './transport/types.ts';

/** Where a client is in its flow. */
export type ClientStatus =
  /** Connected or connecting, not yet welcomed by the room. */
  | 'connecting'
  /** In the room between races, or waiting out a race it is not in. */
  | 'lobby'
  /** In a race, from its start message until `returnToLobby`. */
  | 'racing'
  /** The connection is over; `ClientView.reason` says why. */
  | 'closed';

/** The race a client is in. */
export interface RaceView {
  /** The slot this peer races in. */
  local: RacerId;
  /** The slot each racing peer holds, by peer id. */
  slots: Readonly<Record<number, RacerId>>;
  /** The lobby label (P1 to P4, as at the start) of each human slot. */
  labels: Readonly<Partial<Record<RacerId, string>>>;
  inputDelay: number;
  simTick: number;
  targetTick: number;
  stalledMs: number;
  /** Labels of the peers this one is waiting on; empty while on time. */
  waitingOn: readonly string[];
  /** True once this peer's world has finished the race and its `end` has been sent. */
  over: boolean;
  /** Set when a hash differed: the race stopped here and `over` is true. */
  desync: Desync | null;
}

/** Everything the screens and `debugSummary` show about a client. */
export interface ClientView {
  status: ClientStatus;
  /** Why the connection closed; null until it has. */
  reason: CloseReason | null;
  lobby: LobbyView;
  /** The race this peer is in; null in the lobby. */
  race: RaceView | null;
  /** Messages dropped because they were malformed, out of place or from an unknown peer. */
  dropped: number;
}

/** What a client is built from. */
export interface ClientOptions {
  connection: RoomConnection;
  lobby: LobbyOptions;
  /**
   * Builds this peer's world for a race from the start message alone, with `local` the slot this
   * peer holds. The engine supplies it, since a world needs the course registry and the event log.
   */
  createRace(start: StartMessage, local: RacerId): World;
  /** Milliseconds of stall before asking the room to kick the silent peer; null never asks (test mode). */
  kickAfterMs: number | null;
  /** Reports the first dropped message of each kind in a race. */
  warn(message: string): void;
}

/** One peer's online flow. */
export interface OnlineClient {
  readonly view: ClientView;
  /** The world of the race this peer is in; null in the lobby. The client's session is the only thing that steps it. */
  readonly world: World | null;
  /**
   * Handles everything that arrived since the last tick, and in a race pumps the session once with
   * `input`. Returns how many ticks the world stepped: 0 or 1, and always 0 outside a race.
   */
  tick(input: TickInput, elapsedMs: number): number;
  setCharacter(character: CharacterId): void;
  /** False while this peer's tab is hidden. */
  setReady(ready: boolean): void;
  /** Host only; ignored otherwise. */
  setCourse(course: string): void;
  /** Host only; ignored otherwise. */
  setDifficulty(difficulty: OnlineDifficulty): void;
  /**
   * Starts a race among the ready peers, this one included, with `seed`.
   *
   * @throws {Error} When `view.lobby.canStart` is false.
   */
  start(seed: number): void;
  /** Leaves the finished (or out-of-sync) race for the lobby, dropping its world. Does nothing in the lobby. */
  returnToLobby(): void;
  /** Closes the connection; the view becomes `closed` with reason `left`. */
  leave(): void;
}

/** A client on `options.connection`, not yet welcomed. */
export function createClient(_options: ClientOptions): OnlineClient {
  throw new Error('not implemented');
}
