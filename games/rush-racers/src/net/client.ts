/**
 * One peer's whole online flow over a `RoomConnection`: waiting to be welcomed, the lobby, a race
 * driven by a lockstep session, and back to the lobby. It is the only net module the engine talks
 * to. It has no clock and no DOM: the engine calls `tick` once per logic step with the wall time the
 * step stands for, and everything the network sent is handled there. Setters and `leave` send at
 * once, because a hiding tab stops ticking before it can wait for one.
 */
import { type RoomMessage, RoomMessageSchema } from '@arcade/api/protocol';
import type { CharacterId, RacerId, TickInput, World } from '../logic/types.ts';
import { createLobby, type LobbyOptions, type LobbyView } from './lobby.ts';
import {
  type OnlineDifficulty,
  type RelayedGameMessage,
  RelayedGameMessageSchema,
  type StartMessage,
} from './messages.ts';
import { createOnlineRace, type OnlineRace, type RaceView } from './race.ts';
import type { CloseReason, ConnectionEvent, RoomConnection } from './transport/types.ts';

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
export type { RaceView } from './race.ts';

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
   * @throws {Error} When `view.lobby.canStart` is false, or this peer is in a race that is not over.
   */
  start(seed: number): void;
  /** Leaves the finished (or out-of-sync) race for the lobby, dropping its world. Does nothing in the lobby. */
  returnToLobby(): void;
  /** Closes the connection; the view becomes `closed` with reason `left`. */
  leave(): void;
}

/** At most this much of a malformed message goes into its warning. */
const PREVIEW_CHARS = 80;
/** How far a ping must move, in ms, before the room is told: half a logic tick. */
const PING_RESEND_MS = 8;

/** A short, printable form of whatever arrived, for a warning; never throws, whatever the value. */
function preview(message: unknown): string {
  try {
    return (JSON.stringify(message) ?? String(message)).slice(0, PREVIEW_CHARS);
  } catch {
    // A cycle, a BigInt or a hostile toString: the type is all a warning needs.
    return `a value of type ${typeof message}`;
  }
}

/** What a client tracks between calls. */
interface ClientState {
  status: ClientStatus;
  reason: CloseReason | null;
  race: OnlineRace | null;
  dropped: number;
  /** The kinds of drop already warned about in this race (or before the first). */
  warned: Set<string>;
  /** The ping carried by the last lobby entry sent; null before the first. */
  sentPing: number | null;
}

/** A client on `options.connection`, not yet welcomed. */
export function createClient(options: ClientOptions): OnlineClient {
  const { connection } = options;
  const lobby = createLobby(options.lobby);
  const state: ClientState = {
    status: 'connecting',
    reason: null,
    race: null,
    dropped: 0,
    warned: new Set(),
    sentPing: null,
  };
  const isOpen = () => state.status !== 'closed';
  const isWelcomed = () => state.status === 'lobby' || state.status === 'racing';
  /** True while this peer is in a race it has not finished; a finished one (on results) gives way to the next start. */
  const isMidRace = () => state.status === 'racing' && state.race?.view.over !== true;

  /** Counts a dropped message and warns about the first of its kind in this race. */
  function drop(kind: string, detail: string): void {
    state.dropped++;
    if (state.warned.has(kind)) return;
    state.warned.add(kind);
    options.warn(`online: dropped ${detail}`);
  }

  function sendEntry(): void {
    if (!isWelcomed()) return;
    const entry = lobby.mine();
    state.sentPing = entry.ping;
    connection.send(entry);
  }

  function handleStart(start: StartMessage, from: number): void {
    if (from !== lobby.view.host) {
      drop('start-not-host', `a start from peer ${from}, who is not host`);
      return;
    }
    if (isMidRace()) {
      drop('start-racing', `a start from peer ${from} during a race`);
      return;
    }
    const local = start.slots[String(lobby.view.you)];
    if (local === undefined) return;
    state.race = createOnlineRace({
      start,
      local,
      present: lobby.view.peers,
      createRace: options.createRace,
      send: (message) => connection.send(message),
      kickAfterMs: options.kickAfterMs,
    });
    state.status = 'racing';
    state.warned = new Set();
  }

  function handleRoomMessage(message: RoomMessage): void {
    lobby.apply(message);
    if (message.type === 'welcome' && state.status === 'connecting') {
      state.status = 'lobby';
      sendEntry();
    }
    // Every newcomer needs everyone's entry, and nobody else will repeat it.
    if (message.type === 'joined') sendEntry();
    if (message.type === 'left') state.race?.peerLeft(message.peer);
  }

  function handleGameMessage(message: RelayedGameMessage): void {
    if (!lobby.view.peers.some((peer) => peer.id === message.from)) {
      drop('stranger', `a ${message.type} message from unknown peer ${message.from}`);
      return;
    }
    lobby.apply(message);
    if (message.type === 'start') handleStart(message, message.from);
    if (message.type === 'end') state.race?.receiveEnd(message.from, message);
  }

  function handleJson(message: unknown): void {
    const room = RoomMessageSchema.safeParse(message);
    const game = room.success ? null : RelayedGameMessageSchema.safeParse(message);
    if (room.success) handleRoomMessage(room.data);
    else if (game?.success) handleGameMessage(game.data);
    else drop('malformed', `a malformed message: ${preview(message)}`);
  }

  function handleBinary(from: number, bytes: Uint8Array): void {
    // The room relays binary only among racers, so binary reaching the lobby is the last race's traffic in flight.
    if (state.race === null) return;
    if (state.race.receiveBinary(from, bytes)) return;
    drop('binary', `${bytes.length} bytes of binary from peer ${from}`);
  }

  function handlePing(roundTripMs: number): void {
    lobby.setPing(roundTripMs / 2);
    const ping = lobby.mine().ping;
    // Each lobby message wakes the room's Durable Object, and a ping every 2 s that always re-sent
    // would keep it from hibernating. Half a tick of movement is what the start's delay can notice.
    if (state.sentPing === null || Math.abs(ping - state.sentPing) >= PING_RESEND_MS) sendEntry();
  }

  function handle(event: ConnectionEvent): void {
    switch (event.kind) {
      case 'open':
        break;
      case 'json':
        handleJson(event.message);
        break;
      case 'binary':
        handleBinary(event.from, event.bytes);
        break;
      case 'ping':
        handlePing(event.roundTripMs);
        break;
      case 'closed':
        state.status = 'closed';
        state.reason = event.reason;
        break;
    }
  }

  /** Applies a lobby setter and tells the room at once, unless the connection is over. */
  const setter =
    <T>(apply: (value: T) => void, hostOnly = false) =>
    (value: T): void => {
      if (!isOpen() || (hostOnly && lobby.view.you !== lobby.view.host)) return;
      apply(value);
      sendEntry();
    };

  return {
    get view(): ClientView {
      return {
        status: state.status,
        reason: state.reason,
        lobby: lobby.view,
        race: state.race?.view ?? null,
        dropped: state.dropped,
      };
    },
    get world() {
      return state.race?.world ?? null;
    },
    tick(input, elapsedMs) {
      for (const event of connection.poll()) {
        if (!isOpen()) break;
        handle(event);
      }
      if (!isOpen() || state.race === null) return 0;
      return state.race.tick(input, elapsedMs);
    },
    setCharacter: setter(lobby.setCharacter),
    setReady: setter(lobby.setReady),
    setCourse: setter(lobby.setCourse, true),
    setDifficulty: setter(lobby.setDifficulty, true),
    start(seed) {
      if (!isOpen()) return;
      if (isMidRace()) throw new Error('start: this peer is in a race that is not over yet');
      const start = lobby.buildStart(seed);
      connection.send(start);
      handleStart(start, lobby.view.you ?? 0);
    },
    returnToLobby() {
      // Before its `end` is sent the room still counts this peer as racing, so only a finished race can be left.
      if (state.status !== 'racing' || !state.race?.view.over) return;
      state.race = null;
      state.status = 'lobby';
    },
    leave() {
      if (!isOpen()) return;
      connection.close();
      state.status = 'closed';
      state.reason = 'left';
    },
  };
}
